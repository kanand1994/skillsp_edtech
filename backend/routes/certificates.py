"""Certificates — viral sharable proof-of-completion.

A certificate is issued ONCE per (user_id, source_type, source_id) combination.
Sources:
  - course      → user reached 100% progress on a course
  - quiz        → user scored ≥ 70% on any quiz attempt

Certificates are PUBLIC by URL (`/api/certificates/verify/{id}`) — anyone with the
id can verify authenticity. We bake the issuer's referral_code into the public
payload so the share page can include "Get 10% off — claim with code XXXXXX".
"""
import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from db import db, now_iso
from auth import get_current_user, UserPublic
from routes.referrals import code_for_user

router = APIRouter(prefix="/certificates", tags=["certificates"])


def _credential_id() -> str:
    return f"SKL-{uuid.uuid4().hex[:10].upper()}"


async def _issue_cert(
    user_id: str,
    user_name: str,
    source_type: str,         # "course" | "quiz"
    source_id: str,
    source_title: str,
    instructor_name: str = "",
    skills: Optional[list] = None,
    score: Optional[int] = None,
) -> dict:
    """Idempotent issue. Returns existing cert if already issued for this (user, source)."""
    existing = await db.certificates.find_one(
        {"user_id": user_id, "source_type": source_type, "source_id": source_id},
        {"_id": 0},
    )
    if existing:
        return existing
    cert = {
        "id": str(uuid.uuid4()),
        "credential_id": _credential_id(),
        "user_id": user_id,
        "user_name": user_name,
        "source_type": source_type,
        "source_id": source_id,
        "source_title": source_title,
        "instructor_name": instructor_name,
        "skills": skills or [],
        "score": score,
        "issued_at": now_iso(),
    }
    await db.certificates.insert_one(cert)
    cert.pop("_id", None)
    return cert


async def issue_course_certificate(user_id: str, course_id: str) -> Optional[dict]:
    """Hook called from courses.py when progress reaches 100%."""
    course = await db.courses.find_one({"id": course_id})
    if not course:
        return None
    user = await db.users.find_one({"id": user_id}, {"name": 1})
    if not user:
        return None
    return await _issue_cert(
        user_id=user_id,
        user_name=user.get("name", "Student"),
        source_type="course",
        source_id=course_id,
        source_title=course.get("title", "Course"),
        instructor_name=course.get("trainer_name", ""),
        skills=course.get("tags") or [course.get("category", "General")],
    )


async def issue_quiz_certificate(user_id: str, quiz_id: str, score: int) -> Optional[dict]:
    """Hook called from learning.py when a quiz is passed (score ≥ 70)."""
    if score < 70:
        return None
    quiz = await db.quizzes.find_one({"id": quiz_id})
    if not quiz:
        return None
    user = await db.users.find_one({"id": user_id}, {"name": 1})
    if not user:
        return None
    instructor_name = ""
    skills = []
    if quiz.get("course_id"):
        course = await db.courses.find_one({"id": quiz["course_id"]}, {"trainer_name": 1, "category": 1, "tags": 1})
        if course:
            instructor_name = course.get("trainer_name", "")
            skills = course.get("tags") or [course.get("category", "Knowledge")]
    return await _issue_cert(
        user_id=user_id,
        user_name=user.get("name", "Student"),
        source_type="quiz",
        source_id=quiz_id,
        source_title=quiz.get("title", "Quiz"),
        instructor_name=instructor_name,
        skills=skills,
        score=score,
    )


# ----- Public verification endpoint --------------------------------------------
@router.get("/verify/{cert_id}")
async def verify_certificate(cert_id: str):
    """PUBLIC — anyone with the id can verify a certificate.

    Embeds the issuer's referral_code so the share page can drive sign-ups.
    """
    cert = await db.certificates.find_one({"id": cert_id}, {"_id": 0})
    if not cert:
        raise HTTPException(404, "Certificate not found or revoked")
    user = await db.users.find_one({"id": cert["user_id"]}, {"avatar": 1, "id": 1})
    return {
        **cert,
        "referrer_code": code_for_user(cert["user_id"]),
        "user_avatar": (user or {}).get("avatar"),
        "verified": True,
        "issuer": "SkillSphere",
    }


# ----- Authed endpoints --------------------------------------------------------
@router.get("/me")
async def my_certificates(user: UserPublic = Depends(get_current_user)):
    certs = await db.certificates.find({"user_id": user.id}, {"_id": 0}).sort("issued_at", -1).to_list(200)
    return certs
