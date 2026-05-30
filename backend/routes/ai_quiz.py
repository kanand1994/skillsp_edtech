"""AI-powered quiz generator — extracts questions from course content via fallback LLM chain."""
import json
import os
import re
import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from emergentintegrations.llm.chat import LlmChat, UserMessage
from db import db, now_iso
from auth import get_current_user, require_role, UserPublic

router = APIRouter(prefix="/ai-quiz", tags=["ai-quiz"])

EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")
FALLBACK_CHAIN = [
    ("openai", "gpt-5.2"),
    ("anthropic", "claude-sonnet-4-5-20250929"),
    ("gemini", "gemini-3-flash-preview"),
]

SYSTEM_PROMPT = (
    "You are SkillSphere's quiz designer. Generate high-quality multiple-choice quiz questions "
    "from the provided source material. STRICT OUTPUT: return ONLY a JSON array (no markdown, no preface) "
    "of objects with this exact shape: "
    '[{"question": "string", "options": ["A","B","C","D"], "correct_index": 0, "explanation": "string"}] '
    "Rules: 4 options each, exactly one correct, correct_index in [0,3]. Use plausible distractors. "
    "Difficulty should match the requested level. Vary topics across the material."
)


def _extract_json(text: str):
    """LLMs sometimes wrap JSON in code fences — strip them."""
    text = text.strip()
    m = re.search(r"```(?:json)?\s*(\[.*?\])\s*```", text, re.DOTALL)
    if m:
        text = m.group(1)
    # fallback: first [..] block
    if not text.startswith("["):
        m2 = re.search(r"(\[.*\])", text, re.DOTALL)
        if m2: text = m2.group(1)
    return json.loads(text)


async def _try_chain(session_id: str, system_message: str, user_text: str):
    if not EMERGENT_LLM_KEY:
        raise HTTPException(503, "AI service is not configured (EMERGENT_LLM_KEY missing)")
    last_err = None
    for provider, model in FALLBACK_CHAIN:
        try:
            chat = LlmChat(api_key=EMERGENT_LLM_KEY, session_id=session_id, system_message=system_message).with_model(provider, model)
            reply = await chat.send_message(UserMessage(text=user_text))
            return reply, provider, model
        except Exception as e:
            last_err = e
            continue
    raise HTTPException(503, f"All AI providers failed: {last_err}")


class GenerateRequest(BaseModel):
    course_id: Optional[str] = None
    source_text: Optional[str] = None  # raw content if no course
    num_questions: int = Field(5, ge=1, le=20)
    difficulty: str = "Medium"  # Easy | Medium | Hard
    title: Optional[str] = None
    save: bool = True  # if true, persist as a real quiz in db.quizzes


def _gather_course_content(course: dict) -> str:
    parts = [f"# {course.get('title', '')}", course.get("description", "") or ""]
    for l in course.get("lessons", []) or []:
        parts.append(f"## Lesson: {l.get('title', '')}")
        if l.get("description"):
            parts.append(l["description"])
    return "\n\n".join(p for p in parts if p)


@router.post("/generate")
async def generate_quiz(
    req: GenerateRequest,
    user: UserPublic = Depends(require_role("trainer", "admin")),
):
    if not req.source_text and not req.course_id:
        raise HTTPException(400, "Provide either source_text or course_id")

    course = None
    source = req.source_text or ""
    if req.course_id:
        course = await db.courses.find_one({"id": req.course_id}, {"_id": 0})
        if not course:
            raise HTTPException(404, "Course not found")
        # Ownership check: trainers can only generate for their own courses
        if user.role != "admin" and course.get("trainer_id") != user.id:
            raise HTTPException(403, "You can only generate quizzes for your own courses")
        if not source:
            source = _gather_course_content(course)
        if not source.strip():
            raise HTTPException(400, "Course has no content yet — add lessons or pass source_text")

    if len(source) > 12000:
        source = source[:12000] + "\n\n[content truncated]"

    user_prompt = (
        f"Difficulty: {req.difficulty}\n"
        f"Number of questions: {req.num_questions}\n"
        f"Source material:\n---\n{source}\n---\n\n"
        f"Generate {req.num_questions} {req.difficulty.lower()} MCQ questions. Return ONLY the JSON array."
    )
    sid = f"{user.id}-aiquiz-{uuid.uuid4().hex[:8]}"
    reply, provider, model = await _try_chain(sid, SYSTEM_PROMPT, user_prompt)

    try:
        items = _extract_json(reply)
        if not isinstance(items, list):
            raise ValueError("not a list")
    except Exception as e:
        raise HTTPException(502, f"AI returned invalid JSON: {e}. Raw: {reply[:200]}")

    # Validate & normalize
    questions = []
    for q in items[: req.num_questions]:
        try:
            qt = str(q["question"]).strip()
            opts = [str(o).strip() for o in q["options"]][:4]
            ci = int(q["correct_index"])
            if len(opts) != 4 or not (0 <= ci <= 3) or not qt:
                continue
            questions.append({
                "id": str(uuid.uuid4()),
                "question": qt, "options": opts, "correct_index": ci,
                "explanation": str(q.get("explanation", "")).strip(),
            })
        except Exception:
            continue

    if not questions:
        raise HTTPException(502, "Could not parse any valid question")

    result = {
        "title": req.title or (f"AI Quiz: {course['title']}" if course else "AI-generated Quiz"),
        "questions": questions,
        "provider": provider, "model": model,
    }

    if req.save:
        quiz_doc = {
            "id": str(uuid.uuid4()),
            "course_id": req.course_id,
            "title": result["title"],
            "description": f"AI-generated · {req.difficulty} · {len(questions)} questions",
            "duration_min": max(5, len(questions) * 2),
            "questions": questions,
            "trainer_id": user.id,
            "ai_generated": True,
            "ai_provider": provider, "ai_model": model,
            "created_at": now_iso(),
        }
        await db.quizzes.insert_one(quiz_doc)
        quiz_doc.pop("_id", None)
        result["quiz_id"] = quiz_doc["id"]
        result["saved"] = True

    return result
