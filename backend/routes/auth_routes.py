"""Authentication endpoints: register, login, me."""
import uuid
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, Field
from db import db, now_iso
from auth import (
    hash_password, verify_password, create_token, get_current_user,
    UserPublic, ROLES,
)
from email_service import email_welcome
from routes.referrals import attach_referral
import asyncio

router = APIRouter(prefix="/auth", tags=["auth"])


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str = Field(min_length=1, max_length=80)
    role: str = "student"
    company_name: str | None = None
    referral_code: str | None = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class AuthResponse(BaseModel):
    token: str
    user: UserPublic


@router.post("/register", response_model=AuthResponse)
async def register(req: RegisterRequest):
    if req.role not in ROLES:
        raise HTTPException(400, "Invalid role")
    existing = await db.users.find_one({"email": req.email.lower()})
    if existing:
        raise HTTPException(400, "Email already registered")
    uid = str(uuid.uuid4())
    doc = {
        "id": uid,
        "email": req.email.lower(),
        "password_hash": hash_password(req.password),
        "name": req.name,
        "role": req.role,
        "avatar": None,
        "bio": None,
        "company_name": req.company_name,
        "is_premium": False,
        "created_at": now_iso(),
    }
    await db.users.insert_one(doc)
    # Attach referral if provided (best-effort, never raises)
    try:
        await attach_referral(uid, req.referral_code)
    except Exception:
        pass
    token = create_token({"sub": uid, "role": req.role})
    # Fire welcome email (non-blocking, placeholder-safe)
    asyncio.create_task(email_welcome(req.email.lower(), req.name))
    return AuthResponse(token=token, user=UserPublic(**{k: doc[k] for k in ["id", "email", "name", "role", "avatar", "bio", "is_premium", "created_at"]}))


@router.post("/login", response_model=AuthResponse)
async def login(req: LoginRequest):
    user = await db.users.find_one({"email": req.email.lower()})
    if not user or not verify_password(req.password, user["password_hash"]):
        raise HTTPException(401, "Invalid credentials")
    token = create_token({"sub": user["id"], "role": user["role"]})
    return AuthResponse(
        token=token,
        user=UserPublic(
            id=user["id"], email=user["email"], name=user.get("name", ""),
            role=user.get("role"), avatar=user.get("avatar"), bio=user.get("bio"),
            is_premium=user.get("is_premium", False), created_at=user.get("created_at", ""),
        ),
    )


@router.get("/me", response_model=UserPublic)
async def me(user: UserPublic = Depends(get_current_user)):
    return user


class ProfileUpdate(BaseModel):
    name: str | None = None
    bio: str | None = None
    avatar: str | None = None


@router.put("/me", response_model=UserPublic)
async def update_me(req: ProfileUpdate, user: UserPublic = Depends(get_current_user)):
    update = {k: v for k, v in req.model_dump(exclude_none=True).items()}
    if update:
        await db.users.update_one({"id": user.id}, {"$set": update})
    fresh = await db.users.find_one({"id": user.id})
    return UserPublic(
        id=fresh["id"], email=fresh["email"], name=fresh.get("name", ""),
        role=fresh.get("role"), avatar=fresh.get("avatar"), bio=fresh.get("bio"),
        is_premium=fresh.get("is_premium", False), created_at=fresh.get("created_at", ""),
    )
