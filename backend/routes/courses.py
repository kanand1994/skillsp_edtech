"""Courses, lessons, enrollments, progress."""
import uuid
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from db import db, now_iso
from auth import get_current_user, require_role, UserPublic
from email_service import email_enrollment
import asyncio

router = APIRouter(prefix="/courses", tags=["courses"])


class LessonIn(BaseModel):
    title: str
    description: str = ""
    video_url: str = ""
    duration_min: int = 0
    resource_url: str = ""


class CourseCreate(BaseModel):
    title: str
    description: str
    category: str
    level: str = "Beginner"
    price: float = 0.0
    thumbnail: str = ""
    tags: List[str] = []
    is_premium: bool = False
    lessons: List[LessonIn] = []


class CourseOut(BaseModel):
    id: str
    title: str
    description: str = ""
    category: str = "General"
    level: str = "Beginner"
    price: float = 0.0
    thumbnail: str = ""
    tags: List[str] = []
    is_premium: bool = False
    trainer_id: str = ""
    trainer_name: str = ""
    lessons: List[dict] = []
    rating: float = 0.0
    reviews_count: int = 0
    students_count: int = 0
    created_at: str = ""


async def _course_to_out(doc: dict) -> CourseOut:
    return CourseOut(**{k: doc.get(k) for k in CourseOut.model_fields.keys() if doc.get(k) is not None})


@router.post("", response_model=CourseOut)
async def create_course(req: CourseCreate, user: UserPublic = Depends(require_role("trainer", "admin"))):
    cid = str(uuid.uuid4())
    lessons = [{"id": str(uuid.uuid4()), **l.model_dump()} for l in req.lessons]
    doc = {
        "id": cid, **req.model_dump(exclude={"lessons"}),
        "lessons": lessons,
        "trainer_id": user.id, "trainer_name": user.name,
        "rating": 0.0, "reviews_count": 0, "students_count": 0,
        "created_at": now_iso(),
    }
    await db.courses.insert_one(doc)
    return await _course_to_out(doc)


@router.get("", response_model=List[CourseOut])
async def list_courses(
    q: Optional[str] = None,
    category: Optional[str] = None,
    level: Optional[str] = None,
    trainer_id: Optional[str] = None,
):
    filt: dict = {}
    if q:
        filt["$or"] = [
            {"title": {"$regex": q, "$options": "i"}},
            {"description": {"$regex": q, "$options": "i"}},
        ]
    if category: filt["category"] = category
    if level: filt["level"] = level
    if trainer_id: filt["trainer_id"] = trainer_id
    docs = await db.courses.find(filt, {"_id": 0}).sort("created_at", -1).to_list(200)
    return [await _course_to_out(d) for d in docs]


@router.get("/categories")
async def categories():
    cats = await db.courses.distinct("category")
    return {"categories": cats}


@router.get("/{course_id}", response_model=CourseOut)
async def get_course(course_id: str):
    doc = await db.courses.find_one({"id": course_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Course not found")
    return await _course_to_out(doc)


@router.put("/{course_id}", response_model=CourseOut)
async def update_course(course_id: str, req: CourseCreate, user: UserPublic = Depends(require_role("trainer", "admin"))):
    doc = await db.courses.find_one({"id": course_id})
    if not doc:
        raise HTTPException(404, "Not found")
    if user.role != "admin" and doc["trainer_id"] != user.id:
        raise HTTPException(403, "Not your course")
    lessons = [{"id": str(uuid.uuid4()), **l.model_dump()} for l in req.lessons]
    update = {**req.model_dump(exclude={"lessons"}), "lessons": lessons}
    await db.courses.update_one({"id": course_id}, {"$set": update})
    fresh = await db.courses.find_one({"id": course_id}, {"_id": 0})
    return await _course_to_out(fresh)


@router.delete("/{course_id}")
async def delete_course(course_id: str, user: UserPublic = Depends(require_role("trainer", "admin"))):
    doc = await db.courses.find_one({"id": course_id})
    if not doc:
        raise HTTPException(404, "Not found")
    if user.role != "admin" and doc["trainer_id"] != user.id:
        raise HTTPException(403, "Not your course")
    await db.courses.delete_one({"id": course_id})
    await db.enrollments.delete_many({"course_id": course_id})
    return {"ok": True}


# ============ Enrollments ============

@router.post("/{course_id}/enroll")
async def enroll(course_id: str, user: UserPublic = Depends(get_current_user)):
    course = await db.courses.find_one({"id": course_id})
    if not course:
        raise HTTPException(404, "Course not found")
    if course.get("is_premium") and not user.is_premium and course.get("price", 0) > 0:
        # require payment via Stripe — but free enroll allowed if user is premium
        if not user.is_premium:
            raise HTTPException(402, "Premium course requires payment or premium plan")
    existing = await db.enrollments.find_one({"user_id": user.id, "course_id": course_id})
    if existing:
        return {"ok": True, "already_enrolled": True}
    await db.enrollments.insert_one({
        "id": str(uuid.uuid4()), "user_id": user.id, "course_id": course_id,
        "progress_pct": 0, "completed_lessons": [], "created_at": now_iso(),
    })
    await db.courses.update_one({"id": course_id}, {"$inc": {"students_count": 1}})
    asyncio.create_task(email_enrollment(user.email, user.name, course["title"]))
    from routes.gamification import award_xp
    await award_xp(user.id, "course_enroll", ref_id=course_id)
    return {"ok": True}


@router.get("/me/enrolled", response_model=List[CourseOut])
async def my_enrolled(user: UserPublic = Depends(get_current_user)):
    enrolls = await db.enrollments.find({"user_id": user.id}).to_list(500)
    ids = [e["course_id"] for e in enrolls]
    docs = await db.courses.find({"id": {"$in": ids}}, {"_id": 0}).to_list(500)
    return [await _course_to_out(d) for d in docs]


class ProgressUpdate(BaseModel):
    lesson_id: str
    completed: bool = True


@router.post("/{course_id}/progress")
async def update_progress(course_id: str, req: ProgressUpdate, user: UserPublic = Depends(get_current_user)):
    course = await db.courses.find_one({"id": course_id})
    if not course:
        raise HTTPException(404, "Not found")
    total = max(len(course.get("lessons", [])), 1)
    enrollment = await db.enrollments.find_one({"user_id": user.id, "course_id": course_id})
    if not enrollment:
        raise HTTPException(404, "Not enrolled")
    completed = set(enrollment.get("completed_lessons", []))
    if req.completed:
        completed.add(req.lesson_id)
    else:
        completed.discard(req.lesson_id)
    pct = round(len(completed) / total * 100)
    await db.enrollments.update_one(
        {"id": enrollment["id"]},
        {"$set": {"completed_lessons": list(completed), "progress_pct": pct}},
    )
    # Award XP for lesson + course completion (idempotent on ref_id)
    from routes.gamification import award_xp
    if req.completed:
        await award_xp(user.id, "lesson_complete", ref_id=req.lesson_id)
    if pct >= 100:
        await award_xp(user.id, "course_complete", ref_id=course_id)
        # Auto-issue shareable certificate (idempotent)
        from routes.certificates import issue_course_certificate
        await issue_course_certificate(user.id, course_id)
    return {"progress_pct": pct, "completed_lessons": list(completed)}


@router.get("/{course_id}/progress")
async def get_progress(course_id: str, user: UserPublic = Depends(get_current_user)):
    enrollment = await db.enrollments.find_one(
        {"user_id": user.id, "course_id": course_id}, {"_id": 0}
    )
    if not enrollment:
        return {"enrolled": False, "progress_pct": 0, "completed_lessons": []}
    return {"enrolled": True, **{k: enrollment.get(k) for k in ["progress_pct", "completed_lessons"]}}


# ============ Reviews ============
class ReviewIn(BaseModel):
    rating: int = Field(ge=1, le=5)
    comment: str = ""


@router.post("/{course_id}/reviews")
async def add_review(course_id: str, req: ReviewIn, user: UserPublic = Depends(get_current_user)):
    course = await db.courses.find_one({"id": course_id})
    if not course:
        raise HTTPException(404, "Not found")
    rev = {
        "id": str(uuid.uuid4()), "course_id": course_id, "user_id": user.id,
        "user_name": user.name, "rating": req.rating, "comment": req.comment,
        "created_at": now_iso(),
    }
    await db.reviews.insert_one(rev)
    all_reviews = await db.reviews.find({"course_id": course_id}).to_list(1000)
    avg = sum(r["rating"] for r in all_reviews) / len(all_reviews)
    await db.courses.update_one(
        {"id": course_id},
        {"$set": {"rating": round(avg, 1), "reviews_count": len(all_reviews)}},
    )
    rev.pop("_id", None)
    return rev


@router.get("/{course_id}/reviews")
async def list_reviews(course_id: str):
    revs = await db.reviews.find({"course_id": course_id}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return revs


# ============ Certificate ============
@router.get("/{course_id}/certificate")
async def certificate(course_id: str, user: UserPublic = Depends(get_current_user)):
    enrollment = await db.enrollments.find_one({"user_id": user.id, "course_id": course_id})
    if not enrollment or enrollment.get("progress_pct", 0) < 100:
        raise HTTPException(400, "Course not completed")
    course = await db.courses.find_one({"id": course_id})
    cert = await db.certificates.find_one({"user_id": user.id, "course_id": course_id}, {"_id": 0})
    if cert:
        return cert
    cert = {
        "id": str(uuid.uuid4()), "user_id": user.id, "user_name": user.name,
        "course_id": course_id, "course_title": course["title"],
        "issued_at": now_iso(), "credential_id": f"SKL-{uuid.uuid4().hex[:8].upper()}",
    }
    await db.certificates.insert_one(cert)
    cert.pop("_id", None)
    return cert


@router.get("/me/certificates")
async def my_certs(user: UserPublic = Depends(get_current_user)):
    certs = await db.certificates.find({"user_id": user.id}, {"_id": 0}).to_list(200)
    return certs
