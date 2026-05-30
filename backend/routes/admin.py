"""Admin + Hidden SuperAdmin routes with full CRUD on all entities.

Auth model:
- /admin/*               → require_role("admin")  — visible admin console
- /private/internal/<route>/*  → require_superadmin — hidden env-only console (full power)

Routes are kept identical in shape so the same Dashboard.jsx component can drive both.
"""
import os
import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, EmailStr
from db import db, now_iso
from auth import (
    get_current_user, require_role, require_superadmin, create_token, hash_password,
    SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD, SUPERADMIN_SECRET, UserPublic,
)

router = APIRouter(tags=["admin"])
SUPERADMIN_ROUTE = os.environ["SUPERADMIN_ROUTE"]
SA = f"/private/internal/{SUPERADMIN_ROUTE}"


# ---------- shared helpers ----------
async def _platform_stats():
    total_users = await db.users.count_documents({})
    students = await db.users.count_documents({"role": "student"})
    trainers = await db.users.count_documents({"role": "trainer"})
    recruiters = await db.users.count_documents({"role": "recruiter"})
    admins = await db.users.count_documents({"role": "admin"})
    total_courses = await db.courses.count_documents({})
    total_enrollments = await db.enrollments.count_documents({})
    total_jobs = await db.jobs.count_documents({})
    total_applications = await db.applications.count_documents({})
    total_threads = await db.threads.count_documents({})
    total_quizzes = await db.quizzes.count_documents({})
    total_challenges = await db.coding_challenges.count_documents({})
    paid = await db.payment_transactions.aggregate([
        {"$match": {"payment_status": "paid"}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}, "count": {"$sum": 1}}},
    ]).to_list(1)
    revenue = paid[0]["total"] if paid else 0
    paid_count = paid[0]["count"] if paid else 0
    return {
        "users": {"total": total_users, "students": students, "trainers": trainers, "recruiters": recruiters, "admins": admins},
        "courses": total_courses, "enrollments": total_enrollments,
        "jobs": total_jobs, "applications": total_applications,
        "threads": total_threads, "quizzes": total_quizzes, "challenges": total_challenges,
        "revenue": revenue, "transactions": paid_count,
    }


async def _analytics_payload():
    stats = await _platform_stats()
    pipeline = [
        {"$group": {"_id": {"$substr": ["$created_at", 0, 10]}, "count": {"$sum": 1}}},
        {"$sort": {"_id": 1}}, {"$limit": 30},
    ]
    growth = await db.users.aggregate(pipeline).to_list(40)
    by_cat = await db.courses.aggregate([
        {"$group": {"_id": "$category", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
    ]).to_list(20)
    by_role = [
        {"role": "student", "count": stats["users"]["students"]},
        {"role": "trainer", "count": stats["users"]["trainers"]},
        {"role": "recruiter", "count": stats["users"]["recruiters"]},
        {"role": "admin", "count": stats["users"]["admins"]},
    ]
    revenue_by_day = await db.payment_transactions.aggregate([
        {"$match": {"payment_status": "paid"}},
        {"$group": {"_id": {"$substr": ["$created_at", 0, 10]}, "total": {"$sum": "$amount"}}},
        {"$sort": {"_id": 1}}, {"$limit": 30},
    ]).to_list(40)
    return {
        "stats": stats,
        "user_growth": [{"date": g["_id"], "count": g["count"]} for g in growth],
        "courses_by_category": [{"category": c["_id"] or "Uncategorized", "count": c["count"]} for c in by_cat],
        "users_by_role": by_role,
        "revenue_by_day": [{"date": r["_id"], "amount": r["total"]} for r in revenue_by_day],
    }


# =========================================================================
# Models
# =========================================================================
class UserCreate(BaseModel):
    email: EmailStr
    name: str
    role: str = "student"  # student | trainer | recruiter | admin
    password: str


class UserUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    is_premium: Optional[bool] = None


class CourseUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    level: Optional[str] = None
    price: Optional[float] = None
    thumbnail: Optional[str] = None
    is_premium: Optional[bool] = None
    tags: Optional[list] = None


class JobCreate(BaseModel):
    title: str
    company: str
    description: str
    location: str = "Remote"
    job_type: str = "Full-time"
    experience: str = "Entry"
    salary_min: int = 0
    salary_max: int = 0
    requirements: list = []
    skills: list = []
    apply_url: str = ""


class ThreadAction(BaseModel):
    pinned: Optional[bool] = None
    locked: Optional[bool] = None


class ChallengeCreate(BaseModel):
    title: str
    description: str
    difficulty: str = "easy"   # easy | medium | hard
    language: str = "python"
    starter_code: str = ""
    test_cases: list = []      # [{input, expected_output}]


# =========================================================================
# CRUD impl (shared) — admin role required; SA inherits via wrappers below
# =========================================================================
async def _list_users(q: Optional[str], role: Optional[str]):
    # Defensive: hard-exclude any SuperAdmin/system docs even if they accidentally end up in DB.
    filt = {"role": {"$nin": ["superadmin", "system"]}, "email": {"$ne": SUPERADMIN_EMAIL}}
    if role:
        if role in ("superadmin", "system"):
            return []
        filt["role"] = role
    if q:
        filt["$or"] = [{"email": {"$regex": q, "$options": "i"}}, {"name": {"$regex": q, "$options": "i"}}]
    return await db.users.find(filt, {"_id": 0, "password_hash": 0}).sort("created_at", -1).to_list(2000)


async def _audit(event: str, actor: str, actor_role: str, **extra):
    """Append an immutable audit record. Used by both admin and SA write actions."""
    await db.admin_audit.insert_one({
        "id": str(uuid.uuid4()), "event": event, "actor": actor, "actor_role": actor_role,
        "at": now_iso(), **{k: v for k, v in extra.items() if v is not None},
    })


async def _create_user(payload: UserCreate):
    if await db.users.find_one({"email": payload.email}):
        raise HTTPException(400, "Email already registered")
    if payload.role not in {"student", "trainer", "recruiter", "admin"}:
        raise HTTPException(400, "Invalid role")
    doc = {
        "id": str(uuid.uuid4()), "email": payload.email, "name": payload.name,
        "role": payload.role, "password_hash": hash_password(payload.password),
        "is_premium": False, "banned": False, "created_at": now_iso(),
    }
    await db.users.insert_one(doc)
    doc.pop("password_hash"); doc.pop("_id", None)
    return doc


async def _update_user(uid: str, payload: UserUpdate):
    update = {k: v for k, v in payload.dict(exclude_none=True).items()}
    if "role" in update and update["role"] not in {"student", "trainer", "recruiter", "admin"}:
        raise HTTPException(400, "Invalid role")
    if not update:
        return {"ok": True}
    await db.users.update_one({"id": uid}, {"$set": update})
    return {"ok": True}


# =========================================================================
# /admin/* — visible admin console (require admin role)
# =========================================================================
@router.get("/admin/analytics")
async def admin_analytics(_: UserPublic = Depends(require_role("admin"))):
    return await _analytics_payload()


# --- Users ---
@router.get("/admin/users")
async def admin_list_users(q: Optional[str] = None, role: Optional[str] = None, _: UserPublic = Depends(require_role("admin"))):
    return await _list_users(q, role)


@router.post("/admin/users")
async def admin_create_user(payload: UserCreate, _: UserPublic = Depends(require_role("admin"))):
    return await _create_user(payload)


@router.post("/admin/users")
async def admin_create_user(payload: UserCreate, current: UserPublic = Depends(require_role("admin"))):
    doc = await _create_user(payload)
    await _audit("create_user", current.email, "admin", target=doc["id"], target_role=doc["role"])
    return doc


@router.patch("/admin/users/{uid}")
async def admin_update_user(uid: str, payload: UserUpdate, current: UserPublic = Depends(require_role("admin"))):
    res = await _update_user(uid, payload)
    await _audit("update_user", current.email, "admin", target=uid, fields=list(payload.dict(exclude_none=True).keys()))
    return res


@router.post("/admin/users/{uid}/ban")
async def admin_ban(uid: str, current: UserPublic = Depends(require_role("admin"))):
    await db.users.update_one({"id": uid}, {"$set": {"banned": True}})
    await _audit("ban_user", current.email, "admin", target=uid)
    return {"ok": True}


@router.post("/admin/users/{uid}/unban")
async def admin_unban(uid: str, current: UserPublic = Depends(require_role("admin"))):
    await db.users.update_one({"id": uid}, {"$set": {"banned": False}})
    await _audit("unban_user", current.email, "admin", target=uid)
    return {"ok": True}


@router.delete("/admin/users/{uid}")
async def admin_delete_user(uid: str, current: UserPublic = Depends(require_role("admin"))):
    await db.users.delete_one({"id": uid})
    await _audit("delete_user", current.email, "admin", target=uid)
    return {"ok": True}


@router.delete("/admin/courses/{cid}")
async def admin_delete_course(cid: str, current: UserPublic = Depends(require_role("admin"))):
    await db.courses.delete_one({"id": cid})
    await db.lessons.delete_many({"course_id": cid})
    await db.enrollments.delete_many({"course_id": cid})
    await _audit("delete_course", current.email, "admin", target=cid)
    return {"ok": True}


@router.delete("/admin/jobs/{jid}")
async def admin_delete_job(jid: str, current: UserPublic = Depends(require_role("admin"))):
    await db.jobs.delete_one({"id": jid})
    await db.applications.delete_many({"job_id": jid})
    await _audit("delete_job", current.email, "admin", target=jid)
    return {"ok": True}


@router.delete("/admin/threads/{tid}")
async def admin_delete_thread(tid: str, current: UserPublic = Depends(require_role("admin"))):
    await db.threads.delete_one({"id": tid})
    await db.replies.delete_many({"thread_id": tid})
    await _audit("delete_thread", current.email, "admin", target=tid)
    return {"ok": True}


@router.delete("/admin/challenges/{cid}")
async def admin_delete_challenge(cid: str, current: UserPublic = Depends(require_role("admin"))):
    await db.coding_challenges.delete_one({"id": cid})
    await _audit("delete_challenge", current.email, "admin", target=cid)
    return {"ok": True}


@router.delete("/admin/quizzes/{qid}")
async def admin_delete_quiz(qid: str, current: UserPublic = Depends(require_role("admin"))):
    await db.quizzes.delete_one({"id": qid})
    await db.quiz_attempts.delete_many({"quiz_id": qid})
    await _audit("delete_quiz", current.email, "admin", target=qid)
    return {"ok": True}


@router.get("/admin/audit")
async def admin_audit_list(_: UserPublic = Depends(require_role("admin"))):
    return await db.admin_audit.find({}, {"_id": 0}).sort("at", -1).limit(500).to_list(500)


# --- Courses ---
@router.get("/admin/courses")
async def admin_list_courses(_: UserPublic = Depends(require_role("admin"))):
    return await db.courses.find({}, {"_id": 0}).sort("created_at", -1).to_list(2000)


@router.post("/admin/courses")
async def admin_create_course(payload: dict, _: UserPublic = Depends(require_role("admin"))):
    return await sa_create_course(payload)  # reuse same logic


@router.patch("/admin/courses/{cid}")
async def admin_update_course(cid: str, payload: CourseUpdate, _: UserPublic = Depends(require_role("admin"))):
    update = {k: v for k, v in payload.dict(exclude_none=True).items()}
    if not update: return {"ok": True}
    await db.courses.update_one({"id": cid}, {"$set": update}); return {"ok": True}


@router.delete("/admin/courses/{cid}")
async def admin_delete_course(cid: str, _: UserPublic = Depends(require_role("admin"))):
    await db.courses.delete_one({"id": cid})
    await db.lessons.delete_many({"course_id": cid})
    await db.enrollments.delete_many({"course_id": cid})
    return {"ok": True}


# --- Jobs ---
@router.get("/admin/jobs")
async def admin_list_jobs(_: UserPublic = Depends(require_role("admin"))):
    return await db.jobs.find({}, {"_id": 0}).sort("created_at", -1).to_list(2000)


@router.post("/admin/jobs")
async def admin_create_job(payload: JobCreate, current: UserPublic = Depends(require_role("admin"))):
    doc = {
        "id": str(uuid.uuid4()), **payload.dict(),
        "recruiter_id": current.id, "recruiter_name": current.name,
        "applicants_count": 0, "is_active": True,
        "created_at": now_iso(),
    }
    await db.jobs.insert_one(doc); doc.pop("_id", None)
    return doc


@router.delete("/admin/jobs/{jid}")
async def admin_delete_job(jid: str, _: UserPublic = Depends(require_role("admin"))):
    await db.jobs.delete_one({"id": jid})
    await db.applications.delete_many({"job_id": jid})
    return {"ok": True}


# --- Forum threads ---
@router.get("/admin/threads")
async def admin_list_threads(_: UserPublic = Depends(require_role("admin"))):
    return await db.threads.find({}, {"_id": 0}).sort("created_at", -1).to_list(2000)


@router.post("/admin/threads")
async def admin_create_thread(payload: dict, current: UserPublic = Depends(require_role("admin"))):
    payload["author_id"] = current.id
    payload["author_name"] = current.name
    return await sa_create_thread(payload)  # reuse


@router.patch("/admin/threads/{tid}")
async def admin_update_thread(tid: str, payload: ThreadAction, _: UserPublic = Depends(require_role("admin"))):
    update = {k: v for k, v in payload.dict(exclude_none=True).items()}
    if not update: return {"ok": True}
    await db.threads.update_one({"id": tid}, {"$set": update}); return {"ok": True}


@router.delete("/admin/threads/{tid}")
async def admin_delete_thread(tid: str, _: UserPublic = Depends(require_role("admin"))):
    await db.threads.delete_one({"id": tid})
    await db.replies.delete_many({"thread_id": tid})
    return {"ok": True}


# --- Coding challenges ---
@router.get("/admin/challenges")
async def admin_list_challenges(_: UserPublic = Depends(require_role("admin"))):
    return await db.coding_challenges.find({}, {"_id": 0}).sort("created_at", -1).to_list(2000)


@router.post("/admin/challenges")
async def admin_create_challenge(payload: ChallengeCreate, _: UserPublic = Depends(require_role("admin"))):
    doc = {"id": str(uuid.uuid4()), **payload.dict(), "submissions_count": 0, "created_at": now_iso()}
    await db.coding_challenges.insert_one(doc); doc.pop("_id", None)
    return doc


@router.patch("/admin/challenges/{cid}")
async def admin_update_challenge(cid: str, payload: dict, _: UserPublic = Depends(require_role("admin"))):
    allowed = {"title", "description", "difficulty", "language", "starter_code", "test_cases"}
    update = {k: v for k, v in payload.items() if k in allowed}
    if not update: return {"ok": True}
    await db.coding_challenges.update_one({"id": cid}, {"$set": update}); return {"ok": True}


@router.delete("/admin/challenges/{cid}")
async def admin_delete_challenge(cid: str, _: UserPublic = Depends(require_role("admin"))):
    await db.coding_challenges.delete_one({"id": cid}); return {"ok": True}


# --- Quizzes ---
@router.get("/admin/quizzes")
async def admin_list_quizzes(_: UserPublic = Depends(require_role("admin"))):
    return await db.quizzes.find({}, {"_id": 0}).sort("created_at", -1).to_list(2000)


@router.post("/admin/quizzes")
async def admin_create_quiz(payload: dict, current: UserPublic = Depends(require_role("admin"))):
    payload["created_by"] = current.id
    return await sa_create_quiz(payload)


@router.delete("/admin/quizzes/{qid}")
async def admin_delete_quiz(qid: str, _: UserPublic = Depends(require_role("admin"))):
    await db.quizzes.delete_one({"id": qid})
    await db.quiz_attempts.delete_many({"quiz_id": qid})
    return {"ok": True}


# --- Payments ---
@router.get("/admin/payments")
async def admin_list_payments(_: UserPublic = Depends(require_role("admin"))):
    return await db.payment_transactions.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)


# =========================================================================
# /private/internal/<route>/* — Hidden SuperAdmin (full power)
# =========================================================================
class SALogin(BaseModel):
    email: str
    password: str
    secret: str


@router.post(f"{SA}/auth")
async def sa_login(req: SALogin):
    if req.secret != SUPERADMIN_SECRET:
        raise HTTPException(404, "Not found")
    if req.email != SUPERADMIN_EMAIL or req.password != SUPERADMIN_PASSWORD:
        raise HTTPException(404, "Not found")
    await db["_sa_audit"].insert_one({"event": "sa_login", "at": now_iso()})
    token = create_token({"sub": "superadmin", "email": SUPERADMIN_EMAIL, "scope": "superadmin"}, expires_minutes=240)
    return {"token": token}


@router.get(f"{SA}/audit")
async def sa_audit(_=Depends(require_superadmin)):
    return await db["_sa_audit"].find({}, {"_id": 0}).sort("at", -1).to_list(500)


@router.get(f"{SA}/analytics")
async def sa_analytics(_=Depends(require_superadmin)):
    return await _analytics_payload()


# --- Users (SuperAdmin: includes CREATE) ---
@router.get(f"{SA}/users")
async def sa_list_users(q: Optional[str] = None, role: Optional[str] = None, _=Depends(require_superadmin)):
    return await _list_users(q, role)


@router.post(f"{SA}/users")
async def sa_create_user(payload: UserCreate, _=Depends(require_superadmin)):
    doc = await _create_user(payload)
    await db["_sa_audit"].insert_one({"event": "create_user", "uid": doc["id"], "role": doc["role"], "at": now_iso()})
    return doc


@router.patch(f"{SA}/users/{{uid}}")
async def sa_update_user(uid: str, payload: UserUpdate, _=Depends(require_superadmin)):
    res = await _update_user(uid, payload)
    await db["_sa_audit"].insert_one({"event": "update_user", "uid": uid, "fields": list(payload.dict(exclude_none=True).keys()), "at": now_iso()})
    return res


@router.post(f"{SA}/users/{{uid}}/ban")
async def sa_ban(uid: str, _=Depends(require_superadmin)):
    await db.users.update_one({"id": uid}, {"$set": {"banned": True}})
    await db["_sa_audit"].insert_one({"event": "ban_user", "uid": uid, "at": now_iso()})
    return {"ok": True}


@router.post(f"{SA}/users/{{uid}}/unban")
async def sa_unban(uid: str, _=Depends(require_superadmin)):
    await db.users.update_one({"id": uid}, {"$set": {"banned": False}})
    return {"ok": True}


@router.delete(f"{SA}/users/{{uid}}")
async def sa_delete_user(uid: str, _=Depends(require_superadmin)):
    await db.users.delete_one({"id": uid})
    await db["_sa_audit"].insert_one({"event": "delete_user", "uid": uid, "at": now_iso()})
    return {"ok": True}


# --- Courses (SA: full power) ---
@router.get(f"{SA}/courses")
async def sa_list_courses(_=Depends(require_superadmin)):
    return await db.courses.find({}, {"_id": 0}).sort("created_at", -1).to_list(2000)


@router.post(f"{SA}/courses")
async def sa_create_course(payload: dict, _=Depends(require_superadmin)):
    doc = {
        "id": str(uuid.uuid4()),
        "title": payload.get("title", "Untitled"),
        "description": payload.get("description", ""),
        "category": payload.get("category", "General"),
        "level": payload.get("level", "Beginner"),
        "price": float(payload.get("price", 0)),
        "thumbnail": payload.get("thumbnail", ""),
        "tags": payload.get("tags", []),
        "is_premium": bool(payload.get("is_premium", False)),
        "trainer_id": payload.get("trainer_id", ""),
        "trainer_name": payload.get("trainer_name", "SuperAdmin"),
        "lessons": payload.get("lessons", []),
        "students_count": 0, "rating": 0.0, "reviews_count": 0,
        "created_at": now_iso(),
    }
    await db.courses.insert_one(doc); doc.pop("_id", None)
    return doc


@router.patch(f"{SA}/courses/{{cid}}")
async def sa_update_course(cid: str, payload: CourseUpdate, _=Depends(require_superadmin)):
    update = {k: v for k, v in payload.dict(exclude_none=True).items()}
    if not update: return {"ok": True}
    await db.courses.update_one({"id": cid}, {"$set": update}); return {"ok": True}


@router.delete(f"{SA}/courses/{{cid}}")
async def sa_delete_course(cid: str, _=Depends(require_superadmin)):
    await db.courses.delete_one({"id": cid})
    await db.lessons.delete_many({"course_id": cid})
    await db.enrollments.delete_many({"course_id": cid})
    return {"ok": True}


# --- Jobs (SA: includes ADD) ---
@router.get(f"{SA}/jobs")
async def sa_list_jobs(_=Depends(require_superadmin)):
    return await db.jobs.find({}, {"_id": 0}).sort("created_at", -1).to_list(2000)


@router.post(f"{SA}/jobs")
async def sa_create_job(payload: JobCreate, _=Depends(require_superadmin)):
    doc = {
        "id": str(uuid.uuid4()), **payload.dict(),
        "recruiter_id": "", "recruiter_name": "SuperAdmin",
        "applicants_count": 0, "is_active": True,
        "created_at": now_iso(),
    }
    await db.jobs.insert_one(doc); doc.pop("_id", None)
    return doc


@router.delete(f"{SA}/jobs/{{jid}}")
async def sa_delete_job(jid: str, _=Depends(require_superadmin)):
    await db.jobs.delete_one({"id": jid})
    await db.applications.delete_many({"job_id": jid})
    return {"ok": True}


# --- Forum (SA: includes ADD) ---
@router.get(f"{SA}/threads")
async def sa_list_threads(_=Depends(require_superadmin)):
    return await db.threads.find({}, {"_id": 0}).sort("created_at", -1).to_list(2000)


@router.post(f"{SA}/threads")
async def sa_create_thread(payload: dict, _=Depends(require_superadmin)):
    doc = {
        "id": str(uuid.uuid4()),
        "title": payload.get("title", "Untitled"),
        "content": payload.get("content", ""),
        "category": payload.get("category", "General"),
        "author_id": payload.get("author_id", "system"),
        "author_name": payload.get("author_name", "SuperAdmin"),
        "tags": payload.get("tags", []),
        "upvotes": [], "replies_count": 0,
        "pinned": payload.get("pinned", False), "locked": False,
        "created_at": now_iso(),
    }
    await db.threads.insert_one(doc); doc.pop("_id", None)
    return doc


@router.patch(f"{SA}/threads/{{tid}}")
async def sa_update_thread(tid: str, payload: ThreadAction, _=Depends(require_superadmin)):
    update = {k: v for k, v in payload.dict(exclude_none=True).items()}
    if not update: return {"ok": True}
    await db.threads.update_one({"id": tid}, {"$set": update}); return {"ok": True}


@router.delete(f"{SA}/threads/{{tid}}")
async def sa_delete_thread(tid: str, _=Depends(require_superadmin)):
    await db.threads.delete_one({"id": tid})
    await db.replies.delete_many({"thread_id": tid})
    return {"ok": True}


# --- Coding challenges (SA: includes ADD) ---
@router.get(f"{SA}/challenges")
async def sa_list_challenges(_=Depends(require_superadmin)):
    return await db.coding_challenges.find({}, {"_id": 0}).sort("created_at", -1).to_list(2000)


@router.post(f"{SA}/challenges")
async def sa_create_challenge(payload: ChallengeCreate, _=Depends(require_superadmin)):
    doc = {"id": str(uuid.uuid4()), **payload.dict(), "submissions_count": 0, "created_at": now_iso()}
    await db.coding_challenges.insert_one(doc); doc.pop("_id", None)
    return doc


@router.patch(f"{SA}/challenges/{{cid}}")
async def sa_update_challenge(cid: str, payload: dict, _=Depends(require_superadmin)):
    allowed = {"title", "description", "difficulty", "language", "starter_code", "test_cases"}
    update = {k: v for k, v in payload.items() if k in allowed}
    if not update: return {"ok": True}
    await db.coding_challenges.update_one({"id": cid}, {"$set": update}); return {"ok": True}


@router.delete(f"{SA}/challenges/{{cid}}")
async def sa_delete_challenge(cid: str, _=Depends(require_superadmin)):
    await db.coding_challenges.delete_one({"id": cid}); return {"ok": True}


# --- Quizzes (SA: includes ADD) ---
@router.get(f"{SA}/quizzes")
async def sa_list_quizzes(_=Depends(require_superadmin)):
    return await db.quizzes.find({}, {"_id": 0}).sort("created_at", -1).to_list(2000)


@router.post(f"{SA}/quizzes")
async def sa_create_quiz(payload: dict, _=Depends(require_superadmin)):
    doc = {
        "id": str(uuid.uuid4()),
        "title": payload.get("title", "Untitled Quiz"),
        "description": payload.get("description", ""),
        "course_id": payload.get("course_id", ""),
        "duration_min": int(payload.get("duration_min", 10)),
        "questions": payload.get("questions", []),
        "created_by": payload.get("created_by", "superadmin"),
        "created_at": now_iso(),
    }
    await db.quizzes.insert_one(doc); doc.pop("_id", None)
    return doc


@router.delete(f"{SA}/quizzes/{{qid}}")
async def sa_delete_quiz(qid: str, _=Depends(require_superadmin)):
    await db.quizzes.delete_one({"id": qid})
    await db.quiz_attempts.delete_many({"quiz_id": qid})
    return {"ok": True}


# --- Payments (SA: list only on free tier) ---
@router.get(f"{SA}/payments")
async def sa_list_payments(_=Depends(require_superadmin)):
    return await db.payment_transactions.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
