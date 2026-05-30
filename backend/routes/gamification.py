"""Gamification — XP, levels, badges, streaks.

Awards are written to db.user_xp_events (immutable log) + cached on db.users.gamification.
Badges are evaluated lazily on each event + on GET /me.
"""
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from db import db, now_iso
from auth import get_current_user, UserPublic

router = APIRouter(prefix="/gamification", tags=["gamification"])


# --- XP rules (server-side, never trust client) -------------------------------
XP_RULES = {
    "course_enroll":    10,
    "lesson_complete":  15,
    "course_complete":  150,
    "quiz_pass_70":     30,
    "quiz_pass_90":     60,
    "coding_solve":     50,
    "forum_post":       8,
    "forum_reply":      4,
    "forum_accepted":   25,
    "daily_login":      5,
}

# Level curve: level n requires n*100 XP cumulatively (1->100, 2->300, 3->600, 4->1000, ...)
def level_for_xp(xp: int) -> int:
    lvl = 1
    while xp >= lvl * (lvl + 1) * 50:  # 100, 300, 600, 1000, 1500, ...
        lvl += 1
    return lvl

def xp_to_next_level(xp: int) -> tuple[int, int]:
    cur = level_for_xp(xp)
    next_req = cur * (cur + 1) * 50
    prev_req = (cur - 1) * cur * 50 if cur > 1 else 0
    return xp - prev_req, next_req - prev_req


# --- Badge catalogue ----------------------------------------------------------
BADGES = [
    {"id": "first_steps",     "name": "First Steps",      "desc": "Enrolled in your first course",            "icon": "🌱", "tier": "bronze"},
    {"id": "knowledge_seeker","name": "Knowledge Seeker", "desc": "Complete 3 courses",                      "icon": "📚", "tier": "silver"},
    {"id": "scholar",         "name": "Scholar",          "desc": "Complete 10 courses",                     "icon": "🎓", "tier": "gold"},
    {"id": "quiz_rookie",     "name": "Quiz Rookie",      "desc": "Pass your first quiz (≥70%)",             "icon": "🎯", "tier": "bronze"},
    {"id": "quiz_ace",        "name": "Quiz Ace",         "desc": "Score 90%+ on any quiz",                  "icon": "💯", "tier": "gold"},
    {"id": "coder",           "name": "Coder",            "desc": "Solve your first coding challenge",       "icon": "⚡", "tier": "bronze"},
    {"id": "code_warrior",    "name": "Code Warrior",     "desc": "Solve 10 coding challenges",              "icon": "⚔️", "tier": "gold"},
    {"id": "community",       "name": "Community Voice",  "desc": "Post your first forum thread",            "icon": "💬", "tier": "bronze"},
    {"id": "helper",          "name": "Helper",           "desc": "Get a reply accepted as the answer",      "icon": "🤝", "tier": "silver"},
    {"id": "streak_3",        "name": "On Fire",          "desc": "3-day learning streak",                    "icon": "🔥", "tier": "silver"},
    {"id": "streak_7",        "name": "Unstoppable",      "desc": "7-day learning streak",                    "icon": "🚀", "tier": "gold"},
    {"id": "level_5",         "name": "Rising Star",      "desc": "Reach level 5",                            "icon": "⭐", "tier": "silver"},
    {"id": "level_10",        "name": "Skill Master",     "desc": "Reach level 10",                           "icon": "🏆", "tier": "platinum"},
]
BADGE_INDEX = {b["id"]: b for b in BADGES}


async def _get_state(user_id: str) -> dict:
    doc = await db.users.find_one({"id": user_id}, {"gamification": 1})
    return (doc or {}).get("gamification") or {"xp": 0, "badges": [], "streak": 0, "last_login_date": None}


async def _evaluate_badges(user_id: str, state: dict) -> List[str]:
    """Check unlock conditions; return newly-unlocked badge IDs."""
    new_unlocks = []
    have = set(state.get("badges", []))

    # courses
    enrolls = await db.enrollments.count_documents({"user_id": user_id})
    completes = await db.enrollments.count_documents({"user_id": user_id, "progress_pct": {"$gte": 100}})
    if enrolls >= 1 and "first_steps" not in have: new_unlocks.append("first_steps")
    if completes >= 3 and "knowledge_seeker" not in have: new_unlocks.append("knowledge_seeker")
    if completes >= 10 and "scholar" not in have: new_unlocks.append("scholar")

    # quizzes
    best_quiz = await db.quiz_attempts.find({"user_id": user_id}, {"score": 1}).sort("score", -1).limit(1).to_list(1)
    if best_quiz:
        if best_quiz[0]["score"] >= 70 and "quiz_rookie" not in have: new_unlocks.append("quiz_rookie")
        if best_quiz[0]["score"] >= 90 and "quiz_ace" not in have: new_unlocks.append("quiz_ace")

    # coding
    coding_solves = await db.coding_attempts.count_documents({"user_id": user_id, "score": 100})
    if coding_solves >= 1 and "coder" not in have: new_unlocks.append("coder")
    if coding_solves >= 10 and "code_warrior" not in have: new_unlocks.append("code_warrior")

    # forum
    threads = await db.threads.count_documents({"author_id": user_id})
    if threads >= 1 and "community" not in have: new_unlocks.append("community")
    accepted = await db.replies.count_documents({"author_id": user_id, "is_accepted": True})
    if accepted >= 1 and "helper" not in have: new_unlocks.append("helper")

    # streak
    streak = state.get("streak", 0)
    if streak >= 3 and "streak_3" not in have: new_unlocks.append("streak_3")
    if streak >= 7 and "streak_7" not in have: new_unlocks.append("streak_7")

    # level
    level = level_for_xp(state.get("xp", 0))
    if level >= 5 and "level_5" not in have: new_unlocks.append("level_5")
    if level >= 10 and "level_10" not in have: new_unlocks.append("level_10")

    return new_unlocks


async def award_xp(user_id: str, action: str, ref_id: Optional[str] = None) -> dict:
    """Public hook: call from anywhere on user actions. Idempotent for course_complete + quiz on ref_id."""
    points = XP_RULES.get(action, 0)
    if points <= 0:
        return {"awarded": 0}
    # Idempotency: action+ref must not duplicate (e.g. completing same course twice)
    if ref_id and action in ("course_complete", "lesson_complete", "coding_solve", "forum_accepted"):
        existing = await db.user_xp_events.find_one({"user_id": user_id, "action": action, "ref_id": ref_id})
        if existing:
            return {"awarded": 0, "duplicate": True}

    state = await _get_state(user_id)
    state["xp"] = state.get("xp", 0) + points

    # streak: bump if last_login_date was yesterday, reset if older
    today = datetime.now(timezone.utc).date().isoformat()
    last = state.get("last_login_date")
    if action == "daily_login":
        if last == today:
            return {"awarded": 0, "already_today": True}
        yesterday = (datetime.now(timezone.utc).date() - timedelta(days=1)).isoformat()
        state["streak"] = (state.get("streak", 0) + 1) if last == yesterday else 1
        state["last_login_date"] = today

    new_badges = await _evaluate_badges(user_id, state)
    state["badges"] = state.get("badges", []) + new_badges

    await db.user_xp_events.insert_one({
        "id": str(uuid.uuid4()), "user_id": user_id, "action": action,
        "points": points, "ref_id": ref_id, "at": now_iso(),
    })
    await db.users.update_one({"id": user_id}, {"$set": {"gamification": state}})
    return {"awarded": points, "new_badges": new_badges, "xp": state["xp"], "level": level_for_xp(state["xp"])}


# --- Public endpoints ---------------------------------------------------------
@router.get("/me")
async def my_gamification(user: UserPublic = Depends(get_current_user)):
    state = await _get_state(user.id)
    # lazy re-evaluate badges
    new_badges = await _evaluate_badges(user.id, state)
    if new_badges:
        state["badges"] = state.get("badges", []) + new_badges
        await db.users.update_one({"id": user.id}, {"$set": {"gamification": state}})
    xp = state.get("xp", 0)
    progress, total = xp_to_next_level(xp)
    return {
        "xp": xp,
        "level": level_for_xp(xp),
        "level_progress": progress,
        "level_total": total,
        "streak": state.get("streak", 0),
        "last_login_date": state.get("last_login_date"),
        "badges": [BADGE_INDEX[b] for b in state.get("badges", []) if b in BADGE_INDEX],
        "all_badges": BADGES,
        "locked_badges": [b for b in BADGES if b["id"] not in set(state.get("badges", []))],
    }


@router.get("/leaderboard")
async def leaderboard():
    cursor = db.users.find(
        {"gamification.xp": {"$gt": 0}},
        {"_id": 0, "id": 1, "name": 1, "avatar": 1, "role": 1, "gamification": 1},
    ).sort("gamification.xp", -1).limit(50)
    docs = await cursor.to_list(50)
    out = []
    for d in docs:
        g = d.get("gamification") or {}
        out.append({
            "user_id": d["id"], "name": d.get("name", ""), "avatar": d.get("avatar"),
            "role": d.get("role"), "xp": g.get("xp", 0),
            "level": level_for_xp(g.get("xp", 0)),
            "badges_count": len(g.get("badges", [])),
        })
    return out


class _DailyLogin(BaseModel):
    pass


@router.post("/daily-login")
async def daily_login(user: UserPublic = Depends(get_current_user)):
    return await award_xp(user.id, "daily_login")
