"""JWT authentication, password hashing, role middleware."""
import os
from datetime import datetime, timedelta, timezone
from typing import Optional
import bcrypt
import jwt
from fastapi import Depends, HTTPException, Header, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, EmailStr, Field
from db import db, now_iso

JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALGO = os.environ.get("JWT_ALGORITHM", "HS256")
JWT_EXPIRE = int(os.environ.get("JWT_EXPIRE_MINUTES", "10080"))

SUPERADMIN_EMAIL = os.environ["SUPERADMIN_EMAIL"]
SUPERADMIN_PASSWORD = os.environ["SUPERADMIN_PASSWORD"]
SUPERADMIN_SECRET = os.environ["SUPERADMIN_SECRET"]

bearer = HTTPBearer(auto_error=False)

ROLES = {"student", "trainer", "recruiter", "admin"}


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode(), hashed.encode())
    except Exception:
        return False


def create_token(payload: dict, expires_minutes: Optional[int] = None) -> str:
    data = payload.copy()
    exp = datetime.now(timezone.utc) + timedelta(minutes=expires_minutes or JWT_EXPIRE)
    data.update({"exp": exp, "iat": datetime.now(timezone.utc)})
    return jwt.encode(data, JWT_SECRET, algorithm=JWT_ALGO)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
    except jwt.PyJWTError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {e}")


class UserPublic(BaseModel):
    id: str
    email: str
    name: str
    role: str
    avatar: Optional[str] = None
    bio: Optional[str] = None
    is_premium: bool = False
    created_at: str


async def get_current_user(creds: HTTPAuthorizationCredentials = Depends(bearer)) -> UserPublic:
    if not creds:
        raise HTTPException(401, "Missing auth token")
    payload = decode_token(creds.credentials)
    uid = payload.get("sub")
    if not uid:
        raise HTTPException(401, "Invalid token payload")
    user = await db.users.find_one({"id": uid})
    if not user:
        raise HTTPException(401, "User not found")
    return UserPublic(
        id=user["id"],
        email=user["email"],
        name=user.get("name", ""),
        role=user.get("role", "student"),
        avatar=user.get("avatar"),
        bio=user.get("bio"),
        is_premium=user.get("is_premium", False),
        created_at=user.get("created_at", ""),
    )


def require_role(*allowed: str):
    async def dep(user: UserPublic = Depends(get_current_user)) -> UserPublic:
        if user.role not in allowed:
            raise HTTPException(403, f"Requires role: {allowed}")
        return user
    return dep


async def require_superadmin(
    x_superadmin_secret: Optional[str] = Header(None, alias="X-SuperAdmin-Secret"),
    x_superadmin_token: Optional[str] = Header(None, alias="X-SuperAdmin-Token"),
):
    """Validates SuperAdmin via env secret + token. SuperAdmin is never stored in DB."""
    if not x_superadmin_secret or x_superadmin_secret != SUPERADMIN_SECRET:
        raise HTTPException(404, "Not found")
    if not x_superadmin_token:
        raise HTTPException(404, "Not found")
    try:
        payload = jwt.decode(x_superadmin_token, JWT_SECRET, algorithms=[JWT_ALGO])
        if payload.get("scope") != "superadmin":
            raise HTTPException(404, "Not found")
        if payload.get("email") != SUPERADMIN_EMAIL:
            raise HTTPException(404, "Not found")
    except jwt.PyJWTError:
        raise HTTPException(404, "Not found")
    return {"email": SUPERADMIN_EMAIL, "role": "superadmin"}
