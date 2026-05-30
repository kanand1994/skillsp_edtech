"""Refer-a-Friend module.

Each user has a deterministic referral code derived from their user id.
Flow:
  - Caller visits /register?ref=CODE — the code is forwarded to POST /auth/register.
  - On register, referrals.attach_referral(new_user_id, ref_code) is invoked:
      * Validates the referrer exists, prevents self-referral.
      * Records a referral doc with status="pending".
      * Issues a 10% one-time discount (referral_discount_pct) on the new user.
  - When the new user makes their first paid checkout, payments._fulfill calls
    referrals.complete_referral(user_id, txn_id) which:
      * Marks the referral as "completed".
      * Awards XP to the referrer via gamification.award_xp.
      * Consumes (clears) the discount on the referee.
  - GET /me — caller's referral code + link + stats.
  - GET /leaderboard — top referrers by completed count.
"""
import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from db import db, now_iso
from auth import get_current_user, UserPublic
from routes.gamification import award_xp, XP_RULES

router = APIRouter(prefix="/referrals", tags=["referrals"])

# Referrer bonuses
REFERRAL_XP = 100
REFEREE_DISCOUNT_PCT = 10  # 10% off referee's first paid checkout
# Register the XP rule so awards persist via gamification log (idempotent on ref_id)
XP_RULES["referral_signup"] = REFERRAL_XP


def code_for_user(user_id: str) -> str:
    """Deterministic 8-char referral code derived from user_id."""
    # First 8 hex chars of uuid (strip dashes) — short, URL-safe, case-insensitive.
    return user_id.replace("-", "")[:8].upper()


async def _find_referrer_by_code(code: str) -> Optional[dict]:
    if not code or len(code.strip()) < 4:
        return None
    code = code.strip().upper()
    # Scan minimal projection — index on id already unique.
    cursor = db.users.find({}, {"id": 1, "email": 1, "name": 1})
    async for u in cursor:
        if code_for_user(u["id"]) == code:
            return u
    return None


async def attach_referral(new_user_id: str, ref_code: Optional[str]):
    """Called from auth registration. Best-effort: never raise on bad code."""
    if not ref_code:
        return None
    referrer = await _find_referrer_by_code(ref_code)
    if not referrer:
        return None
    if referrer["id"] == new_user_id:
        return None  # self-referral guard
    # Prevent duplicate referral attachment if registration is retried.
    existing = await db.referrals.find_one({"referee_id": new_user_id})
    if existing:
        return existing
    doc = {
        "id": str(uuid.uuid4()),
        "referrer_id": referrer["id"],
        "referee_id": new_user_id,
        "code": ref_code.upper(),
        "status": "pending",  # pending -> completed
        "created_at": now_iso(),
        "completed_at": None,
        "xp_awarded": 0,
    }
    await db.referrals.insert_one(doc)
    # Grant the referee a one-time discount on first paid checkout.
    await db.users.update_one(
        {"id": new_user_id},
        {"$set": {"referral_discount_pct": REFEREE_DISCOUNT_PCT, "referred_by": referrer["id"]}},
    )
    return doc


async def complete_referral(referee_id: str, txn_id: str):
    """Called from payments._fulfill after a successful purchase."""
    ref = await db.referrals.find_one({"referee_id": referee_id, "status": "pending"})
    if not ref:
        return None
    # Award XP FIRST (idempotent on ref_id) so if it fails, status stays pending
    # and we retry on the next fulfilment.
    res = await award_xp(ref["referrer_id"], "referral_signup", ref_id=ref["id"])
    await db.referrals.update_one(
        {"id": ref["id"]},
        {"$set": {
            "status": "completed",
            "completed_at": now_iso(),
            "first_payment_txn_id": txn_id,
            "xp_awarded": int(res.get("awarded") or 0),
        }},
    )
    # Consume the discount on the referee so it isn't reused.
    await db.users.update_one({"id": referee_id}, {"$unset": {"referral_discount_pct": ""}})
    return ref


async def get_discount_pct_for_user(user_id: str) -> int:
    """Returns the pending discount percent (0 if none)."""
    u = await db.users.find_one({"id": user_id}, {"referral_discount_pct": 1})
    return int((u or {}).get("referral_discount_pct") or 0)


# ----- Endpoints --------------------------------------------------------------
@router.get("/me")
async def my_referrals(user: UserPublic = Depends(get_current_user)):
    code = code_for_user(user.id)
    docs = await db.referrals.find({"referrer_id": user.id}, {"_id": 0}).sort("created_at", -1).to_list(200)
    pending = sum(1 for d in docs if d.get("status") == "pending")
    completed = sum(1 for d in docs if d.get("status") == "completed")
    xp_earned = sum(int(d.get("xp_awarded") or 0) for d in docs)
    # Resolve referee names for display
    referee_ids = [d["referee_id"] for d in docs]
    name_map = {}
    if referee_ids:
        async for u in db.users.find({"id": {"$in": referee_ids}}, {"id": 1, "name": 1, "email": 1}):
            name_map[u["id"]] = u.get("name") or u.get("email")
    for d in docs:
        d["referee_name"] = name_map.get(d["referee_id"], "Friend")
    my_discount = await get_discount_pct_for_user(user.id)
    return {
        "code": code,
        "pending": pending,
        "completed": completed,
        "xp_earned": xp_earned,
        "xp_per_referral": REFERRAL_XP,
        "referee_discount_pct": REFEREE_DISCOUNT_PCT,
        "my_discount_pct": my_discount,
        "referrals": docs,
    }


@router.get("/leaderboard")
async def leaderboard():
    pipeline = [
        {"$match": {"status": "completed"}},
        {"$group": {"_id": "$referrer_id", "count": {"$sum": 1}, "xp": {"$sum": "$xp_awarded"}}},
        {"$sort": {"count": -1}},
        {"$limit": 25},
    ]
    rows = await db.referrals.aggregate(pipeline).to_list(25)
    out = []
    for r in rows:
        u = await db.users.find_one({"id": r["_id"]}, {"id": 1, "name": 1, "avatar": 1})
        if not u:
            continue
        out.append({
            "user_id": u["id"],
            "name": u.get("name", "—"),
            "avatar": u.get("avatar"),
            "completed": r["count"],
            "xp_earned": r["xp"],
        })
    return out


class _ValidateIn(BaseModel):
    code: str


@router.post("/validate")
async def validate_code(req: _ValidateIn):
    """Pre-flight check used by the Register page to preview the bonus."""
    referrer = await _find_referrer_by_code(req.code)
    if not referrer:
        return {"valid": False}
    return {
        "valid": True,
        "referrer_name": referrer.get("name") or "a SkillSphere member",
        "referee_discount_pct": REFEREE_DISCOUNT_PCT,
    }
