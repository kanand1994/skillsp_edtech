"""Jobs and applications portal."""
import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from db import db, now_iso
from auth import get_current_user, require_role, UserPublic
from email_service import email_application_status, email_new_application
import asyncio

router = APIRouter(prefix="/jobs", tags=["jobs"])


class JobCreate(BaseModel):
    title: str
    company: str
    location: str = "Remote"
    job_type: str = "Full-time"  # Full-time, Part-time, Internship, Contract
    experience: str = "Entry"
    salary_min: int = 0
    salary_max: int = 0
    description: str
    requirements: List[str] = []
    skills: List[str] = []
    apply_url: str = ""


class JobOut(BaseModel):
    id: str
    title: str
    company: str = ""
    location: str = "Remote"
    job_type: str = "Full-time"
    experience: str = "Entry"
    salary_min: int = 0
    salary_max: int = 0
    description: str = ""
    requirements: List[str] = []
    skills: List[str] = []
    apply_url: str = ""
    recruiter_id: str = ""
    recruiter_name: str = ""
    applicants_count: int = 0
    created_at: str = ""


@router.post("", response_model=JobOut)
async def create_job(req: JobCreate, user: UserPublic = Depends(require_role("recruiter", "admin"))):
    jid = str(uuid.uuid4())
    doc = {
        "id": jid, **req.model_dump(),
        "recruiter_id": user.id, "recruiter_name": user.name,
        "applicants_count": 0, "created_at": now_iso(),
    }
    await db.jobs.insert_one(doc)
    doc.pop("_id", None)
    return JobOut(**doc)


@router.get("", response_model=List[JobOut])
async def list_jobs(q: Optional[str] = None, job_type: Optional[str] = None, location: Optional[str] = None, recruiter_id: Optional[str] = None):
    filt: dict = {}
    if q:
        filt["$or"] = [
            {"title": {"$regex": q, "$options": "i"}},
            {"company": {"$regex": q, "$options": "i"}},
            {"skills": {"$regex": q, "$options": "i"}},
        ]
    if job_type: filt["job_type"] = job_type
    if location: filt["location"] = {"$regex": location, "$options": "i"}
    if recruiter_id: filt["recruiter_id"] = recruiter_id
    docs = await db.jobs.find(filt, {"_id": 0}).sort("created_at", -1).to_list(200)
    return [JobOut(**{k: v for k, v in d.items() if k in JobOut.model_fields}) for d in docs]


@router.get("/{job_id}", response_model=JobOut)
async def get_job(job_id: str):
    doc = await db.jobs.find_one({"id": job_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Job not found")
    return JobOut(**doc)


@router.delete("/{job_id}")
async def delete_job(job_id: str, user: UserPublic = Depends(require_role("recruiter", "admin"))):
    doc = await db.jobs.find_one({"id": job_id})
    if not doc:
        raise HTTPException(404, "Not found")
    if user.role != "admin" and doc["recruiter_id"] != user.id:
        raise HTTPException(403, "Forbidden")
    await db.jobs.delete_one({"id": job_id})
    return {"ok": True}


# ============ APPLICATIONS ============
class ApplyIn(BaseModel):
    resume_url: str = ""
    cover_letter: str = ""


@router.post("/{job_id}/apply")
async def apply(job_id: str, req: ApplyIn, user: UserPublic = Depends(get_current_user)):
    job = await db.jobs.find_one({"id": job_id})
    if not job:
        raise HTTPException(404, "Job not found")
    existing = await db.applications.find_one({"job_id": job_id, "user_id": user.id})
    if existing:
        return {"ok": True, "already_applied": True}
    app = {
        "id": str(uuid.uuid4()), "job_id": job_id, "job_title": job["title"],
        "company": job["company"], "user_id": user.id, "user_name": user.name,
        "user_email": user.email, "resume_url": req.resume_url, "cover_letter": req.cover_letter,
        "status": "applied", "created_at": now_iso(),
    }
    await db.applications.insert_one(app)
    await db.jobs.update_one({"id": job_id}, {"$inc": {"applicants_count": 1}})
    # Notify recruiter
    recruiter = await db.users.find_one({"id": job["recruiter_id"]})
    if recruiter:
        asyncio.create_task(email_new_application(recruiter["email"], recruiter["name"], user.name, job["title"]))
    asyncio.create_task(email_application_status(user.email, user.name, job["title"], job["company"], "applied"))
    return {"ok": True}


@router.get("/me/applications")
async def my_applications(user: UserPublic = Depends(get_current_user)):
    apps = await db.applications.find({"user_id": user.id}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return apps


@router.get("/{job_id}/applications")
async def job_applications(job_id: str, user: UserPublic = Depends(require_role("recruiter", "admin"))):
    job = await db.jobs.find_one({"id": job_id})
    if not job:
        raise HTTPException(404, "Not found")
    if user.role != "admin" and job["recruiter_id"] != user.id:
        raise HTTPException(403, "Forbidden")
    apps = await db.applications.find({"job_id": job_id}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return apps


class AppStatus(BaseModel):
    status: str  # applied, shortlisted, interview, rejected, hired


@router.put("/applications/{app_id}/status")
async def set_status(app_id: str, req: AppStatus, user: UserPublic = Depends(require_role("recruiter", "admin"))):
    a = await db.applications.find_one({"id": app_id})
    if not a:
        raise HTTPException(404, "Not found")
    await db.applications.update_one({"id": app_id}, {"$set": {"status": req.status}})
    # Email candidate about status change
    candidate = await db.users.find_one({"id": a["user_id"]})
    if candidate:
        asyncio.create_task(email_application_status(candidate["email"], candidate["name"], a["job_title"], a["company"], req.status))
    return {"ok": True}
