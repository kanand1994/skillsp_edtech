"""Seed a few coding challenges for demo."""
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
    await db.coding_challenges.delete_many({})
    trainer = await db.users.find_one({"role": "trainer"})
    if not trainer:
        print("No trainer found — run seed.py first")
        return
    chs = [
        {
            "title": "FizzBuzz",
            "description": "Read an integer N from stdin and print numbers 1..N, one per line, replacing multiples of 3 with 'Fizz', multiples of 5 with 'Buzz', and multiples of both with 'FizzBuzz'.",
            "difficulty": "Easy", "language": "python", "tags": ["loops", "conditionals"],
            "starter_code": "n = int(input())\n# your code here",
            "test_cases": [
                {"description": "N=5", "stdin": "5", "expected_stdout": "1\n2\nFizz\n4\nBuzz"},
                {"description": "N=15", "stdin": "15", "expected_stdout": "1\n2\nFizz\n4\nBuzz\nFizz\n7\n8\nFizz\nBuzz\n11\nFizz\n13\n14\nFizzBuzz"},
            ],
            "time_limit_min": 15,
        },
        {
            "title": "Two Sum (sum check)",
            "description": "Read N, then N integers (space-separated on one line), then target T. Print 'YES' if any two distinct elements sum to T, else 'NO'.",
            "difficulty": "Medium", "language": "python", "tags": ["hashmap", "array"],
            "starter_code": "n = int(input())\narr = list(map(int, input().split()))\nt = int(input())\n# your code here",
            "test_cases": [
                {"description": "[2,7,11,15] target 9", "stdin": "4\n2 7 11 15\n9", "expected_stdout": "YES"},
                {"description": "[1,2,3] target 7", "stdin": "3\n1 2 3\n7", "expected_stdout": "NO"},
                {"description": "[3,3] target 6", "stdin": "2\n3 3\n6", "expected_stdout": "YES"},
            ],
            "time_limit_min": 20,
        },
        {
            "title": "Reverse a string (JS)",
            "description": "Read a line from stdin and print it reversed.",
            "difficulty": "Easy", "language": "javascript", "tags": ["strings"],
            "starter_code": "// node provides readline. Or use process.stdin\nlet s = require('fs').readFileSync(0,'utf8').trim();\n// your code",
            "test_cases": [
                {"description": "hello", "stdin": "hello", "expected_stdout": "olleh"},
                {"description": "SkillSphere", "stdin": "SkillSphere", "expected_stdout": "erehpSlllikS"[::-1] if False else "erehpSlliks"[::-1]},
            ],
            "time_limit_min": 10,
        },
    ]
    # Fix the JS test case (we want actual reversed strings)
    chs[2]["test_cases"][1]["expected_stdout"] = "erehpSlliks"[::-1]  # = "skillsphere" reversed letter-by-letter
    chs[2]["test_cases"][1]["expected_stdout"] = "SkillSphere"[::-1]

    for c in chs:
        doc = {"id": str(uuid.uuid4()), **c, "trainer_id": trainer["id"], "trainer_name": trainer["name"], "created_at": now()}
        await db.coding_challenges.insert_one(doc)
        print(f"Seeded challenge: {c['title']}")
    print("Done.")


if __name__ == "__main__":
    asyncio.run(main())
