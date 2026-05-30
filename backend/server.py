"""SkillSphere — FastAPI main app with Socket.IO."""
import logging
import os
from fastapi import FastAPI, APIRouter, Request
from starlette.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")
# Securely load masked SuperAdmin parameters from private gitignored file if present
load_dotenv(ROOT_DIR / ".superadmin.env", override=True)

from db import db
from routes.auth_routes import router as auth_router
from routes.courses import router as courses_router
from routes.learning import router as learning_router
from routes.jobs import router as jobs_router
from routes.ai import router as ai_router
from routes.chat import router as chat_router
from routes.payments import router as payments_router, stripe_webhook_handler
from routes.admin import router as admin_router
from routes.uploads import router as uploads_router, init_storage
from routes.coding import router as coding_router, probe_piston
from routes.forum import router as forum_router
from routes.ai_quiz import router as ai_quiz_router
from routes.gamification import router as gamification_router
from routes.referrals import router as referrals_router
from routes.certificates import router as certificates_router
from sockets import sio, get_online_users
import socketio as _socketio

app = FastAPI(title="SkillSphere API", version="1.1.0")

api_router = APIRouter(prefix="/api")


@api_router.get("/")
async def root():
    return {"name": "SkillSphere API", "version": "1.1.0", "status": "ok"}


@api_router.get("/health")
async def health():
    try:
        await db.command("ping")
        return {"status": "healthy", "db": "ok", "online_users": len(get_online_users())}
    except Exception as e:
        return {"status": "degraded", "db": str(e)}


@api_router.get("/presence")
async def presence():
    return {"online_users": get_online_users()}


@api_router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    return await stripe_webhook_handler(request)


# Mount sub-routers
api_router.include_router(auth_router)
api_router.include_router(courses_router)
api_router.include_router(learning_router)
api_router.include_router(jobs_router)
api_router.include_router(ai_router)
api_router.include_router(chat_router)
api_router.include_router(payments_router)
api_router.include_router(admin_router)
api_router.include_router(uploads_router)
api_router.include_router(coding_router)
api_router.include_router(forum_router)
api_router.include_router(ai_quiz_router)
api_router.include_router(gamification_router)
api_router.include_router(referrals_router)
api_router.include_router(certificates_router)

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("skillsphere")


@app.on_event("startup")
async def startup():
    # Indexes
    await db.users.create_index("email", unique=True)
    await db.users.create_index("id", unique=True)
    await db.courses.create_index("id", unique=True)
    await db.jobs.create_index("id", unique=True)
    await db.enrollments.create_index([("user_id", 1), ("course_id", 1)])
    await db.messages.create_index([("conversation_id", 1), ("created_at", 1)])
    await db.files.create_index("id", unique=True)
    await db.referrals.create_index("referee_id")
    await db.referrals.create_index("referrer_id")
    # Object storage: use S3 if AWS env is configured, otherwise Emergent storage.
    from storage_s3 import s3_enabled
    if s3_enabled():
        logger.info("Object storage: S3 backend active")
    else:
        try:
            init_storage()
            logger.info("Object storage: Emergent backend ready")
        except Exception as e:
            logger.error(f"Storage init failed: {e}")
    # Probe self-hosted Piston (graceful no-op if not configured)
    try:
        ok = await probe_piston()
        logger.info(f"Piston probe: enabled={ok}")
    except Exception as e:
        logger.warning(f"Piston probe failed: {e}")
    logger.info("SkillSphere startup complete.")


@app.on_event("shutdown")
async def shutdown():
    pass


# Wrap FastAPI with Socket.IO ASGI app. Mounted at /api/socket.io so the
# Kubernetes ingress (which forwards /api/* to backend:8001) proxies WebSockets too.
app = _socketio.ASGIApp(sio, other_asgi_app=app, socketio_path="/api/socket.io")
