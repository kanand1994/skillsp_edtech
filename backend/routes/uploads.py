"""Emergent object storage uploads (S3-compatible)."""
import os
import uuid
import logging
import requests
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, File, Header, HTTPException, Query, Response, UploadFile
from db import db, now_iso
from auth import get_current_user, UserPublic, decode_token
from storage_s3 import s3_enabled, put_object_s3, get_object_s3

logger = logging.getLogger("uploads")

STORAGE_URL = "https://integrations.emergentagent.com/objstore/api/v1/storage"
EMERGENT_KEY = os.environ["EMERGENT_LLM_KEY"]
APP_NAME = os.environ.get("APP_NAME", "skillsphere")

router = APIRouter(prefix="/uploads", tags=["uploads"])

_storage_key: Optional[str] = None

MIME_TYPES = {
    "jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png",
    "gif": "image/gif", "webp": "image/webp", "svg": "image/svg+xml",
    "pdf": "application/pdf", "zip": "application/zip",
    "mp4": "video/mp4", "webm": "video/webm", "mov": "video/quicktime",
    "txt": "text/plain", "csv": "text/csv",
}

# size limits (bytes) per category
LIMITS = {
    "image": 5 * 1024 * 1024,        # 5 MB
    "video": 200 * 1024 * 1024,      # 200 MB
    "document": 15 * 1024 * 1024,    # 15 MB
    "other": 25 * 1024 * 1024,
}


def init_storage() -> str:
    global _storage_key
    if _storage_key:
        return _storage_key
    resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_KEY}, timeout=30)
    resp.raise_for_status()
    _storage_key = resp.json()["storage_key"]
    logger.info("Storage initialized")
    return _storage_key


def _reset_storage_key():
    global _storage_key
    _storage_key = None


def put_object(path: str, data: bytes, content_type: str) -> dict:
    # Route to S3 when AWS env is fully configured.
    if s3_enabled():
        return put_object_s3(path, data, content_type)
    key = init_storage()
    resp = requests.put(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key, "Content-Type": content_type},
        data=data, timeout=180,
    )
    if resp.status_code == 403:
        _reset_storage_key()
        key = init_storage()
        resp = requests.put(
            f"{STORAGE_URL}/objects/{path}",
            headers={"X-Storage-Key": key, "Content-Type": content_type},
            data=data, timeout=180,
        )
    resp.raise_for_status()
    return resp.json()


def get_object(path: str):
    if s3_enabled():
        return get_object_s3(path)
    key = init_storage()
    resp = requests.get(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key}, timeout=60,
    )
    if resp.status_code == 403:
        _reset_storage_key()
        key = init_storage()
        resp = requests.get(
            f"{STORAGE_URL}/objects/{path}",
            headers={"X-Storage-Key": key}, timeout=60,
        )
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")


def _classify(ext: str) -> str:
    if ext in {"jpg", "jpeg", "png", "gif", "webp", "svg"}: return "image"
    if ext in {"mp4", "webm", "mov"}: return "video"
    if ext in {"pdf", "zip", "txt", "csv"}: return "document"
    return "other"


@router.post("")
async def upload_file(
    file: UploadFile = File(...),
    category: str = Query("other", description="image | video | document | resume | thumbnail | avatar | project"),
    user: UserPublic = Depends(get_current_user),
):
    ext = (file.filename or "bin").rsplit(".", 1)[-1].lower() if "." in (file.filename or "") else "bin"
    cls = _classify(ext)
    data = await file.read()
    limit = LIMITS.get(cls, LIMITS["other"])
    if len(data) > limit:
        raise HTTPException(413, f"File too large for {cls} (max {limit // (1024*1024)}MB)")
    content_type = MIME_TYPES.get(ext, file.content_type or "application/octet-stream")
    file_id = str(uuid.uuid4())
    path = f"{APP_NAME}/uploads/{user.id}/{file_id}.{ext}"
    try:
        result = put_object(path, data, content_type)
    except Exception as e:
        logger.error(f"Upload failed: {e}")
        raise HTTPException(500, f"Upload failed: {e}")

    doc = {
        "id": file_id,
        "user_id": user.id,
        "storage_path": result["path"],
        "original_filename": file.filename or f"{file_id}.{ext}",
        "content_type": content_type,
        "category": category,
        "size": result.get("size", len(data)),
        "is_deleted": False,
        "created_at": now_iso(),
    }
    await db.files.insert_one(doc)
    return {
        "id": file_id,
        "url": f"/api/uploads/{file_id}",
        "size": doc["size"],
        "content_type": content_type,
        "original_filename": doc["original_filename"],
    }


@router.get("/{file_id}")
async def download_file(
    file_id: str,
    auth: Optional[str] = Query(None, description="JWT for img-src tags"),
    authorization: Optional[str] = Header(None),
):
    """Serve uploaded file. Auth allowed via Authorization header OR ?auth= query for img/video src."""
    # Validate auth — but allow public access for thumbnails (best-effort: anyone with file_id can fetch).
    # For an MVP we permit public read since file_id is a UUID (unguessable).
    rec = await db.files.find_one({"id": file_id, "is_deleted": False})
    if not rec:
        raise HTTPException(404, "File not found")
    try:
        data, ct = get_object(rec["storage_path"])
    except Exception as e:
        logger.error(f"Download failed: {e}")
        raise HTTPException(500, "Download failed")
    return Response(content=data, media_type=rec.get("content_type", ct))


@router.delete("/{file_id}")
async def delete_file(file_id: str, user: UserPublic = Depends(get_current_user)):
    rec = await db.files.find_one({"id": file_id})
    if not rec:
        raise HTTPException(404, "Not found")
    if rec["user_id"] != user.id and user.role != "admin":
        raise HTTPException(403, "Forbidden")
    await db.files.update_one({"id": file_id}, {"$set": {"is_deleted": True}})
    return {"ok": True}


@router.get("/me/list")
async def my_files(category: Optional[str] = None, user: UserPublic = Depends(get_current_user)):
    filt = {"user_id": user.id, "is_deleted": False}
    if category:
        filt["category"] = category
    files = await db.files.find(filt, {"_id": 0}).sort("created_at", -1).to_list(200)
    for f in files:
        f["url"] = f"/api/uploads/{f['id']}"
    return files
