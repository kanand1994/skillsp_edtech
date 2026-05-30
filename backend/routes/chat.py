"""Realtime-style chat (polling-based) and notifications."""
import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from db import db, now_iso
from auth import get_current_user, UserPublic

router = APIRouter(tags=["chat"])


def _conv_id(a: str, b: str) -> str:
    return "::".join(sorted([a, b]))


class SendMessage(BaseModel):
    to_user_id: str
    text: str
    attachment_url: Optional[str] = None


@router.post("/chat/send")
async def send(req: SendMessage, user: UserPublic = Depends(get_current_user)):
    receiver = await db.users.find_one({"id": req.to_user_id})
    if not receiver:
        raise HTTPException(404, "Recipient not found")
    cid = _conv_id(user.id, req.to_user_id)
    msg = {
        "id": str(uuid.uuid4()), "conversation_id": cid,
        "from_user_id": user.id, "from_user_name": user.name,
        "to_user_id": req.to_user_id, "to_user_name": receiver.get("name", ""),
        "text": req.text, "attachment_url": req.attachment_url,
        "read": False, "created_at": now_iso(),
    }
    await db.messages.insert_one(msg)
    # update conversation summary
    await db.conversations.update_one(
        {"id": cid},
        {"$set": {
            "id": cid,
            "participants": sorted([user.id, req.to_user_id]),
            "participant_names": {user.id: user.name, req.to_user_id: receiver.get("name", "")},
            "last_message": req.text, "last_at": msg["created_at"],
        }},
        upsert=True,
    )
    # Notify recipient
    await db.notifications.insert_one({
        "id": str(uuid.uuid4()), "user_id": req.to_user_id, "type": "chat",
        "title": f"New message from {user.name}", "body": req.text[:120],
        "link": f"/chat/{user.id}", "read": False, "created_at": now_iso(),
    })
    msg.pop("_id", None)
    return msg


@router.get("/chat/conversations")
async def conversations(user: UserPublic = Depends(get_current_user)):
    convs = await db.conversations.find({"participants": user.id}, {"_id": 0}).sort("last_at", -1).to_list(100)
    return convs


@router.get("/chat/with/{other_id}")
async def thread(other_id: str, user: UserPublic = Depends(get_current_user)):
    cid = _conv_id(user.id, other_id)
    msgs = await db.messages.find({"conversation_id": cid}, {"_id": 0}).sort("created_at", 1).to_list(500)
    # mark received as read
    await db.messages.update_many(
        {"conversation_id": cid, "to_user_id": user.id, "read": False},
        {"$set": {"read": True}},
    )
    other = await db.users.find_one({"id": other_id})
    return {
        "messages": msgs,
        "other_user": {
            "id": other_id,
            "name": other.get("name", "Unknown") if other else "Unknown",
            "role": other.get("role", "") if other else "",
            "avatar": other.get("avatar") if other else None,
        } if other else None,
    }


# ============ NOTIFICATIONS ============
@router.get("/notifications")
async def list_notifications(user: UserPublic = Depends(get_current_user)):
    notes = await db.notifications.find({"user_id": user.id}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return notes


@router.post("/notifications/{nid}/read")
async def mark_read(nid: str, user: UserPublic = Depends(get_current_user)):
    await db.notifications.update_one({"id": nid, "user_id": user.id}, {"$set": {"read": True}})
    return {"ok": True}


@router.post("/notifications/read-all")
async def mark_all_read(user: UserPublic = Depends(get_current_user)):
    await db.notifications.update_many({"user_id": user.id}, {"$set": {"read": True}})
    return {"ok": True}
