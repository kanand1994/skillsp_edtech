"""Phase 3 backend tests — Piston/coding, Forum, AI Quiz Gen."""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://learn-jobs-hub.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

CREDS = {
    "student": ("student@skillsphere.demo", "Student@123"),
    "trainer": ("trainer1@skillsphere.demo", "Trainer@123"),
    "recruiter": ("recruiter@skillsphere.demo", "Recruiter@123"),
    "admin": ("admin@skillsphere.demo", "Admin@123"),
}


def _login(role: str) -> str:
    email, pw = CREDS[role]
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": pw}, timeout=15)
    assert r.status_code == 200, f"Login failed for {role}: {r.text}"
    return r.json()["access_token"] if "access_token" in r.json() else r.json()["token"]


def _h(tok: str) -> dict:
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


# ---------------- Coding / Piston ----------------
class TestCoding:
    def test_languages_local_only(self):
        r = requests.get(f"{API}/coding/languages", timeout=10)
        assert r.status_code == 200
        langs = r.json()
        ids = {l["id"] for l in langs}
        assert "python" in ids and "javascript" in ids
        # Piston disabled in dev, so all must be via=local
        for l in langs:
            assert l["via"] == "local", f"Unexpected via for {l['id']}: {l['via']}"

    def test_probe_piston_disabled(self):
        r = requests.get(f"{API}/coding/_probe", timeout=10)
        assert r.status_code == 200
        assert r.json()["piston_enabled"] is False

    def test_run_python_regression(self):
        tok = _login("student")
        r = requests.post(f"{API}/coding/run", headers=_h(tok),
                          json={"language": "python", "code": "print('hi-phase3')"}, timeout=20)
        assert r.status_code == 200
        body = r.json()
        assert "hi-phase3" in body["stdout"]
        assert body["exit_code"] == 0

    def test_run_java_returns_400(self):
        tok = _login("student")
        r = requests.post(f"{API}/coding/run", headers=_h(tok),
                          json={"language": "java", "code": "class A{}"}, timeout=15)
        assert r.status_code == 400
        detail = r.json().get("detail", "")
        assert "not available" in detail.lower() or "piston" in detail.lower()


# ---------------- Forum ----------------
class TestForum:
    @classmethod
    def setup_class(cls):
        cls.s_tok = _login("student")
        cls.t_tok = _login("trainer")
        cls.a_tok = _login("admin")
        cls.created_tids = []

    def test_list_threads_sorted_pinned_first(self):
        r = requests.get(f"{API}/forum", timeout=10)
        assert r.status_code == 200
        threads = r.json()
        assert isinstance(threads, list) and len(threads) >= 4
        # pinned first
        pinned_idx = [i for i, t in enumerate(threads) if t.get("is_pinned")]
        unpinned_idx = [i for i, t in enumerate(threads) if not t.get("is_pinned")]
        if pinned_idx and unpinned_idx:
            assert max(pinned_idx) < min(unpinned_idx)

    def test_create_thread_student(self):
        payload = {"title": "TEST_PH3 thread for testing", "body": "hello forum", "category": "Q&A", "tags": ["test"]}
        r = requests.post(f"{API}/forum", headers=_h(self.s_tok), json=payload, timeout=10)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["author_role"] == "student"
        assert d["upvotes"] == 0 and d["replies_count"] == 0
        TestForum.created_tids.append(d["id"])

    def test_filter_category_qa(self):
        r = requests.get(f"{API}/forum", params={"category": "Q&A"}, timeout=10)
        assert r.status_code == 200
        for t in r.json():
            assert t["category"] == "Q&A"

    def test_filter_q_search(self):
        r = requests.get(f"{API}/forum", params={"q": "TEST_PH3"}, timeout=10)
        assert r.status_code == 200
        titles = [t["title"] for t in r.json()]
        assert any("TEST_PH3" in t for t in titles)

    def test_sort_top(self):
        r = requests.get(f"{API}/forum", params={"sort": "top"}, timeout=10)
        assert r.status_code == 200
        threads = r.json()
        non_pinned = [t for t in threads if not t.get("is_pinned")]
        ups = [t["upvotes"] for t in non_pinned]
        assert ups == sorted(ups, reverse=True)

    def test_sort_unanswered(self):
        r = requests.get(f"{API}/forum", params={"sort": "unanswered"}, timeout=10)
        assert r.status_code == 200
        for t in r.json():
            assert t["replies_count"] == 0

    def test_vote_toggle(self):
        tid = TestForum.created_tids[0]
        r1 = requests.post(f"{API}/forum/{tid}/vote", headers=_h(self.t_tok), timeout=10)
        assert r1.status_code == 200 and r1.json()["voted"] is True
        upvotes_after = r1.json()["upvotes"]
        # toggle off
        r2 = requests.post(f"{API}/forum/{tid}/vote", headers=_h(self.t_tok), timeout=10)
        assert r2.status_code == 200 and r2.json()["voted"] is False
        assert r2.json()["upvotes"] == upvotes_after - 1

    def test_add_reply_increments_count(self):
        tid = TestForum.created_tids[0]
        before = requests.get(f"{API}/forum/{tid}", timeout=10).json()
        r = requests.post(f"{API}/forum/{tid}/replies", headers=_h(self.t_tok),
                          json={"body": "TEST_PH3 reply"}, timeout=10)
        assert r.status_code == 200, r.text
        after = requests.get(f"{API}/forum/{tid}", timeout=10).json()
        assert after["replies_count"] == before["replies_count"] + 1
        assert after["last_activity_at"] >= before["last_activity_at"]
        TestForum.last_rid = r.json()["id"]

    def test_reply_on_locked_thread_403(self):
        tid = TestForum.created_tids[0]
        # admin locks it
        rl = requests.post(f"{API}/forum/{tid}/lock", headers=_h(self.a_tok), timeout=10)
        assert rl.status_code == 200
        r = requests.post(f"{API}/forum/{tid}/replies", headers=_h(self.t_tok),
                          json={"body": "should fail"}, timeout=10)
        assert r.status_code == 403
        # unlock for cleanup
        requests.post(f"{API}/forum/{tid}/lock", headers=_h(self.a_tok), timeout=10)

    def test_accept_reply_only_author_or_admin(self):
        tid = TestForum.created_tids[0]
        # trainer (not author) trying to accept -> 403
        rid = TestForum.last_rid
        r_fail = requests.post(f"{API}/forum/replies/{rid}/accept", headers=_h(self.t_tok), timeout=10)
        assert r_fail.status_code == 403
        # student (the author) accepts -> 200
        r_ok = requests.post(f"{API}/forum/replies/{rid}/accept", headers=_h(self.s_tok), timeout=10)
        assert r_ok.status_code == 200
        # verify is_accepted
        replies = requests.get(f"{API}/forum/{tid}/replies", timeout=10).json()
        accepted = [x for x in replies if x.get("is_accepted")]
        assert len(accepted) == 1 and accepted[0]["id"] == rid

    def test_pin_admin_only(self):
        tid = TestForum.created_tids[0]
        # student cannot pin
        r_fail = requests.post(f"{API}/forum/{tid}/pin", headers=_h(self.s_tok), timeout=10)
        assert r_fail.status_code == 403
        r_ok = requests.post(f"{API}/forum/{tid}/pin", headers=_h(self.a_tok), timeout=10)
        assert r_ok.status_code == 200
        # toggle off
        requests.post(f"{API}/forum/{tid}/pin", headers=_h(self.a_tok), timeout=10)

    def test_delete_thread_author_or_admin(self):
        # create a throwaway
        payload = {"title": "TEST_PH3 to delete", "body": "x", "category": "General"}
        r = requests.post(f"{API}/forum", headers=_h(self.s_tok), json=payload, timeout=10)
        tid = r.json()["id"]
        # other user (trainer) cannot delete
        r_fail = requests.delete(f"{API}/forum/{tid}", headers=_h(self.t_tok), timeout=10)
        assert r_fail.status_code == 403
        # author deletes
        r_ok = requests.delete(f"{API}/forum/{tid}", headers=_h(self.s_tok), timeout=10)
        assert r_ok.status_code == 200

    @classmethod
    def teardown_class(cls):
        # cleanup created threads
        for tid in cls.created_tids:
            requests.delete(f"{API}/forum/{tid}", headers=_h(cls.a_tok), timeout=10)


# ---------------- AI Quiz ----------------
class TestAIQuiz:
    @classmethod
    def setup_class(cls):
        cls.t_tok = _login("trainer")
        cls.s_tok = _login("student")
        # find a course id
        r = requests.get(f"{API}/courses", timeout=10)
        cls.course_id = r.json()[0]["id"] if r.json() else None
        cls.quiz_ids = []

    def test_student_forbidden(self):
        r = requests.post(f"{API}/ai-quiz/generate", headers=_h(self.s_tok),
                          json={"source_text": "Python is a language", "num_questions": 2}, timeout=30)
        assert r.status_code == 403

    def test_missing_inputs_400(self):
        r = requests.post(f"{API}/ai-quiz/generate", headers=_h(self.t_tok),
                          json={"num_questions": 2}, timeout=30)
        assert r.status_code == 400

    def test_generate_with_course(self):
        assert self.course_id, "No seeded course found"
        r = requests.post(f"{API}/ai-quiz/generate", headers=_h(self.t_tok),
                          json={"course_id": self.course_id, "num_questions": 3,
                                "difficulty": "Medium", "save": True}, timeout=120)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "title" in d and "questions" in d
        assert len(d["questions"]) >= 1
        for q in d["questions"]:
            assert "id" in q and "question" in q and len(q["options"]) == 4
            assert 0 <= q["correct_index"] <= 3
        assert d.get("saved") is True and "quiz_id" in d
        TestAIQuiz.quiz_ids.append(d["quiz_id"])

        # GET /api/quizzes/{quiz_id} should hide correct_index
        rq = requests.get(f"{API}/quizzes/{d['quiz_id']}", headers=_h(self.s_tok), timeout=10)
        assert rq.status_code == 200
        quiz = rq.json()
        for q in quiz.get("questions", []):
            assert "correct_index" not in q, "correct_index leaked to student GET response"

    def test_generate_with_source_text(self):
        r = requests.post(f"{API}/ai-quiz/generate", headers=_h(self.t_tok),
                          json={"source_text": "REST APIs use HTTP methods like GET, POST, PUT, DELETE. "
                                               "Status code 200 means OK, 404 means not found, "
                                               "500 means server error.",
                                "num_questions": 2, "difficulty": "Easy", "save": False}, timeout=120)
        assert r.status_code == 200, r.text
        d = r.json()
        assert len(d["questions"]) >= 1
        assert d.get("saved") is None or d.get("saved") is False or "quiz_id" not in d
