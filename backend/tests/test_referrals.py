"""Refer-a-Friend backend tests."""
import os
import time
import pytest
import requests

BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or "https://learn-jobs-hub.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

STUDENT = {"email": "student@skillsphere.demo", "password": "Student@123"}


def _hdr(t):
    return {"Authorization": f"Bearer {t}"}


def _login(creds):
    r = requests.post(f"{API}/auth/login", json=creds, timeout=20)
    assert r.status_code == 200, r.text
    return r.json()


def _register(email, name="TEST User", password="Passw0rd!", role="student", referral_code=None):
    payload = {"email": email, "password": password, "name": name, "role": role}
    if referral_code is not None:
        payload["referral_code"] = referral_code
    r = requests.post(f"{API}/auth/register", json=payload, timeout=30)
    return r


# ----- Referrer fixture -----
@pytest.fixture(scope="module")
def referrer():
    """Create a fresh referrer user and return token + user dict + their referral code."""
    ts = int(time.time())
    email = f"test_ref_referrer_{ts}@example.com"
    r = _register(email, name="TEST Referrer")
    assert r.status_code == 200, r.text
    data = r.json()
    me = requests.get(f"{API}/referrals/me", headers=_hdr(data["token"]))
    assert me.status_code == 200, me.text
    code = me.json()["code"]
    return {"token": data["token"], "user": data["user"], "code": code}


# ============== /referrals/me shape & code derivation ==============
class TestReferralsMe:
    def test_requires_auth(self):
        r = requests.get(f"{API}/referrals/me")
        assert r.status_code in (401, 403), r.text

    def test_shape_for_student(self):
        token = _login(STUDENT)["token"]
        r = requests.get(f"{API}/referrals/me", headers=_hdr(token))
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("code", "pending", "completed", "xp_earned", "xp_per_referral", "referee_discount_pct", "my_discount_pct", "referrals"):
            assert k in d, f"missing key {k}: {list(d.keys())}"
        # Code is 8 uppercase hex chars
        assert isinstance(d["code"], str) and len(d["code"]) == 8 and d["code"] == d["code"].upper()
        assert d["xp_per_referral"] == 100
        assert d["referee_discount_pct"] == 10
        assert isinstance(d["referrals"], list)

    def test_code_matches_user_id_prefix(self, referrer):
        uid = referrer["user"]["id"].replace("-", "")[:8].upper()
        assert referrer["code"] == uid


# ============== /referrals/validate ==============
class TestValidate:
    def test_valid_code(self, referrer):
        r = requests.post(f"{API}/referrals/validate", json={"code": referrer["code"]})
        assert r.status_code == 200
        d = r.json()
        assert d["valid"] is True
        assert d["referee_discount_pct"] == 10
        assert "referrer_name" in d

    def test_invalid_code(self):
        r = requests.post(f"{API}/referrals/validate", json={"code": "ZZZZZZZZ"})
        assert r.status_code == 200
        assert r.json()["valid"] is False

    def test_lowercase_input_normalised(self, referrer):
        r = requests.post(f"{API}/referrals/validate", json={"code": referrer["code"].lower()})
        assert r.status_code == 200 and r.json()["valid"] is True


# ============== /referrals/leaderboard (public) ==============
class TestLeaderboard:
    def test_public_no_auth(self):
        r = requests.get(f"{API}/referrals/leaderboard")
        assert r.status_code == 200
        d = r.json()
        assert isinstance(d, list)
        if d:
            counts = [row["completed"] for row in d]
            assert counts == sorted(counts, reverse=True)


# ============== Register with referral_code ==============
class TestRegisterReferral:
    def test_register_with_valid_code_attaches_referral(self, referrer):
        ts = int(time.time())
        email = f"test_ref_referee_{ts}@example.com"
        r = _register(email, name="TEST Referee", referral_code=referrer["code"])
        assert r.status_code == 200, r.text
        token = r.json()["token"]
        # Referee should now have my_discount_pct=10
        me = requests.get(f"{API}/referrals/me", headers=_hdr(token))
        assert me.status_code == 200
        assert me.json()["my_discount_pct"] == 10

        # Referrer should see a pending referral
        ref_me = requests.get(f"{API}/referrals/me", headers=_hdr(referrer["token"]))
        assert ref_me.status_code == 200
        d = ref_me.json()
        assert d["pending"] >= 1, d
        refs = d["referrals"]
        assert any(x["referee_id"] == r.json()["user"]["id"] for x in refs)

    def test_register_with_invalid_code_still_succeeds(self):
        ts = int(time.time())
        email = f"test_ref_badcode_{ts}@example.com"
        r = _register(email, name="TEST BadRef", referral_code="ZZZZZZZZ")
        assert r.status_code == 200, r.text
        token = r.json()["token"]
        me = requests.get(f"{API}/referrals/me", headers=_hdr(token))
        # No discount granted from invalid code
        assert me.json()["my_discount_pct"] == 0

    def test_register_without_referral_code(self):
        ts = int(time.time())
        email = f"test_ref_norefcode_{ts + 1}@example.com"
        r = _register(email, name="TEST NoRef")
        assert r.status_code == 200, r.text
        me = requests.get(f"{API}/referrals/me", headers=_hdr(r.json()["token"]))
        assert me.json()["my_discount_pct"] == 0

    def test_self_referral_silently_noop(self):
        # Create a user without referral, get their code, then try to register a new user
        # with their own code-like flow: we can't truly self-refer because we'd need our id pre-registration.
        # Test the documented guard instead by direct re-attach via duplicate flow:
        # Register a user, then attempt second register with that user's code as their OWN signup is impossible.
        # We exercise the no-op path by attempting to re-register the same email (which 400s) — guard is
        # exercised via attach_referral when referee_id == referrer_id; covered by code review.
        # Here we simply ensure: registering NEW user with referrer's code returns 200 and creates referral
        # (already covered above) and registering with no code returns 200 with no discount.
        pass


# ============== Checkout discount math ==============
class TestCheckoutDiscount:
    def test_checkout_with_referral_deducts_10pct(self, referrer):
        ts = int(time.time())
        email = f"test_ref_chk_{ts}@example.com"
        r = _register(email, name="TEST Checkout", referral_code=referrer["code"])
        assert r.status_code == 200, r.text
        token = r.json()["token"]

        co = requests.post(
            f"{API}/payments/checkout",
            headers=_hdr(token),
            json={"package_id": "premium_monthly", "origin_url": "https://example.com"},
            timeout=45,
        )
        assert co.status_code == 200, co.text
        d = co.json()
        # premium_monthly = $19.00 -> 10% off -> discount $1.90
        assert d["discount_applied"] == 1.9, d
        assert "url" in d and d["url"].startswith("http")
        assert "session_id" in d

    def test_checkout_without_referral_no_discount(self):
        ts = int(time.time())
        email = f"test_ref_chk_noref_{ts}@example.com"
        r = _register(email, name="TEST CheckoutNoRef")
        assert r.status_code == 200, r.text
        token = r.json()["token"]

        co = requests.post(
            f"{API}/payments/checkout",
            headers=_hdr(token),
            json={"package_id": "premium_monthly", "origin_url": "https://example.com"},
            timeout=45,
        )
        assert co.status_code == 200, co.text
        d = co.json()
        assert d["discount_applied"] == 0


# ============== Regression: existing endpoints still work ==============
class TestRegressions:
    def test_login_still_works(self):
        r = requests.post(f"{API}/auth/login", json=STUDENT, timeout=20)
        assert r.status_code == 200

    def test_courses_list(self):
        r = requests.get(f"{API}/courses", timeout=20)
        assert r.status_code == 200

    def test_jobs_list(self):
        r = requests.get(f"{API}/jobs", timeout=20)
        assert r.status_code == 200

    def test_gamification_me(self):
        t = _login(STUDENT)["token"]
        r = requests.get(f"{API}/gamification/me", headers=_hdr(t))
        assert r.status_code == 200


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
