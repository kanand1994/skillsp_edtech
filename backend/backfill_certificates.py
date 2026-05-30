"""One-shot backfill: issue certificates for already-completed courses + ≥70% quiz attempts.

Run once after deploying the certificate feature. Idempotent — safe to re-run.
"""
import asyncio
from db import db
from routes.certificates import issue_course_certificate, issue_quiz_certificate


async def main():
    course_issued = 0
    quiz_issued = 0

    # Course completions (progress_pct >= 100)
    async for e in db.enrollments.find({"progress_pct": {"$gte": 100}}, {"user_id": 1, "course_id": 1}):
        cert = await issue_course_certificate(e["user_id"], e["course_id"])
        if cert:
            course_issued += 1

    # Quiz attempts >= 70 — use best score per (user, quiz)
    seen = set()
    cursor = db.quiz_attempts.find({"score": {"$gte": 70}}, {"user_id": 1, "quiz_id": 1, "score": 1}).sort("score", -1)
    async for a in cursor:
        key = (a["user_id"], a["quiz_id"])
        if key in seen:
            continue
        seen.add(key)
        cert = await issue_quiz_certificate(a["user_id"], a["quiz_id"], a["score"])
        if cert:
            quiz_issued += 1

    print(f"Backfilled {course_issued} course certs + {quiz_issued} quiz certs")


if __name__ == "__main__":
    asyncio.run(main())
