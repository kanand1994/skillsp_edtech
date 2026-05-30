"""Socket.IO realtime chat — sits alongside FastAPI."""
import logging
import socketio
from datetime import datetime, timezone
from db import db, now_iso
from auth import decode_token

logger = logging.getLogger("socketio")

sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins="*",
    logger=False,
    engineio_logger=False,
)

# user_id -> set of sids (a user can have multiple tabs)
_user_sids: dict[str, set[str]] = {}
# sid -> user_id
_sid_user: dict[str, str] = {}


def _conv_id(a: str, b: str) -> str:
    return "::".join(sorted([a, b]))


def _online_users():
    return list(_user_sids.keys())


@sio.event
async def connect(sid, environ, auth):
    """Auth handshake. Client must pass {token}."""
    token = (auth or {}).get("token")
    if not token:
        logger.info(f"sio reject (no token): {sid}")
        raise socketio.exceptions.ConnectionRefusedError("missing token")
    try:
        payload = decode_token(token)
        uid = payload.get("sub")
        if not uid:
            raise ValueError("no sub")
    except Exception as e:
        logger.info(f"sio reject (bad token): {e}")
        raise socketio.exceptions.ConnectionRefusedError("invalid token")

    user = await db.users.find_one({"id": uid})
    if not user:
        raise socketio.exceptions.ConnectionRefusedError("user not found")

    _sid_user[sid] = uid
    _user_sids.setdefault(uid, set()).add(sid)
    await sio.save_session(sid, {"user_id": uid, "user_name": user.get("name", "")})

    # Broadcast presence
    await sio.emit("presence", {"user_id": uid, "online": True})
    await sio.emit("presence_list", {"online": _online_users()}, to=sid)
    logger.info(f"sio connect user={uid} sid={sid} online={len(_user_sids)}")


@sio.event
async def disconnect(sid):
    uid = _sid_user.pop(sid, None)
    if uid and uid in _user_sids:
        _user_sids[uid].discard(sid)
        if not _user_sids[uid]:
            del _user_sids[uid]
            await sio.emit("presence", {"user_id": uid, "online": False})
    logger.info(f"sio disconnect sid={sid}")


@sio.event
async def send_message(sid, data):
    """data: {to_user_id, text, attachment_url?}"""
    sess = await sio.get_session(sid)
    from_uid = sess["user_id"]
    from_name = sess["user_name"]
    to_uid = data.get("to_user_id")
    text = (data.get("text") or "").strip()
    attachment = data.get("attachment_url")
    if not to_uid or (not text and not attachment):
        return

    receiver = await db.users.find_one({"id": to_uid})
    if not receiver:
        return
    cid = _conv_id(from_uid, to_uid)
    import uuid as _uuid
    msg = {
        "id": str(_uuid.uuid4()),
        "conversation_id": cid,
        "from_user_id": from_uid, "from_user_name": from_name,
        "to_user_id": to_uid, "to_user_name": receiver.get("name", ""),
        "text": text, "attachment_url": attachment,
        "read": False, "created_at": now_iso(),
    }
    await db.messages.insert_one(msg)
    await db.conversations.update_one(
        {"id": cid},
        {"$set": {
            "id": cid,
            "participants": sorted([from_uid, to_uid]),
            "participant_names": {from_uid: from_name, to_uid: receiver.get("name", "")},
            "last_message": text or "[attachment]", "last_at": msg["created_at"],
        }},
        upsert=True,
    )
    msg.pop("_id", None)
    # Emit to sender + recipient sockets
    for s in list(_user_sids.get(from_uid, set())):
        await sio.emit("message", msg, to=s)
    for s in list(_user_sids.get(to_uid, set())):
        await sio.emit("message", msg, to=s)
    # Persist notification for recipient
    await db.notifications.insert_one({
        "id": str(_uuid.uuid4()), "user_id": to_uid, "type": "chat",
        "title": f"New message from {from_name}", "body": text[:120] if text else "[attachment]",
        "link": f"/chat/{from_uid}", "read": False, "created_at": now_iso(),
    })


@sio.event
async def typing(sid, data):
    """data: {to_user_id, typing: bool}"""
    sess = await sio.get_session(sid)
    from_uid = sess["user_id"]
    to_uid = data.get("to_user_id")
    if not to_uid:
        return
    for s in list(_user_sids.get(to_uid, set())):
        await sio.emit("typing", {"from_user_id": from_uid, "typing": bool(data.get("typing"))}, to=s)


@sio.event
async def mark_read(sid, data):
    """data: {conversation_id}"""
    sess = await sio.get_session(sid)
    uid = sess["user_id"]
    cid = data.get("conversation_id")
    if not cid:
        return
    await db.messages.update_many(
        {"conversation_id": cid, "to_user_id": uid, "read": False},
        {"$set": {"read": True}},
    )


def get_online_users():
    return _online_users()
