"""Seed a few forum threads."""
import asyncio, os, uuid
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).parent))
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent / ".env")
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone


def now():
    return datetime.now(timezone.utc).isoformat()


async def main():
    c = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = c[os.environ["DB_NAME"]]
    await db.threads.delete_many({"title": {"$regex": "^\\[seed\\]"}})

    users = await db.users.find({"role": {"$in": ["student", "trainer"]}}).to_list(10)
    if not users:
        print("No users — run seed.py first")
        return

    threads = [
        {
            "title": "[seed] How do I correctly type a generic React component in TypeScript?",
            "body": "I'm trying to make a `<Select<T>>` that accepts an items array of T plus a getKey/getLabel function. The compiler keeps inferring `unknown`. What's the canonical pattern?\n\nHere's what I have:\n\n```tsx\nfunction Select<T>(props: { items: T[]; getKey: (t: T) => string }) { ... }\n```\n\nWhen I use it, TypeScript can't infer T. Any tips?",
            "category": "Q&A", "tags": ["typescript", "react", "generics"],
            "author": users[0],
        },
        {
            "title": "[seed] FastAPI background tasks vs Celery — when to choose what?",
            "body": "Building an LMS-style app and I need to send emails on enrollment + run nightly aggregate jobs. Started with BackgroundTasks but wondering if I should reach for Celery + Redis. What are the trade-offs in production?",
            "category": "Q&A", "tags": ["fastapi", "celery", "background-jobs"],
            "author": users[0],
        },
        {
            "title": "[seed] Welcome to SkillSphere Discussions 👋",
            "body": "This is the place to ask questions, share what you're learning, post project showcases, and help fellow learners. A few quick rules:\n\n• Be kind. We were all beginners once.\n• Search before you post.\n• When asking for help, include what you've tried.\n• Use code blocks for code.\n\nHave fun shipping.",
            "category": "Announcements", "tags": ["welcome"],
            "author": users[-1],
            "is_pinned": True,
        },
        {
            "title": "[seed] Just finished the React + Hooks course — sharing my notes app",
            "body": "Spent last weekend building a notes app using everything from the course. Used local storage, full CRUD, dark mode toggle, keyboard shortcuts.\n\nGitHub: https://github.com/example/notes-demo\nLive: https://notes-demo.vercel.app\n\nFeedback welcome!",
            "category": "Showcase", "tags": ["react", "showcase"],
            "author": users[0],
        },
    ]

    for t in threads:
        u = t.pop("author")
        is_pinned = t.pop("is_pinned", False)
        doc = {
            "id": str(uuid.uuid4()), **t,
            "author_id": u["id"], "author_name": u["name"], "author_role": u["role"],
            "upvotes": 0, "voters": [], "replies_count": 0,
            "is_pinned": is_pinned, "is_locked": False,
            "course_id": None,
            "created_at": now(), "last_activity_at": now(),
        }
        await db.threads.insert_one(doc)
        print(f"Seeded: {t['title']}")
    print("Done")


if __name__ == "__main__":
    asyncio.run(main())
