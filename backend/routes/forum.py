"""Forum/discussions module — threads + replies + votes."""
import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from db import db, now_iso
from auth import get_current_user, require_role, UserPublic

router = APIRouter(prefix="/forum", tags=["forum"])


class ThreadCreate(BaseModel):
    title: str = Field(min_length=4, max_length=200)
    body: str = Field(min_length=1, max_length=20000)
    category: str = "General"  # General | Q&A | Announcements | Showcase | Help
    course_id: Optional[str] = None
    tags: List[str] = []


class ThreadOut(BaseModel):
    id: str
    title: str
    body: str
    category: str
    course_id: Optional[str] = None
    tags: List[str]
    author_id: str
    author_name: str
    author_role: str
    upvotes: int
    voters: List[str]
    replies_count: int
    is_pinned: bool
    is_locked: bool
    created_at: str
    last_activity_at: str


@router.post("", response_model=ThreadOut)
async def create_thread(req: ThreadCreate, user: UserPublic = Depends(get_current_user)):
    tid = str(uuid.uuid4())
    doc = {
        "id": tid, **req.model_dump(),
        "author_id": user.id, "author_name": user.name, "author_role": user.role,
        "upvotes": 0, "voters": [], "replies_count": 0,
        "is_pinned": False, "is_locked": False,
        "created_at": now_iso(), "last_activity_at": now_iso(),
    }
    await db.threads.insert_one(doc)
    from routes.gamification import award_xp
    await award_xp(user.id, "forum_post", ref_id=tid)
    return ThreadOut(**doc)


@router.get("")
async def list_threads(
    q: Optional[str] = None,
    category: Optional[str] = None,
    course_id: Optional[str] = None,
    sort: str = Query("recent", description="recent | top | unanswered"),
):
    filt: dict = {}
    if q:
        filt["$or"] = [{"title": {"$regex": q, "$options": "i"}}, {"body": {"$regex": q, "$options": "i"}}]
    if category and category != "all":
        filt["category"] = category
    if course_id:
        filt["course_id"] = course_id
    if sort == "unanswered":
        filt["replies_count"] = 0
    sort_key = [("is_pinned", -1)]
    if sort == "top":
        sort_key += [("upvotes", -1), ("created_at", -1)]
    else:
        sort_key += [("last_activity_at", -1)]
    docs = await db.threads.find(filt, {"_id": 0}).sort(sort_key).to_list(200)
    return docs


@router.get("/categories")
async def categories():
    cats = await db.threads.distinct("category")
    return {"categories": cats or ["General", "Q&A", "Announcements", "Showcase", "Help"]}


@router.get("/{tid}")
async def get_thread(tid: str):
    doc = await db.threads.find_one({"id": tid}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Thread not found")
    return doc


@router.delete("/{tid}")
async def delete_thread(tid: str, user: UserPublic = Depends(get_current_user)):
    t = await db.threads.find_one({"id": tid})
    if not t:
        raise HTTPException(404, "Not found")
    if t["author_id"] != user.id and user.role != "admin":
        raise HTTPException(403, "Forbidden")
    await db.threads.delete_one({"id": tid})
    await db.replies.delete_many({"thread_id": tid})
    # Clean up dangling notifications referencing this thread
    await db.notifications.delete_many({"link": f"/forum/{tid}"})
    return {"ok": True}


@router.post("/{tid}/vote")
async def vote_thread(tid: str, user: UserPublic = Depends(get_current_user)):
    t = await db.threads.find_one({"id": tid})
    if not t:
        raise HTTPException(404, "Not found")
    # Atomic toggle: try to add the voter first; if already present, remove.
    added = await db.threads.update_one(
        {"id": tid, "voters": {"$ne": user.id}},
        {"$addToSet": {"voters": user.id}, "$inc": {"upvotes": 1}},
    )
    if added.modified_count:
        fresh = await db.threads.find_one({"id": tid}, {"_id": 0, "upvotes": 1})
        return {"voted": True, "upvotes": fresh.get("upvotes", 0)}
    await db.threads.update_one(
        {"id": tid, "voters": user.id},
        {"$pull": {"voters": user.id}, "$inc": {"upvotes": -1}},
    )
    fresh = await db.threads.find_one({"id": tid}, {"_id": 0, "upvotes": 1})
    return {"voted": False, "upvotes": fresh.get("upvotes", 0)}


@router.post("/{tid}/pin")
async def pin_thread(tid: str, user: UserPublic = Depends(require_role("admin"))):
    t = await db.threads.find_one({"id": tid})
    if not t: raise HTTPException(404, "Not found")
    await db.threads.update_one({"id": tid}, {"$set": {"is_pinned": not t.get("is_pinned", False)}})
    return {"ok": True, "pinned": not t.get("is_pinned", False)}


@router.post("/{tid}/lock")
async def lock_thread(tid: str, user: UserPublic = Depends(require_role("admin"))):
    t = await db.threads.find_one({"id": tid})
    if not t: raise HTTPException(404, "Not found")
    await db.threads.update_one({"id": tid}, {"$set": {"is_locked": not t.get("is_locked", False)}})
    return {"ok": True, "locked": not t.get("is_locked", False)}


# ============ Replies ============
class ReplyCreate(BaseModel):
    body: str = Field(min_length=1, max_length=10000)
    parent_reply_id: Optional[str] = None  # for nested


@router.post("/{tid}/replies")
async def add_reply(tid: str, req: ReplyCreate, user: UserPublic = Depends(get_current_user)):
    t = await db.threads.find_one({"id": tid})
    if not t:
        raise HTTPException(404, "Thread not found")
    if t.get("is_locked"):
        raise HTTPException(403, "Thread is locked")
    rid = str(uuid.uuid4())
    doc = {
        "id": rid, "thread_id": tid, **req.model_dump(),
        "author_id": user.id, "author_name": user.name, "author_role": user.role,
        "upvotes": 0, "voters": [],
        "is_accepted": False,
        "created_at": now_iso(),
    }
    await db.replies.insert_one(doc)
    await db.threads.update_one(
        {"id": tid},
        {"$inc": {"replies_count": 1}, "$set": {"last_activity_at": now_iso()}},
    )
    # Notify thread author
    if t["author_id"] != user.id:
        await db.notifications.insert_one({
            "id": str(uuid.uuid4()), "user_id": t["author_id"], "type": "forum",
            "title": f"{user.name} replied to your thread",
            "body": (req.body[:120] + "…") if len(req.body) > 120 else req.body,
            "link": f"/forum/{tid}", "read": False, "created_at": now_iso(),
        })
    doc.pop("_id", None)
    from routes.gamification import award_xp
    await award_xp(user.id, "forum_reply", ref_id=rid)
    return doc


@router.get("/{tid}/replies")
async def list_replies(tid: str):
    docs = await db.replies.find({"thread_id": tid}, {"_id": 0}).sort("created_at", 1).to_list(500)
    return docs


@router.post("/replies/{rid}/vote")
async def vote_reply(rid: str, user: UserPublic = Depends(get_current_user)):
    r = await db.replies.find_one({"id": rid})
    if not r: raise HTTPException(404, "Not found")
    added = await db.replies.update_one(
        {"id": rid, "voters": {"$ne": user.id}},
        {"$addToSet": {"voters": user.id}, "$inc": {"upvotes": 1}},
    )
    if added.modified_count:
        fresh = await db.replies.find_one({"id": rid}, {"_id": 0, "upvotes": 1})
        return {"voted": True, "upvotes": fresh.get("upvotes", 0)}
    await db.replies.update_one(
        {"id": rid, "voters": user.id},
        {"$pull": {"voters": user.id}, "$inc": {"upvotes": -1}},
    )
    fresh = await db.replies.find_one({"id": rid}, {"_id": 0, "upvotes": 1})
    return {"voted": False, "upvotes": fresh.get("upvotes", 0)}


@router.post("/replies/{rid}/accept")
async def accept_reply(rid: str, user: UserPublic = Depends(get_current_user)):
    r = await db.replies.find_one({"id": rid})
    if not r: raise HTTPException(404, "Not found")
    t = await db.threads.find_one({"id": r["thread_id"]})
    if not t or (t["author_id"] != user.id and user.role != "admin"):
        raise HTTPException(403, "Only the thread author or admin can accept an answer")
    # un-accept any prior accepted reply in this thread
    await db.replies.update_many({"thread_id": r["thread_id"]}, {"$set": {"is_accepted": False}})
    await db.replies.update_one({"id": rid}, {"$set": {"is_accepted": True}})
    from routes.gamification import award_xp
    await award_xp(r["author_id"], "forum_accepted", ref_id=rid)
    return {"ok": True}


@router.delete("/replies/{rid}")
async def delete_reply(rid: str, user: UserPublic = Depends(get_current_user)):
    r = await db.replies.find_one({"id": rid})
    if not r: raise HTTPException(404, "Not found")
    if r["author_id"] != user.id and user.role != "admin":
        raise HTTPException(403, "Forbidden")
    await db.replies.delete_one({"id": rid})
    await db.threads.update_one({"id": r["thread_id"]}, {"$inc": {"replies_count": -1}})
    return {"ok": True}
