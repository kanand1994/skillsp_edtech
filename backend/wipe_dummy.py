"""Wipe dummy data — keep 1 demo account per role, clear all payments + content.

Run: python /app/backend/wipe_dummy.py
"""
import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()


async def main():
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = client[os.environ["DB_NAME"]]

    keep_emails = [
        "admin@skillsphere.demo",
        "trainer1@skillsphere.demo",
        "recruiter@skillsphere.demo",
        "student@skillsphere.demo",
    ]

    # 1. Users — keep only 1 per role
    deleted = await db.users.delete_many({"email": {"$nin": keep_emails}})
    print(f"users: deleted {deleted.deleted_count}, kept {len(keep_emails)}")

    # 2. Content collections — wipe
    collections_to_wipe = [
        "courses", "lessons", "enrollments", "certificates",
        "quizzes", "quiz_attempts",
        "jobs", "applications",
        "threads", "replies", "notifications",
        "coding_challenges", "coding_attempts",
        "ai_messages", "mock_interviews",
        "payment_transactions",  # User explicitly requested
        "files", "user_xp_events",
        "messages", "conversations",
    ]
    for coll in collections_to_wipe:
        res = await db[coll].delete_many({})
        print(f"{coll}: deleted {res.deleted_count}")

    # 3. Reset gamification state on kept users
    await db.users.update_many({}, {"$unset": {"gamification": "", "is_premium": ""}})
    print("users: gamification state reset")

    print("\n✅ Dummy data wiped. Demo accounts preserved.")

if __name__ == "__main__":
    asyncio.run(main())
