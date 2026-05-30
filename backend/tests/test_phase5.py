"""Phase 5 backend tests — Gamification, AI Mock Interview, Resume Parser, Welcome Email, SuperAdmin stealth."""
import os
import time
import pytest
import requests
from pymongo import MongoClient

BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or "https://learn-jobs-hub.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

STUDENT = {"email": "student@skillsphere.demo", "password": "Student@123"}
ADMIN = {"email": "admin@skillsphere.demo", "password": "Admin@123"}

SA_EMAIL = os.environ.get("SUPERADMIN_EMAIL", "root@skillsphere.internal")
SA_PASSWORD = os.environ.get("SUPERADMIN_PASSWORD", "")
SA_SECRET = os.environ.get("SUPERADMIN_SECRET", "")
SA_ROUTE = "8cc8d924bd888bb4"


def _login(creds):
    r = requests.post(f"{API}/auth/login", json=creds, timeout=20)
    assert r.status_code == 200, r.text
    return r.json()["token"]


def _hdr(t):
    return {"Authorization": f"Bearer {t}"}


@pytest.fixture(scope="session")
def student_token():
    return _login(STUDENT)


# ============== Register + Welcome Email (Resend) ==============
class TestRegisterWelcomeEmail:
    def test_register_does_not_500_when_resend_unverified(self):
        email = f"test_ph5_reg_{int(time.time())}@example.com"
        r = requests.post(f"{API}/auth/register", json={
            "email": email, "password": "Passw0rd!", "name": "TEST Phase5", "role": "student"
        }, timeout=30)
        # The welcome email is fire-and-forget; main response must be 200
        assert r.status_code == 200, f"Register must not 500 when Resend fails: {r.status_code} {r.text}"
        data = r.json()
        assert "token" in data and "user" in data
        assert data["user"]["email"] == email.lower()


# ============== Gamification ==============
class TestGamification:
    def test_me_shape(self, student_token):
        r = requests.get(f"{API}/gamification/me", headers=_hdr(student_token))
        assert r.status_code == 200, r.text
        data = r.json()
        for k in ("xp", "level", "level_progress", "level_total", "streak", "badges", "all_badges", "locked_badges"):
            assert k in data, f"Missing key {k} in /gamification/me response: {list(data.keys())}"
        assert isinstance(data["xp"], int)
        assert isinstance(data["level"], int)
        assert isinstance(data["all_badges"], list) and len(data["all_badges"]) >= 13
        assert isinstance(data["badges"], list)
        assert isinstance(data["locked_badges"], list)

    def test_daily_login_idempotent(self, student_token):
        r1 = requests.post(f"{API}/gamification/daily-login", headers=_hdr(student_token))
        assert r1.status_code == 200, r1.text
        d1 = r1.json()
        # First call: either awarded:5 or already_today:true (if test ran earlier today)
        assert d1.get("awarded") in (0, 5)
        # Second call same day must be already_today
        r2 = requests.post(f"{API}/gamification/daily-login", headers=_hdr(student_token))
        assert r2.status_code == 200
        d2 = r2.json()
        assert d2.get("already_today") is True or d2.get("awarded") == 0, f"Second call should be no-op: {d2}"

    def test_leaderboard_public(self):
        r = requests.get(f"{API}/gamification/leaderboard")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        if data:
            # Sorted descending by xp
            xps = [u["xp"] for u in data]
            assert xps == sorted(xps, reverse=True)
            for u in data:
                for k in ("user_id", "name", "xp", "level", "badges_count"):
                    assert k in u

    def test_enroll_awards_first_steps(self, student_token):
        # Find a course
        cr = requests.get(f"{API}/courses")
        items = cr.json() if isinstance(cr.json(), list) else cr.json().get("items", [])
        assert items, "Need at least one course seeded"
        cid = items[0]["id"]
        # Enroll (may already be enrolled — that's fine)
        requests.post(f"{API}/courses/{cid}/enroll", headers=_hdr(student_token))
        # Confirm first_steps badge
        gr = requests.get(f"{API}/gamification/me", headers=_hdr(student_token))
        assert gr.status_code == 200
        badge_ids = [b["id"] for b in gr.json()["badges"]]
        assert "first_steps" in badge_ids, f"first_steps badge should be unlocked, got: {badge_ids}"


# ============== AI Mock Interview ==============
class TestMockInterview:
    def test_start_interview(self, student_token):
        r = requests.post(f"{API}/ai/mock-interview/start", headers=_hdr(student_token), json={
            "role": "Software Engineer", "type": "behavioral", "difficulty": "mid"
        }, timeout=60)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("session_id"), data
        assert data.get("turn") == 1
        assert data.get("total") == 5
        assert data.get("question")
        TestMockInterview.sid = data["session_id"]

    def test_answer_one_turn(self, student_token):
        sid = getattr(TestMockInterview, "sid", None)
        if not sid:
            pytest.skip("no session_id")
        r = requests.post(f"{API}/ai/mock-interview/answer", headers=_hdr(student_token), json={
            "session_id": sid,
            "answer": "I led a team of 5 engineers to migrate our payments service to Stripe, reducing failed transactions by 30%."
        }, timeout=60)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("session_id") == sid
        assert data.get("turn", 0) >= 2
        assert "reply" in data
        assert "completed" in data

    def test_history(self, student_token):
        r = requests.get(f"{API}/ai/mock-interview/history", headers=_hdr(student_token))
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        # Should at least contain the session we just started (unless DB cleared between tests)
        if data:
            assert "id" in data[0] and "role" in data[0]


# ============== Resume Parser ==============
RESUME_TEXT = """John Doe
Email: john@example.com | Phone: +1-555-1234
Senior Software Engineer with 8 years of experience building scalable web platforms.

SKILLS
Python, FastAPI, React, MongoDB, AWS, Docker, Kubernetes

EXPERIENCE
Senior Engineer — Acme Corp (2021-Present)
- Led migration of monolith to microservices, reducing latency 40%.
- Built CI/CD pipeline with GitHub Actions.

Software Engineer — StartupX (2018-2021)
- Shipped React/Redux dashboard used by 100k users.

EDUCATION
B.S. Computer Science — MIT (2018)
"""


class TestResumeParser:
    def test_parse_resume(self, student_token):
        r = requests.post(f"{API}/ai/resume-parse", headers=_hdr(student_token),
                          json={"resume_text": RESUME_TEXT}, timeout=90)
        assert r.status_code == 200, r.text
        data = r.json()
        parsed = data.get("parsed") or {}
        # Fields must be present
        for k in ("name", "skills", "experience", "education", "ats_score", "strengths", "improvements"):
            assert k in parsed, f"Missing field '{k}' in parsed: {list(parsed.keys())}"
        # ats_score sanity
        score = parsed.get("ats_score")
        assert isinstance(score, (int, float)), f"ats_score must be numeric: {score}"
        assert 0 <= score <= 100
        # skills should be a non-empty list
        assert isinstance(parsed["skills"], list) and len(parsed["skills"]) >= 1


# ============== SuperAdmin Stealth ==============
class TestSuperAdmin:
    def test_wrong_secret_returns_404(self):
        r = requests.post(f"{API}/private/internal/{SA_ROUTE}/auth", json={
            "email": SA_EMAIL, "password": SA_PASSWORD, "secret": "WRONG"
        })
        assert r.status_code == 404

    def test_success_returns_token(self):
        r = requests.post(f"{API}/private/internal/{SA_ROUTE}/auth", json={
            "email": SA_EMAIL, "password": SA_PASSWORD, "secret": SA_SECRET
        })
        assert r.status_code == 200, r.text
        assert r.json().get("token")

    def test_not_in_users_collection(self):
        mongo_url = os.environ.get("MONGO_URL")
        db_name = os.environ.get("DB_NAME")
        if not mongo_url or not db_name:
            pytest.skip("Mongo env not available")
        client = MongoClient(mongo_url)
        try:
            assert client[db_name].users.find_one({"email": SA_EMAIL}) is None
        finally:
            client.close()


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
