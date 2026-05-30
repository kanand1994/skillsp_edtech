"""AI Assistant — fallback chain: OpenAI GPT-5.2 → Claude Sonnet 4.5 → Gemini 3 Flash."""
import os
import uuid
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from emergentintegrations.llm.chat import LlmChat, UserMessage
from db import db, now_iso
from auth import get_current_user, UserPublic

router = APIRouter(prefix="/ai", tags=["ai"])

EMERGENT_LLM_KEY = os.environ["EMERGENT_LLM_KEY"]

FALLBACK_CHAIN = [
    ("openai", "gpt-5.2"),
    ("anthropic", "claude-sonnet-4-5-20250929"),
    ("gemini", "gemini-3-flash-preview"),
]

MODE_SYSTEM_PROMPTS = {
    "doubt": "You are SkillSphere AI — an expert tutor for software engineering, data science, and tech. Explain concepts clearly with code examples when appropriate. Be concise but thorough.",
    "code": "You are an expert pair-programmer. Provide working code, explain trade-offs, and suggest improvements. Use markdown code blocks.",
    "resume": "You are a top tech recruiter and career coach. Review the resume and give actionable, specific feedback on structure, content, ATS-friendliness, and impact statements. Be honest.",
    "interview": "You are an expert interviewer for top tech companies. Generate or evaluate interview answers. Focus on STAR format for behavioral, code quality + complexity for technical.",
    "roadmap": "You are a career roadmap architect. Create detailed, week-by-week learning roadmaps with resources, milestones, and project ideas based on the user's goal and current skill level.",
    "career": "You are a senior career advisor. Provide guidance on career choices, transitions, and growth. Ask clarifying questions if needed.",
    "quiz_gen": "You are a quiz designer. Generate high-quality multiple-choice questions in valid JSON format only: an array of {question, options: [4 strings], correct_index: int}.",
}


class ChatRequest(BaseModel):
    mode: str = "doubt"  # doubt | code | resume | interview | roadmap | career | quiz_gen
    message: str
    session_id: Optional[str] = None


class ChatResponse(BaseModel):
    session_id: str
    reply: str
    provider: str
    model: str


async def _try_chain(session_id: str, system_message: str, user_text: str):
    last_err = None
    for provider, model in FALLBACK_CHAIN:
        try:
            chat = LlmChat(
                api_key=EMERGENT_LLM_KEY,
                session_id=session_id,
                system_message=system_message,
            ).with_model(provider, model)
            reply = await chat.send_message(UserMessage(text=user_text))
            return reply, provider, model
        except Exception as e:
            last_err = e
            continue
    raise HTTPException(503, f"All AI providers failed: {last_err}")


@router.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest, user: UserPublic = Depends(get_current_user)):
    if req.mode not in MODE_SYSTEM_PROMPTS:
        raise HTTPException(400, "Invalid mode")
    sid = req.session_id or f"{user.id}-{req.mode}-{uuid.uuid4().hex[:8]}"
    system_msg = MODE_SYSTEM_PROMPTS[req.mode]
    reply, provider, model = await _try_chain(sid, system_msg, req.message)
    # persist
    await db.ai_messages.insert_one({
        "id": str(uuid.uuid4()), "user_id": user.id, "session_id": sid, "mode": req.mode,
        "role": "user", "content": req.message, "created_at": now_iso(),
    })
    await db.ai_messages.insert_one({
        "id": str(uuid.uuid4()), "user_id": user.id, "session_id": sid, "mode": req.mode,
        "role": "assistant", "content": reply, "provider": provider, "model": model,
        "created_at": now_iso(),
    })
    return ChatResponse(session_id=sid, reply=reply, provider=provider, model=model)


@router.get("/sessions")
async def list_sessions(user: UserPublic = Depends(get_current_user)):
    pipeline = [
        {"$match": {"user_id": user.id}},
        {"$sort": {"created_at": -1}},
        {"$group": {
            "_id": "$session_id",
            "mode": {"$first": "$mode"},
            "last_message": {"$first": "$content"},
            "updated_at": {"$first": "$created_at"},
        }},
        {"$sort": {"updated_at": -1}},
        {"$limit": 30},
    ]
    docs = await db.ai_messages.aggregate(pipeline).to_list(100)
    return [{"session_id": d["_id"], **{k: d[k] for k in ["mode", "last_message", "updated_at"]}} for d in docs]


@router.get("/sessions/{session_id}/messages")
async def session_messages(session_id: str, user: UserPublic = Depends(get_current_user)):
    msgs = await db.ai_messages.find(
        {"session_id": session_id, "user_id": user.id}, {"_id": 0}
    ).sort("created_at", 1).to_list(500)
    return msgs


class RoadmapRequest(BaseModel):
    goal: str
    current_level: str = "Beginner"
    weeks: int = 12


@router.post("/roadmap")
async def roadmap(req: RoadmapRequest, user: UserPublic = Depends(get_current_user)):
    prompt = (
        f"Create a {req.weeks}-week roadmap to achieve: '{req.goal}'.\n"
        f"Current level: {req.current_level}.\n"
        "Format as markdown with weekly sections, each containing: focus topic, learning resources (free), "
        "1 practical project, and milestone checkpoint. Be specific and actionable."
    )
    sid = f"{user.id}-roadmap-{uuid.uuid4().hex[:8]}"
    reply, provider, model = await _try_chain(sid, MODE_SYSTEM_PROMPTS["roadmap"], prompt)
    return {"roadmap": reply, "provider": provider, "model": model}


class ResumeReviewRequest(BaseModel):
    resume_text: str
    target_role: str = "Software Engineer"


@router.post("/resume-review")
async def resume_review(req: ResumeReviewRequest, user: UserPublic = Depends(get_current_user)):
    prompt = (
        f"Target role: {req.target_role}\n\nResume:\n{req.resume_text}\n\n"
        "Provide review in this markdown structure: ## Strengths, ## Weaknesses, "
        "## Specific Improvements (bullet, with rewrites), ## ATS Score (0-100 with reasoning), ## Next Steps."
    )
    sid = f"{user.id}-resume-{uuid.uuid4().hex[:8]}"
    reply, provider, model = await _try_chain(sid, MODE_SYSTEM_PROMPTS["resume"], prompt)
    return {"review": reply, "provider": provider, "model": model}


class InterviewRequest(BaseModel):
    role: str
    type: str = "behavioral"  # behavioral | technical | system_design
    count: int = 5


@router.post("/interview-prep")
async def interview_prep(req: InterviewRequest, user: UserPublic = Depends(get_current_user)):
    prompt = (
        f"Generate {req.count} {req.type} interview questions for role: {req.role}. "
        "For each question, provide: the question, what the interviewer is looking for, and a strong sample answer."
    )
    sid = f"{user.id}-interview-{uuid.uuid4().hex[:8]}"
    reply, provider, model = await _try_chain(sid, MODE_SYSTEM_PROMPTS["interview"], prompt)
    return {"questions": reply, "provider": provider, "model": model}


# ============ Structured Resume Parser ============
class ResumeParseRequest(BaseModel):
    resume_text: str


@router.post("/resume-parse")
async def resume_parse(req: ResumeParseRequest, user: UserPublic = Depends(get_current_user)):
    """Extract structured JSON from raw resume text."""
    import json as _json
    system = (
        "You are a precision resume parser. Return ONLY a valid JSON object — no prose, no markdown — matching this schema: "
        '{"name": str, "email": str, "phone": str, "summary": str, '
        '"skills": [str], "experience": [{"title": str, "company": str, "duration": str, "highlights": [str]}], '
        '"education": [{"degree": str, "institution": str, "year": str}], '
        '"projects": [{"name": str, "description": str, "tech": [str]}], '
        '"certifications": [str], "languages": [str], '
        '"ats_score": int, "strengths": [str], "improvements": [str]}'
        " Fill missing fields with empty strings or empty arrays. ats_score is 0-100."
    )
    sid = f"{user.id}-resume-parse-{uuid.uuid4().hex[:8]}"
    reply, provider, model = await _try_chain(sid, system, req.resume_text)
    # robustly extract JSON
    txt = reply.strip()
    if txt.startswith("```"):
        txt = txt.strip("`")
        if txt.startswith("json"):
            txt = txt[4:]
        txt = txt.strip()
    try:
        parsed = _json.loads(txt)
    except Exception:
        # Fallback: try to locate the first { ... } block
        s, e = txt.find("{"), txt.rfind("}")
        if s >= 0 and e > s:
            try:
                parsed = _json.loads(txt[s:e + 1])
            except Exception:
                parsed = {"error": "Failed to parse LLM response", "raw": reply[:1000]}
        else:
            parsed = {"error": "Failed to parse LLM response", "raw": reply[:1000]}
    return {"parsed": parsed, "provider": provider, "model": model}


# ============ Mock Interview (multi-turn) ============
class MockInterviewStart(BaseModel):
    role: str
    type: str = "behavioral"   # behavioral | technical | system_design
    difficulty: str = "mid"    # junior | mid | senior


@router.post("/mock-interview/start")
async def mock_interview_start(req: MockInterviewStart, user: UserPublic = Depends(get_current_user)):
    sid = f"mock-{user.id}-{uuid.uuid4().hex[:10]}"
    system = (
        f"You are conducting a {req.difficulty}-level {req.type} interview for the role of {req.role}. "
        "Ask ONE question at a time. After the candidate answers, evaluate briefly (1-2 sentences) then ask the next question. "
        "After 5 questions total, output 'INTERVIEW_COMPLETE' on a new line followed by a final report in this exact format: "
        "OVERALL_SCORE: <0-100>\nSTRENGTHS: <bullet list>\nIMPROVEMENTS: <bullet list>\nRECOMMENDATION: <hire/maybe/reject>. "
        "Begin now with the first question."
    )
    reply, provider, model = await _try_chain(sid, system, "Please begin the interview with your first question.")
    await db.mock_interviews.insert_one({
        "id": sid, "user_id": user.id, "role": req.role, "type": req.type,
        "difficulty": req.difficulty, "system": system, "turns": 1,
        "completed": False, "created_at": now_iso(),
    })
    await db.ai_messages.insert_one({
        "id": str(uuid.uuid4()), "user_id": user.id, "session_id": sid, "mode": "mock_interview",
        "role": "assistant", "content": reply, "provider": provider, "model": model, "created_at": now_iso(),
    })
    return {"session_id": sid, "question": reply, "turn": 1, "total": 5, "provider": provider, "model": model}


class MockInterviewAnswer(BaseModel):
    session_id: str
    answer: str


@router.post("/mock-interview/answer")
async def mock_interview_answer(req: MockInterviewAnswer, user: UserPublic = Depends(get_current_user)):
    sess = await db.mock_interviews.find_one({"id": req.session_id, "user_id": user.id})
    if not sess:
        raise HTTPException(404, "Interview session not found")
    if sess.get("completed"):
        raise HTTPException(400, "Interview already completed")
    reply, provider, model = await _try_chain(req.session_id, sess["system"], req.answer)
    new_turn = sess.get("turns", 0) + 1
    completed = "INTERVIEW_COMPLETE" in reply
    update = {"turns": new_turn}
    report = None
    if completed:
        update["completed"] = True
        update["completed_at"] = now_iso()
        # Extract overall score
        for line in reply.splitlines():
            if line.strip().upper().startswith("OVERALL_SCORE:"):
                try:
                    update["score"] = int("".join(c for c in line.split(":", 1)[1] if c.isdigit())[:3] or 0)
                except Exception:
                    update["score"] = 0
        report = reply.split("INTERVIEW_COMPLETE", 1)[1].strip()
    await db.mock_interviews.update_one({"id": req.session_id}, {"$set": update})
    await db.ai_messages.insert_one({
        "id": str(uuid.uuid4()), "user_id": user.id, "session_id": req.session_id, "mode": "mock_interview",
        "role": "user", "content": req.answer, "created_at": now_iso(),
    })
    await db.ai_messages.insert_one({
        "id": str(uuid.uuid4()), "user_id": user.id, "session_id": req.session_id, "mode": "mock_interview",
        "role": "assistant", "content": reply, "provider": provider, "model": model, "created_at": now_iso(),
    })
    return {
        "session_id": req.session_id, "reply": reply,
        "turn": new_turn, "total": 5, "completed": completed, "report": report,
        "provider": provider, "model": model,
    }


@router.get("/mock-interview/history")
async def mock_interview_history(user: UserPublic = Depends(get_current_user)):
    docs = await db.mock_interviews.find(
        {"user_id": user.id}, {"_id": 0, "system": 0}
    ).sort("created_at", -1).to_list(50)
    return docs


# ============ Job Match Score ============
class JobMatchRequest(BaseModel):
    job_id: str
    resume_text: str


@router.post("/job-match")
async def job_match(req: JobMatchRequest, user: UserPublic = Depends(get_current_user)):
    """Compare a resume against a job posting. Returns match score + gap analysis."""
    import json as _json
    job = await db.jobs.find_one({"id": req.job_id}, {"_id": 0})
    if not job:
        raise HTTPException(404, "Job not found")
    job_brief = (
        f"TITLE: {job.get('title','')}\n"
        f"COMPANY: {job.get('company','')}\n"
        f"DESCRIPTION: {job.get('description','')}\n"
        f"REQUIREMENTS: {chr(10).join(job.get('requirements', []))}\n"
        f"SKILLS: {', '.join(job.get('skills', []))}"
    )
    system = (
        "You are a hiring expert comparing a candidate's resume to a job posting. "
        "Return ONLY a JSON object with this schema (no markdown, no prose): "
        '{"match_score": int (0-100), "verdict": "strong_fit"|"good_fit"|"possible_fit"|"poor_fit", '
        '"matching_skills": [str], "missing_skills": [str], "matching_experience": [str], '
        '"gaps": [str], "improvements": [str], "summary": str (1-2 sentences)}. '
        "match_score weights: skills overlap 40%, experience relevance 35%, requirements coverage 25%."
    )
    user_msg = f"=== JOB ===\n{job_brief}\n\n=== CANDIDATE RESUME ===\n{req.resume_text}"
    sid = f"{user.id}-jobmatch-{uuid.uuid4().hex[:8]}"
    reply, provider, model = await _try_chain(sid, system, user_msg)
    txt = reply.strip()
    if txt.startswith("```"):
        txt = txt.strip("`")
        if txt.startswith("json"):
            txt = txt[4:]
        txt = txt.strip()
    try:
        parsed = _json.loads(txt)
    except Exception:
        s, e = txt.find("{"), txt.rfind("}")
        if s >= 0 and e > s:
            try:
                parsed = _json.loads(txt[s:e + 1])
            except Exception:
                parsed = {"error": "parse_failed", "raw": reply[:1000]}
        else:
            parsed = {"error": "parse_failed", "raw": reply[:1000]}
    return {"job_id": req.job_id, "match": parsed, "provider": provider, "model": model}


# ============ AI Cover Letter Generator ============
class CoverLetterRequest(BaseModel):
    job_id: str
    resume_text: str = ""
    tone: str = "professional"  # professional | enthusiastic | concise


@router.post("/cover-letter")
async def cover_letter(req: CoverLetterRequest, user: UserPublic = Depends(get_current_user)):
    """Generate a tailored cover letter for a specific job."""
    job = await db.jobs.find_one({"id": req.job_id}, {"_id": 0})
    if not job:
        raise HTTPException(404, "Job not found")
    job_brief = (
        f"Role: {job.get('title','')} at {job.get('company','')}\n"
        f"Description: {job.get('description','')[:1200]}\n"
        f"Requirements: {chr(10).join(job.get('requirements', [])[:8])}\n"
        f"Key skills: {', '.join(job.get('skills', [])[:12])}"
    )
    tone_map = {
        "professional": "polished, formal, confident — suitable for traditional companies and corporates",
        "enthusiastic": "warm, energetic, passion-driven — suitable for startups and creative teams",
        "concise": "punchy, to-the-point — under 200 words, maximum signal density",
    }
    tone_instr = tone_map.get(req.tone, tone_map["professional"])
    system = (
        "You are an expert career coach writing a tailored cover letter. "
        f"Tone: {tone_instr}. "
        "Structure: (1) compelling opener referencing the company/role, (2) 2-3 specific achievements from the resume that map to the role's requirements, "
        "(3) why this role/company specifically, (4) closing CTA. "
        "Use concrete numbers from the resume when available. Avoid clichés like 'I am writing to apply'. "
        "Output the cover letter only, in markdown. No preamble."
    )
    candidate_block = req.resume_text.strip() or f"Candidate: {user.name} ({user.email}). No resume provided — write a generic but tailored letter based on the role."
    user_msg = f"=== JOB ===\n{job_brief}\n\n=== CANDIDATE ===\n{candidate_block}"
    sid = f"{user.id}-coverletter-{uuid.uuid4().hex[:8]}"
    reply, provider, model = await _try_chain(sid, system, user_msg)
    return {"job_id": req.job_id, "letter": reply, "tone": req.tone, "provider": provider, "model": model}
