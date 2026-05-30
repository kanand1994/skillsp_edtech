"""Certificates feature backend tests (Shareable Certificate + Viral Referral Loop)."""
import os
import time
import pytest
import requests

BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or "https://learn-jobs-hub.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

STUDENT = {"email": "student@skillsphere.demo", "password": "Student@123"}
TRAINER = {"email": "trainer1@skillsphere.demo", "password": "Trainer@123"}

EXISTING_CERT_ID = "8fbe0723-1f90-4c55-b419-b4b850448ea4"


def _hdr(t):
    return {"Authorization": f"Bearer {t}"}


def _login(creds):
    r = requests.post(f"{API}/auth/login", json=creds, timeout=20)
    assert r.status_code == 200, r.text
    return r.json()


def _register(email, name="TEST User", password="Passw0rd!", role="student"):
    r = requests.post(
        f"{API}/auth/register",
        json={"email": email, "password": password, "name": name, "role": role},
        timeout=30,
    )
    return r


# ---------- Fixtures ----------
@pytest.fixture(scope="module")
def student_token():
    return _login(STUDENT)["token"]


@pytest.fixture(scope="module")
def trainer_token():
    return _login(TRAINER)["token"]


@pytest.fixture(scope="module")
def fresh_student():
    ts = int(time.time())
    email = f"test_cert_stu_{ts}@example.com"
    r = _register(email, name="TEST CertStudent")
    assert r.status_code == 200, r.text
    return {"token": r.json()["token"], "user": r.json()["user"]}


@pytest.fixture(scope="module")
def quiz_with_known_answers(trainer_token):
    """Create a quiz so we can submit a known-correct set of answers."""
    payload = {
        "title": f"TEST Cert Quiz {int(time.time())}",
        "description": "auto-gen for cert tests",
        "duration_min": 5,
        "questions": [
            {"question": "2+2?", "options": ["3", "4", "5", "6"], "correct_index": 1},
            {"question": "Capital of France?", "options": ["Berlin", "Madrid", "Paris", "Rome"], "correct_index": 2},
            {"question": "Largest planet?", "options": ["Earth", "Jupiter", "Mars", "Saturn"], "correct_index": 1},
            {"question": "Sky color?", "options": ["Green", "Blue", "Red", "Purple"], "correct_index": 1},
            {"question": "Pi approx?", "options": ["2.14", "3.14", "4.14", "5.14"], "correct_index": 1},
        ],
    }
    r = requests.post(f"{API}/quizzes", headers=_hdr(trainer_token), json=payload, timeout=20)
    assert r.status_code == 200, r.text
    return r.json()


# ============ PUBLIC verify ============
class TestVerifyPublic:
    def test_existing_cert_public_no_auth(self):
        r = requests.get(f"{API}/certificates/verify/{EXISTING_CERT_ID}", timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["id"] == EXISTING_CERT_ID
        assert d["verified"] is True
        assert d["issuer"] == "SkillSphere"
        assert "referrer_code" in d and isinstance(d["referrer_code"], str) and len(d["referrer_code"]) == 8
        assert d["referrer_code"] == d["referrer_code"].upper()
        # Cert holder is Alex Kim (student demo), should match 4B4F24AE
        assert d["referrer_code"] == "4B4F24AE"
        for k in ("user_name", "source_type", "source_title", "credential_id", "issued_at"):
            assert k in d

    def test_nonexistent_cert_returns_404(self):
        r = requests.get(f"{API}/certificates/verify/does-not-exist-xyz", timeout=20)
        assert r.status_code == 404


# ============ GET /me ============
class TestMyCerts:
    def test_requires_auth(self):
        r = requests.get(f"{API}/certificates/me", timeout=20)
        assert r.status_code in (401, 403)

    def test_student_lists_certs_sorted(self, student_token):
        r = requests.get(f"{API}/certificates/me", headers=_hdr(student_token), timeout=20)
        assert r.status_code == 200, r.text
        certs = r.json()
        assert isinstance(certs, list)
        # Should contain the existing cert
        ids = [c["id"] for c in certs]
        assert EXISTING_CERT_ID in ids
        # Sorted desc by issued_at
        if len(certs) > 1:
            issued = [c["issued_at"] for c in certs]
            assert issued == sorted(issued, reverse=True)


# ============ Auto-issue on quiz pass ============
class TestQuizCertIssuance:
    def test_pass_quiz_returns_cert_id_and_is_listed(self, fresh_student, quiz_with_known_answers):
        quiz = quiz_with_known_answers
        # All correct → score 100
        correct_answers = [q["correct_index"] for q in quiz["questions"]]
        r = requests.post(
            f"{API}/quizzes/{quiz['id']}/submit",
            headers=_hdr(fresh_student["token"]),
            json={"answers": correct_answers},
            timeout=20,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["score"] == 100
        assert d["certificate_id"], "expected certificate_id in response for score>=70"
        cert_id = d["certificate_id"]

        # Verify visible via /me
        me = requests.get(f"{API}/certificates/me", headers=_hdr(fresh_student["token"]), timeout=20)
        assert me.status_code == 200
        assert any(c["id"] == cert_id for c in me.json())

        # Verifiable publicly
        v = requests.get(f"{API}/certificates/verify/{cert_id}", timeout=20)
        assert v.status_code == 200
        vj = v.json()
        assert vj["source_type"] == "quiz"
        assert vj["score"] == 100
        assert vj["verified"] is True

    def test_fail_quiz_no_cert(self, quiz_with_known_answers):
        # Fresh student so attempts collection is clean
        ts = int(time.time())
        reg = _register(f"test_cert_failstu_{ts}@example.com", name="TEST FailStu")
        assert reg.status_code == 200
        token = reg.json()["token"]

        quiz = quiz_with_known_answers
        # All wrong (use 0 unless correct is 0)
        wrong = [(q["correct_index"] + 1) % len(q["options"]) for q in quiz["questions"]]
        r = requests.post(
            f"{API}/quizzes/{quiz['id']}/submit",
            headers=_hdr(token),
            json={"answers": wrong},
            timeout=20,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["score"] < 70
        assert d["certificate_id"] is None
        # Not in /me
        me = requests.get(f"{API}/certificates/me", headers=_hdr(token), timeout=20).json()
        assert me == [] or all(c["source_id"] != quiz["id"] for c in me)

    def test_idempotent_quiz_resubmission(self, fresh_student, quiz_with_known_answers):
        # fresh_student already submitted with score=100 above; submit again
        quiz = quiz_with_known_answers
        correct_answers = [q["correct_index"] for q in quiz["questions"]]
        r = requests.post(
            f"{API}/quizzes/{quiz['id']}/submit",
            headers=_hdr(fresh_student["token"]),
            json={"answers": correct_answers},
            timeout=20,
        )
        assert r.status_code == 200
        # Same cert id returned (idempotent)
        me = requests.get(f"{API}/certificates/me", headers=_hdr(fresh_student["token"]), timeout=20).json()
        quiz_certs = [c for c in me if c["source_type"] == "quiz" and c["source_id"] == quiz["id"]]
        assert len(quiz_certs) == 1, f"expected exactly one quiz cert, got {len(quiz_certs)}"


# ============ Course completion cert ============
@pytest.fixture(scope="module")
def course_with_lessons(trainer_token):
    """Trainer creates a course with 2 lessons so tests can complete it."""
    payload = {
        "title": f"TEST Cert Course {int(time.time())}",
        "description": "for cert tests",
        "category": "Testing",
        "level": "Beginner",
        "price": 0.0,
        "tags": ["test", "cert"],
        "lessons": [
            {"title": "Lesson 1", "description": "intro", "video_url": "", "duration_min": 5},
            {"title": "Lesson 2", "description": "more", "video_url": "", "duration_min": 5},
        ],
    }
    r = requests.post(f"{API}/courses", headers=_hdr(trainer_token), json=payload, timeout=20)
    assert r.status_code == 200, r.text
    return r.json()


class TestCourseCertIssuance:
    def _enroll_and_complete_first_course(self, token, course_with_lessons):
        target = course_with_lessons
        # Enroll
        enr = requests.post(f"{API}/courses/{target['id']}/enroll", headers=_hdr(token), timeout=20)
        # 200 or 400 if already enrolled — both ok
        assert enr.status_code in (200, 400), enr.text
        # Mark every lesson complete
        for lesson in target["lessons"]:
            pr = requests.post(
                f"{API}/courses/{target['id']}/progress",
                headers=_hdr(token),
                json={"lesson_id": lesson["id"], "completed": True},
                timeout=20,
            )
            assert pr.status_code == 200, pr.text
        last = pr.json()
        return target, last

    def test_course_completion_issues_cert(self, course_with_lessons):
        ts = int(time.time())
        reg = _register(f"test_cert_course_{ts}@example.com", name="TEST CourseCert")
        assert reg.status_code == 200
        token = reg.json()["token"]

        course, last = self._enroll_and_complete_first_course(token, course_with_lessons)
        assert last["progress_pct"] >= 100

        me = requests.get(f"{API}/certificates/me", headers=_hdr(token), timeout=20).json()
        course_certs = [c for c in me if c["source_type"] == "course" and c["source_id"] == course["id"]]
        assert len(course_certs) == 1, f"expected 1 course cert, got {len(course_certs)}"
        cert = course_certs[0]
        # Course cert should NOT carry a score
        assert cert.get("score") in (None,), f"course cert should have no score, got {cert.get('score')}"
        # Public verify
        v = requests.get(f"{API}/certificates/verify/{cert['id']}", timeout=20).json()
        assert v["verified"] is True
        assert v["source_type"] == "course"

    def test_course_progress_repeat_100_idempotent(self, course_with_lessons):
        ts = int(time.time())
        reg = _register(f"test_cert_course2_{ts}@example.com", name="TEST CourseCert2")
        token = reg.json()["token"]

        course, _ = self._enroll_and_complete_first_course(token, course_with_lessons)
        # Hit the last lesson completion again
        last_lesson_id = course["lessons"][-1]["id"]
        for _ in range(3):
            r = requests.post(
                f"{API}/courses/{course['id']}/progress",
                headers=_hdr(token),
                json={"lesson_id": last_lesson_id, "completed": True},
                timeout=20,
            )
            assert r.status_code == 200

        me = requests.get(f"{API}/certificates/me", headers=_hdr(token), timeout=20).json()
        course_certs = [c for c in me if c["source_type"] == "course" and c["source_id"] == course["id"]]
        assert len(course_certs) == 1


# ============ Referrer code presence on verify ============
class TestReferrerCodeOnVerify:
    def test_referrer_code_matches_first8_of_user_id(self, fresh_student, quiz_with_known_answers):
        # fresh_student should have a cert from earlier test
        me = requests.get(f"{API}/certificates/me", headers=_hdr(fresh_student["token"]), timeout=20).json()
        assert me, "no certs for fresh student"
        cert = me[0]
        v = requests.get(f"{API}/certificates/verify/{cert['id']}", timeout=20).json()
        expected = fresh_student["user"]["id"].replace("-", "")[:8].upper()
        assert v["referrer_code"] == expected


# ============ Regression: existing endpoints ============
class TestRegressions:
    def test_login(self):
        r = requests.post(f"{API}/auth/login", json=STUDENT, timeout=20)
        assert r.status_code == 200

    def test_courses_list(self):
        assert requests.get(f"{API}/courses", timeout=20).status_code == 200

    def test_jobs_list(self):
        assert requests.get(f"{API}/jobs", timeout=20).status_code == 200

    def test_gamification_me(self, student_token):
        assert requests.get(f"{API}/gamification/me", headers=_hdr(student_token), timeout=20).status_code == 200

    def test_referrals_me(self, student_token):
        r = requests.get(f"{API}/referrals/me", headers=_hdr(student_token), timeout=20)
        assert r.status_code == 200
        assert r.json()["code"] == "4B4F24AE"

    def test_referrals_leaderboard_public(self):
        assert requests.get(f"{API}/referrals/leaderboard", timeout=20).status_code == 200


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
