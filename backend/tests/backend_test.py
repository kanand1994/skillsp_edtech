"""SkillSphere comprehensive backend tests — pytest based.

Covers: Auth, Courses, Quizzes, Jobs, AI, Chat, Notifications, Payments,
Admin and Hidden SuperAdmin routes.
"""
import os
import time
import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://learn-jobs-hub.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

# Seeded credentials (from /app/memory/test_credentials.md)
STUDENT = {"email": "student@skillsphere.demo", "password": "Student@123"}
TRAINER = {"email": "trainer1@skillsphere.demo", "password": "Trainer@123"}
RECRUITER = {"email": "recruiter@skillsphere.demo", "password": "Recruiter@123"}
ADMIN = {"email": "admin@skillsphere.demo", "password": "Admin@123"}

SA_EMAIL = os.environ.get("SUPERADMIN_EMAIL", "root@skillsphere.internal")
SA_PASSWORD = os.environ.get("SUPERADMIN_PASSWORD", "")
SA_SECRET = os.environ.get("SUPERADMIN_SECRET", "")
SA_ROUTE = "8cc8d924bd888bb4"


# ============== Helpers ==============
def _login(creds):
    r = requests.post(f"{API}/auth/login", json=creds, timeout=20)
    assert r.status_code == 200, f"Login failed for {creds['email']}: {r.status_code} {r.text}"
    return r.json()["token"]


def _hdr(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="session")
def student_token():
    return _login(STUDENT)


@pytest.fixture(scope="session")
def trainer_token():
    return _login(TRAINER)


@pytest.fixture(scope="session")
def recruiter_token():
    return _login(RECRUITER)


@pytest.fixture(scope="session")
def admin_token():
    return _login(ADMIN)


# ============== Health ==============
class TestHealth:
    def test_root(self):
        r = requests.get(f"{API}/")
        assert r.status_code == 200
        assert r.json()["status"] == "ok"

    def test_health(self):
        r = requests.get(f"{API}/health")
        assert r.status_code == 200
        assert r.json()["status"] == "healthy"


# ============== Auth ==============
class TestAuth:
    def test_register_new_student(self):
        email = f"test_stud_{int(time.time())}@x.com"
        r = requests.post(f"{API}/auth/register", json={
            "email": email, "password": "Passw0rd!", "name": "TEST Student", "role": "student"
        })
        assert r.status_code == 200, r.text
        data = r.json()
        assert "token" in data and "user" in data
        assert data["user"]["email"] == email.lower()
        assert data["user"]["role"] == "student"

    def test_register_invalid_role(self):
        r = requests.post(f"{API}/auth/register", json={
            "email": f"TEST_bad_{int(time.time())}@x.com",
            "password": "Passw0rd!", "name": "X", "role": "hacker"
        })
        assert r.status_code == 400

    def test_login_seeded_student(self, student_token):
        assert student_token

    def test_login_bad(self):
        r = requests.post(f"{API}/auth/login", json={"email": "nope@x.com", "password": "bad"})
        assert r.status_code == 401

    def test_me_requires_token(self):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code in (401, 403)

    def test_me_with_token(self, student_token):
        r = requests.get(f"{API}/auth/me", headers=_hdr(student_token))
        assert r.status_code == 200
        assert r.json()["email"] == STUDENT["email"]


# ============== Courses ==============
class TestCourses:
    def test_list_courses(self):
        r = requests.get(f"{API}/courses")
        assert r.status_code == 200
        data = r.json()
        # Server might return list or paged dict
        items = data if isinstance(data, list) else data.get("items", data.get("courses", []))
        assert len(items) >= 1, f"Expected seeded courses, got: {data}"
        # Save for use
        TestCourses.first_id = items[0]["id"]

    def test_get_course_detail(self):
        cid = getattr(TestCourses, "first_id", None)
        if not cid:
            pytest.skip("no course id")
        r = requests.get(f"{API}/courses/{cid}")
        assert r.status_code == 200
        assert r.json()["id"] == cid

    def test_student_cannot_create_course(self, student_token):
        r = requests.post(f"{API}/courses", headers=_hdr(student_token), json={
            "title": "TEST hack", "description": "x", "category": "x", "price": 0
        })
        assert r.status_code == 403

    def test_trainer_can_create_course(self, trainer_token):
        r = requests.post(f"{API}/courses", headers=_hdr(trainer_token), json={
            "title": "TEST Trainer Course",
            "description": "Created by test",
            "category": "Programming",
            "price": 0,
            "level": "beginner",
            "tags": ["test"],
        })
        assert r.status_code in (200, 201), r.text
        TestCourses.created_id = r.json()["id"]

    def test_enroll_course(self, student_token):
        cid = getattr(TestCourses, "first_id", None)
        if not cid:
            pytest.skip("no course id")
        r = requests.post(f"{API}/courses/{cid}/enroll", headers=_hdr(student_token))
        assert r.status_code in (200, 201, 400), r.text  # 400 if already enrolled

    def test_my_enrolled(self, student_token):
        r = requests.get(f"{API}/courses/me/enrolled", headers=_hdr(student_token))
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_list_reviews(self):
        cid = getattr(TestCourses, "first_id", None)
        if not cid:
            pytest.skip("no course id")
        r = requests.get(f"{API}/courses/{cid}/reviews")
        assert r.status_code == 200


# ============== Quizzes ==============
class TestQuizzes:
    def test_list_quizzes(self):
        r = requests.get(f"{API}/quizzes")
        assert r.status_code == 200
        items = r.json() if isinstance(r.json(), list) else r.json().get("items", [])
        if items:
            TestQuizzes.qid = items[0]["id"]

    def test_quiz_detail_hides_correct_index(self):
        qid = getattr(TestQuizzes, "qid", None)
        if not qid:
            pytest.skip("no quiz")
        r = requests.get(f"{API}/quizzes/{qid}")
        assert r.status_code == 200
        data = r.json()
        # Inspect questions
        qs = data.get("questions", [])
        for q in qs:
            assert "correct_index" not in q, "correct_index must be hidden from client"


# ============== Jobs ==============
class TestJobs:
    def test_list_jobs(self):
        r = requests.get(f"{API}/jobs")
        assert r.status_code == 200
        items = r.json() if isinstance(r.json(), list) else r.json().get("items", [])
        assert len(items) >= 1
        TestJobs.jid = items[0]["id"]

    def test_job_filters(self):
        r = requests.get(f"{API}/jobs", params={"q": "engineer"})
        assert r.status_code == 200

    def test_job_detail(self):
        jid = getattr(TestJobs, "jid", None)
        if not jid:
            pytest.skip("no job")
        r = requests.get(f"{API}/jobs/{jid}")
        assert r.status_code == 200

    def test_recruiter_can_post_job(self, recruiter_token):
        r = requests.post(f"{API}/jobs", headers=_hdr(recruiter_token), json={
            "title": "TEST QA Engineer",
            "company": "TestCo",
            "description": "Created by test",
            "location": "Remote",
            "job_type": "full-time",
            "skills": ["pytest"],
        })
        assert r.status_code in (200, 201), r.text

    def test_student_cannot_post_job(self, student_token):
        r = requests.post(f"{API}/jobs", headers=_hdr(student_token), json={
            "title": "x", "company": "x", "description": "x", "location": "x", "job_type": "full-time"
        })
        assert r.status_code == 403

    def test_apply_to_job(self, student_token):
        jid = getattr(TestJobs, "jid", None)
        if not jid:
            pytest.skip("no job")
        r = requests.post(f"{API}/jobs/{jid}/apply", headers=_hdr(student_token),
                          json={"cover_letter": "test"})
        assert r.status_code in (200, 201, 400)

    def test_my_applications(self, student_token):
        r = requests.get(f"{API}/jobs/me/applications", headers=_hdr(student_token))
        assert r.status_code == 200


# ============== AI Assistant ==============
class TestAI:
    def test_ai_chat_doubt(self, student_token):
        r = requests.post(f"{API}/ai/chat", headers=_hdr(student_token),
                          json={"mode": "doubt", "message": "What is Python in one sentence?"},
                          timeout=90)
        assert r.status_code == 200, r.text
        data = r.json()
        # Real LLM reply expected
        assert any(k in data for k in ("reply", "message", "content"))
        assert data.get("provider") in ("openai", "anthropic", "gemini"), f"Provider missing/invalid: {data}"

    def test_ai_sessions(self, student_token):
        r = requests.get(f"{API}/ai/sessions", headers=_hdr(student_token))
        assert r.status_code == 200


# ============== Chat ==============
class TestChat:
    def test_conversations_list(self, student_token):
        r = requests.get(f"{API}/chat/conversations", headers=_hdr(student_token))
        assert r.status_code == 200


# ============== Notifications ==============
class TestNotifications:
    def test_list(self, student_token):
        r = requests.get(f"{API}/notifications", headers=_hdr(student_token))
        assert r.status_code == 200

    def test_read_all(self, student_token):
        r = requests.post(f"{API}/notifications/read-all", headers=_hdr(student_token))
        assert r.status_code in (200, 204)


# ============== Payments ==============
class TestPayments:
    def test_packages(self):
        r = requests.get(f"{API}/payments/packages")
        assert r.status_code == 200
        pkgs = r.json() if isinstance(r.json(), list) else r.json().get("packages", [])
        assert len(pkgs) >= 1
        TestPayments.pid = pkgs[0]["id"] if "id" in pkgs[0] else list(pkgs[0].keys())[0]

    def test_checkout(self, student_token):
        pid = getattr(TestPayments, "pid", None)
        if not pid:
            pytest.skip("no package")
        r = requests.post(f"{API}/payments/checkout", headers=_hdr(student_token),
                          json={"package_id": pid, "origin_url": BASE_URL})
        assert r.status_code in (200, 201), r.text
        data = r.json()
        assert "url" in data or "checkout_url" in data, f"No checkout url: {data}"
        sid = data.get("session_id") or data.get("id")
        if sid:
            TestPayments.sid = sid

    def test_history(self, student_token):
        r = requests.get(f"{API}/payments/history", headers=_hdr(student_token))
        assert r.status_code == 200


# ============== Admin ==============
class TestAdmin:
    def test_admin_users(self, admin_token):
        r = requests.get(f"{API}/admin/users", headers=_hdr(admin_token))
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_admin_analytics(self, admin_token):
        r = requests.get(f"{API}/admin/analytics", headers=_hdr(admin_token))
        assert r.status_code == 200
        assert "stats" in r.json()

    def test_student_cannot_admin(self, student_token):
        r = requests.get(f"{API}/admin/analytics", headers=_hdr(student_token))
        assert r.status_code == 403


# ============== Hidden SuperAdmin ==============
class TestSuperAdmin:
    def test_sa_login_wrong_secret_returns_404(self):
        r = requests.post(f"{API}/private/internal/{SA_ROUTE}/auth", json={
            "email": SA_EMAIL, "password": SA_PASSWORD, "secret": "WRONG"
        })
        assert r.status_code == 404, f"Wrong secret must return 404 to hide existence, got {r.status_code}"

    def test_sa_login_wrong_password_returns_404(self):
        r = requests.post(f"{API}/private/internal/{SA_ROUTE}/auth", json={
            "email": SA_EMAIL, "password": "wrong", "secret": SA_SECRET
        })
        assert r.status_code == 404

    def test_sa_login_success(self):
        r = requests.post(f"{API}/private/internal/{SA_ROUTE}/auth", json={
            "email": SA_EMAIL, "password": SA_PASSWORD, "secret": SA_SECRET
        })
        assert r.status_code == 200, r.text
        token = r.json().get("token")
        assert token
        TestSuperAdmin.token = token

    def test_sa_dashboard_with_headers(self):
        token = getattr(TestSuperAdmin, "token", None)
        if not token:
            pytest.skip("no SA token")
        r = requests.get(f"{API}/private/internal/{SA_ROUTE}/analytics",
                         headers={"X-SuperAdmin-Secret": SA_SECRET, "X-SuperAdmin-Token": token})
        assert r.status_code == 200, r.text
        assert "stats" in r.json()

    def test_sa_dashboard_missing_headers_404(self):
        r = requests.get(f"{API}/private/internal/{SA_ROUTE}/analytics")
        assert r.status_code == 404

    def test_sa_not_in_users_collection(self):
        """Verify SuperAdmin NOT stored in users collection via DB query."""
        mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
        db_name = os.environ.get("DB_NAME", "test_database")
        client = MongoClient(mongo_url)
        try:
            user = client[db_name].users.find_one({"email": SA_EMAIL})
            assert user is None, "SuperAdmin email must NOT be stored in users collection"
        finally:
            client.close()


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
