"""Quizzes, assignments, projects."""
import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from db import db, now_iso
from auth import get_current_user, require_role, UserPublic

router = APIRouter(tags=["learning"])


# ============ QUIZZES ============
class QuizQuestion(BaseModel):
    question: str
    options: List[str]
    correct_index: int


class QuizCreate(BaseModel):
    course_id: Optional[str] = None
    title: str
    description: str = ""
    duration_min: int = 10
    questions: List[QuizQuestion]


@router.post("/quizzes")
async def create_quiz(req: QuizCreate, user: UserPublic = Depends(require_role("trainer", "admin"))):
    qid = str(uuid.uuid4())
    questions = [{"id": str(uuid.uuid4()), **q.model_dump()} for q in req.questions]
    doc = {
        "id": qid, "course_id": req.course_id, "title": req.title, "description": req.description,
        "duration_min": req.duration_min, "questions": questions,
        "trainer_id": user.id, "created_at": now_iso(),
    }
    await db.quizzes.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.get("/quizzes")
async def list_quizzes(course_id: Optional[str] = None):
    filt = {"course_id": course_id} if course_id else {}
    docs = await db.quizzes.find(filt, {"_id": 0}).sort("created_at", -1).to_list(200)
    # Strip correct_index for students
    for d in docs:
        for q in d.get("questions", []):
            q.pop("correct_index", None)
    return docs


@router.get("/quizzes/{quiz_id}")
async def get_quiz(quiz_id: str):
    doc = await db.quizzes.find_one({"id": quiz_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Quiz not found")
    for q in doc.get("questions", []):
        q.pop("correct_index", None)
    return doc


class QuizSubmission(BaseModel):
    answers: List[int]  # selected option index per question, -1 if skipped


@router.post("/quizzes/{quiz_id}/submit")
async def submit_quiz(quiz_id: str, req: QuizSubmission, user: UserPublic = Depends(get_current_user)):
    quiz = await db.quizzes.find_one({"id": quiz_id})
    if not quiz:
        raise HTTPException(404, "Not found")
    qs = quiz["questions"]
    if len(req.answers) != len(qs):
        raise HTTPException(400, "Answer count mismatch")
    correct = sum(1 for i, a in enumerate(req.answers) if a == qs[i]["correct_index"])
    score = round((correct / len(qs)) * 100)
    attempt = {
        "id": str(uuid.uuid4()), "quiz_id": quiz_id, "user_id": user.id,
        "user_name": user.name, "score": score, "correct": correct, "total": len(qs),
        "answers": req.answers, "submitted_at": now_iso(),
    }
    await db.quiz_attempts.insert_one(attempt)
    from routes.gamification import award_xp
    if score >= 90:
        await award_xp(user.id, "quiz_pass_90", ref_id=quiz_id)
    elif score >= 70:
        await award_xp(user.id, "quiz_pass_70", ref_id=quiz_id)
    # Auto-issue shareable certificate for quiz pass (idempotent, ≥70 only)
    cert = None
    if score >= 70:
        from routes.certificates import issue_quiz_certificate
        cert = await issue_quiz_certificate(user.id, quiz_id, score)
    return {"score": score, "correct": correct, "total": len(qs), "certificate_id": cert.get("id") if cert else None}


@router.get("/quizzes/{quiz_id}/leaderboard")
async def leaderboard(quiz_id: str):
    attempts = await db.quiz_attempts.find({"quiz_id": quiz_id}, {"_id": 0}).sort("score", -1).to_list(100)
    seen = {}
    for a in attempts:
        if a["user_id"] not in seen or a["score"] > seen[a["user_id"]]["score"]:
            seen[a["user_id"]] = a
    board = sorted(seen.values(), key=lambda x: -x["score"])[:20]
    return board


@router.get("/quizzes/me/attempts")
async def my_attempts(user: UserPublic = Depends(get_current_user)):
    attempts = await db.quiz_attempts.find({"user_id": user.id}, {"_id": 0}).sort("submitted_at", -1).to_list(200)
    return attempts


# ============ ASSIGNMENTS ============
class AssignmentCreate(BaseModel):
    course_id: str
    title: str
    description: str
    max_marks: int = 100
    due_at: Optional[str] = None


@router.post("/assignments")
async def create_assignment(req: AssignmentCreate, user: UserPublic = Depends(require_role("trainer", "admin"))):
    doc = {
        "id": str(uuid.uuid4()), **req.model_dump(),
        "trainer_id": user.id, "created_at": now_iso(),
    }
    await db.assignments.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.get("/assignments")
async def list_assignments(course_id: Optional[str] = None):
    filt = {"course_id": course_id} if course_id else {}
    return await db.assignments.find(filt, {"_id": 0}).sort("created_at", -1).to_list(200)


class SubmissionIn(BaseModel):
    github_url: Optional[str] = None
    file_url: Optional[str] = None
    live_url: Optional[str] = None
    notes: str = ""


@router.post("/assignments/{aid}/submit")
async def submit_assignment(aid: str, req: SubmissionIn, user: UserPublic = Depends(get_current_user)):
    a = await db.assignments.find_one({"id": aid})
    if not a:
        raise HTTPException(404, "Not found")
    sub = {
        "id": str(uuid.uuid4()), "assignment_id": aid, "user_id": user.id,
        "user_name": user.name, **req.model_dump(),
        "marks": None, "feedback": None, "status": "submitted",
        "submitted_at": now_iso(),
    }
    await db.submissions.update_one(
        {"assignment_id": aid, "user_id": user.id},
        {"$set": sub},
        upsert=True,
    )
    return {"ok": True, "submission": sub}


@router.get("/assignments/{aid}/submissions")
async def get_submissions(aid: str, user: UserPublic = Depends(require_role("trainer", "admin"))):
    subs = await db.submissions.find({"assignment_id": aid}, {"_id": 0}).to_list(500)
    return subs


@router.get("/assignments/me/submissions")
async def my_submissions(user: UserPublic = Depends(get_current_user)):
    subs = await db.submissions.find({"user_id": user.id}, {"_id": 0}).sort("submitted_at", -1).to_list(200)
    return subs


class GradeIn(BaseModel):
    marks: int
    feedback: str = ""


@router.post("/submissions/{sid}/grade")
async def grade_submission(sid: str, req: GradeIn, user: UserPublic = Depends(require_role("trainer", "admin"))):
    res = await db.submissions.update_one(
        {"id": sid},
        {"$set": {"marks": req.marks, "feedback": req.feedback, "status": "graded"}},
    )
    if not res.matched_count:
        raise HTTPException(404, "Not found")
    return {"ok": True}


# ============ PROJECTS (portfolio showcase) ============
class ProjectIn(BaseModel):
    title: str
    description: str
    github_url: str = ""
    live_url: str = ""
    image_url: str = ""
    tech_stack: List[str] = []


@router.post("/projects")
async def create_project(req: ProjectIn, user: UserPublic = Depends(get_current_user)):
    doc = {
        "id": str(uuid.uuid4()), **req.model_dump(),
        "user_id": user.id, "user_name": user.name, "created_at": now_iso(),
    }
    await db.projects.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.get("/projects")
async def list_projects(user_id: Optional[str] = None):
    filt = {"user_id": user_id} if user_id else {}
    return await db.projects.find(filt, {"_id": 0}).sort("created_at", -1).to_list(200)


@router.delete("/projects/{pid}")
async def delete_project(pid: str, user: UserPublic = Depends(get_current_user)):
    doc = await db.projects.find_one({"id": pid})
    if not doc:
        raise HTTPException(404, "Not found")
    if doc["user_id"] != user.id and user.role != "admin":
        raise HTTPException(403, "Forbidden")
    await db.projects.delete_one({"id": pid})
    return {"ok": True}
