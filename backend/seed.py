"""Seed demo data: trainers, courses, jobs, recruiter, student."""
import asyncio
import os
import uuid
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).parent))

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent / ".env")

from motor.motor_asyncio import AsyncIOMotorClient
import bcrypt
from datetime import datetime, timezone

def now(): return datetime.now(timezone.utc).isoformat()
def hp(p): return bcrypt.hashpw(p.encode(), bcrypt.gensalt()).decode()

async def main():
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = client[os.environ["DB_NAME"]]

    # Clear seed (idempotent)
    seed_emails = ["admin@skillsphere.demo", "trainer1@skillsphere.demo", "trainer2@skillsphere.demo", "recruiter@skillsphere.demo", "student@skillsphere.demo"]
    await db.users.delete_many({"email": {"$in": seed_emails}})

    users = [
        {"role": "admin", "email": "admin@skillsphere.demo", "name": "Admin Root", "password": "Admin@123"},
        {"role": "trainer", "email": "trainer1@skillsphere.demo", "name": "Sarah Chen", "password": "Trainer@123"},
        {"role": "trainer", "email": "trainer2@skillsphere.demo", "name": "Marcus Reyes", "password": "Trainer@123"},
        {"role": "recruiter", "email": "recruiter@skillsphere.demo", "name": "Priya Sharma", "password": "Recruiter@123", "company_name": "Northwind Labs"},
        {"role": "student", "email": "student@skillsphere.demo", "name": "Alex Kim", "password": "Student@123"},
    ]

    fixed_ids = {
        "admin@skillsphere.demo": "admin-root-uuid-0000-000000000000",
        "trainer1@skillsphere.demo": "trainer1-uuid-0000-000000000000",
        "trainer2@skillsphere.demo": "trainer2-uuid-0000-000000000000",
        "recruiter@skillsphere.demo": "recruiter-uuid-0000-000000000000",
        "student@skillsphere.demo": "4b4f24ae-9cdc-4ab6-a0ca-a7c9bd9f85c5",
    }

    ids = {}
    for u in users:
        uid = fixed_ids.get(u["email"], str(uuid.uuid4()))
        doc = {
            "id": uid, "email": u["email"], "password_hash": hp(u["password"]),
            "name": u["name"], "role": u["role"], "avatar": None, "bio": None,
            "company_name": u.get("company_name"), "is_premium": False, "created_at": now(),
        }
        await db.users.insert_one(doc)
        ids[u["email"]] = uid
        print(f"Seeded {u['role']}: {u['email']} / {u['password']}")

    # Courses
    THUMBS = {
        "tech": "https://static.prod-images.emergentagent.com/jobs/dc290901-7081-495e-be3b-755453cb236d/images/e4af241411c508ddbfc4a9a29ad6e4cdf0b55c0984adaf621b7a026d6fef898e.png",
        "business": "https://static.prod-images.emergentagent.com/jobs/dc290901-7081-495e-be3b-755453cb236d/images/ad8603bd9925e7fec9be69f311fead56b3477d8aca56ace2ebc01b137231e787.png",
    }

    courses_data = [
        {"trainer": "trainer1@skillsphere.demo", "title": "Modern React + Hooks Masterclass",
         "description": "Build production-grade React apps with hooks, context, suspense, and concurrent features. Includes 5 real-world projects.",
         "category": "Web Development", "level": "Intermediate", "price": 49, "thumbnail": THUMBS["tech"],
         "tags": ["React", "JavaScript", "Hooks"], "is_premium": False,
         "lessons": [
             {"title": "useState & useEffect deep dive", "video_url": "https://www.youtube.com/watch?v=dpw9EHDh2bM", "duration_min": 18},
             {"title": "Context API patterns", "video_url": "https://www.youtube.com/watch?v=35lXWvCuM8o", "duration_min": 24},
             {"title": "Custom hooks", "video_url": "https://www.youtube.com/watch?v=I2Bgi0Qcdvc", "duration_min": 20},
             {"title": "Suspense & Concurrent React", "video_url": "https://www.youtube.com/watch?v=SCQgE4mTnjU", "duration_min": 30},
         ]},
        {"trainer": "trainer1@skillsphere.demo", "title": "FastAPI for Backend Engineers",
         "description": "Master FastAPI, async Python, Pydantic v2, and MongoDB. Build a complete REST API with auth, payments, and AI.",
         "category": "Backend", "level": "Intermediate", "price": 0, "thumbnail": THUMBS["tech"],
         "tags": ["Python", "FastAPI", "MongoDB"], "is_premium": False,
         "lessons": [
             {"title": "Routing & dependencies", "video_url": "https://www.youtube.com/watch?v=7t2alSnE2-I", "duration_min": 22},
             {"title": "Pydantic models", "video_url": "https://www.youtube.com/watch?v=qWtL05Uafe0", "duration_min": 18},
         ]},
        {"trainer": "trainer2@skillsphere.demo", "title": "System Design Interview Prep",
         "description": "Crack FAANG system design interviews. Covers scaling, caching, DBs, queues, and 10 case studies (Twitter, Uber, Netflix).",
         "category": "System Design", "level": "Advanced", "price": 99, "thumbnail": THUMBS["business"],
         "tags": ["System Design", "Architecture", "Interview"], "is_premium": True,
         "lessons": [
             {"title": "Scaling fundamentals", "video_url": "https://www.youtube.com/watch?v=xpDnVSmNFX0", "duration_min": 35},
             {"title": "Design Twitter", "video_url": "https://www.youtube.com/watch?v=wYk0xPP_P_8", "duration_min": 42},
         ]},
        {"trainer": "trainer2@skillsphere.demo", "title": "Data Structures & Algorithms",
         "description": "Land your dream job with 150+ patterns covering arrays, trees, DP, graphs and more.",
         "category": "Computer Science", "level": "Beginner", "price": 0, "thumbnail": THUMBS["tech"],
         "tags": ["DSA", "LeetCode", "Algorithms"], "is_premium": False,
         "lessons": [
             {"title": "Big-O complexity", "video_url": "https://www.youtube.com/watch?v=v4cd1O4zkGw", "duration_min": 15},
             {"title": "Arrays & two-pointer", "video_url": "https://www.youtube.com/watch?v=On03HWe2tZM", "duration_min": 28},
             {"title": "Dynamic programming intro", "video_url": "https://www.youtube.com/watch?v=oBt53YbR9Kk", "duration_min": 32},
         ]},
        {"trainer": "trainer1@skillsphere.demo", "title": "Product Analytics with SQL",
         "description": "Become the analyst PMs trust. Real product datasets, cohorts, funnels, and dashboards.",
         "category": "Data & Analytics", "level": "Beginner", "price": 29, "thumbnail": THUMBS["business"],
         "tags": ["SQL", "Analytics", "Product"], "is_premium": False,
         "lessons": [
             {"title": "Window functions", "video_url": "https://www.youtube.com/watch?v=Ww71knvhQ-s", "duration_min": 24},
         ]},
    ]

    for c in courses_data:
        cid = str(uuid.uuid4())
        trainer_uid = ids[c["trainer"]]
        trainer_name = next(u["name"] for u in users if u["email"] == c["trainer"])
        lessons = [{"id": str(uuid.uuid4()), "description": "", "resource_url": "", **l} for l in c["lessons"]]
        doc = {
            "id": cid, "title": c["title"], "description": c["description"],
            "category": c["category"], "level": c["level"], "price": c["price"],
            "thumbnail": c["thumbnail"], "tags": c["tags"], "is_premium": c["is_premium"],
            "lessons": lessons, "trainer_id": trainer_uid, "trainer_name": trainer_name,
            "rating": 4.5, "reviews_count": 0, "students_count": 0, "created_at": now(),
        }
        await db.courses.insert_one(doc)

    # Jobs
    jobs_data = [
        {"title": "Senior Frontend Engineer (React)", "company": "Northwind Labs", "location": "Remote — Worldwide",
         "job_type": "Full-time", "experience": "Senior", "salary_min": 120000, "salary_max": 180000,
         "description": "Build delightful interfaces at scale. You'll own the design system, ship Server Components, and mentor engineers.",
         "requirements": ["5+ years React", "TypeScript expert", "Design system experience", "CI/CD knowledge"],
         "skills": ["React", "TypeScript", "Tailwind", "Next.js"]},
        {"title": "Backend Engineering Intern", "company": "Northwind Labs", "location": "Remote",
         "job_type": "Internship", "experience": "Entry", "salary_min": 25000, "salary_max": 35000,
         "description": "12-week internship building production APIs. Mentorship from senior engineers.",
         "requirements": ["Strong fundamentals", "Python or Go", "Curious & humble"],
         "skills": ["Python", "FastAPI", "PostgreSQL"]},
        {"title": "Data Scientist", "company": "Northwind Labs", "location": "San Francisco, CA",
         "job_type": "Full-time", "experience": "Mid", "salary_min": 140000, "salary_max": 200000,
         "description": "Own analytics + ML modeling for our flagship product. Cross-functional with product & engineering.",
         "requirements": ["MS or equivalent experience", "Python + SQL fluency", "Production ML"],
         "skills": ["Python", "SQL", "PyTorch", "Airflow"]},
    ]
    for j in jobs_data:
        await db.jobs.insert_one({
            "id": str(uuid.uuid4()), **j,
            "apply_url": "", "recruiter_id": ids["recruiter@skillsphere.demo"],
            "recruiter_name": "Priya Sharma", "applicants_count": 0, "created_at": now(),
        })

    # Quiz for first course
    course = await db.courses.find_one({"title": "Modern React + Hooks Masterclass"})
    if course:
        await db.quizzes.insert_one({
            "id": str(uuid.uuid4()), "course_id": course["id"],
            "title": "React Fundamentals Quiz", "description": "Test your React knowledge",
            "duration_min": 10, "trainer_id": course["trainer_id"], "created_at": now(),
            "questions": [
                {"id": str(uuid.uuid4()), "question": "Which hook is used for side effects in React?",
                 "options": ["useState", "useEffect", "useMemo", "useReducer"], "correct_index": 1},
                {"id": str(uuid.uuid4()), "question": "What does the dependency array control in useEffect?",
                 "options": ["Component name", "When effect runs", "Hook order", "State value"], "correct_index": 1},
                {"id": str(uuid.uuid4()), "question": "Which is NOT a valid React hook?",
                 "options": ["useContext", "useRouter", "useFetch", "useCallback"], "correct_index": 2},
            ],
        })

    # Seed certificate for Student (Alex Kim)
    if course:
        await db.certificates.delete_many({"id": "8fbe0723-1f90-4c55-b419-b4b850448ea4"})
        await db.certificates.insert_one({
            "id": "8fbe0723-1f90-4c55-b419-b4b850448ea4",
            "credential_id": "SKL-9C2FB3D5EA",
            "user_id": "4b4f24ae-9cdc-4ab6-a0ca-a7c9bd9f85c5",
            "user_name": "Alex Kim",
            "source_type": "course",
            "source_id": course["id"],
            "source_title": "Modern React + Hooks Masterclass",
            "instructor_name": "Sarah Chen",
            "skills": ["React", "JavaScript", "Hooks"],
            "score": None,
            "issued_at": now(),
        })

    print("\nSeed complete!")
    client.close()

if __name__ == "__main__":
    asyncio.run(main())
