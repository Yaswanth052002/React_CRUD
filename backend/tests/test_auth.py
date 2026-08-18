"""
Auth endpoint tests (AUTH-02): login happy-path, generic-error consistency
(AC2/AC3), rate limiting (FR-6), the AuthService/UserService module
boundary (FR-7), log hygiene (NFR-security), and JWT signing (ADR-5).
"""
import inspect
import logging
import os

import jwt
import pytest

from tests.conftest import client, TestingSessionLocal
from app.services.auth_service import AuthService, INVALID_CREDENTIALS_MESSAGE, _failed_attempts
from app.services import user_service as user_service_module


def make_user(**overrides):
    payload = {
        "name": "Test User",
        "email": "auth.user@example.com",
        "phone": "9876500000",
        "role": "User",
        "status": "Active",
        "password": "irrelevant-signup-password",
    }
    payload.update(overrides)
    return payload


@pytest.fixture(autouse=True)
def _clear_rate_limit_state():
    """Rate-limit state is a module-level dict (ADR-2) — isolate tests from each other."""
    _failed_attempts.clear()
    yield
    _failed_attempts.clear()


def _provision(email: str, password: str, must_reset: bool = False):
    """Create a user via the CRUD API, then give it a real credential directly via AuthService."""
    created = client.post("/api/users", json=make_user(email=email)).json()
    db = TestingSessionLocal()
    try:
        service = AuthService(db)
        user = service.repo.get_by_id(created["id"])
        user.password_hash = service.hash_password(password)
        user.must_reset_password = must_reset
        db.commit()
    finally:
        db.close()
    return created


# --- AC1: valid login -----------------------------------------------------


def test_valid_login_returns_token_and_does_not_duplicate_row():
    _provision("valid.login@example.com", "correct-horse-battery-staple")

    before = client.get("/api/users").json()["total"]
    resp = client.post("/api/auth/login", json={"email": "valid.login@example.com", "password": "correct-horse-battery-staple"})
    after = client.get("/api/users").json()["total"]

    assert resp.status_code == 200
    assert "token" in resp.json()
    assert after == before


def test_login_response_never_exposes_password_hash_or_must_reset_flag():
    _provision("no.leak@example.com", "another-strong-password")
    resp = client.post("/api/auth/login", json={"email": "no.leak@example.com", "password": "another-strong-password"})
    assert resp.status_code == 200
    body = resp.json()
    assert set(body.keys()) == {"token"}


# --- AC2: generic error, identical for unknown-email and wrong-password ---


def test_login_unknown_email_returns_generic_401():
    resp = client.post("/api/auth/login", json={"email": "nobody@example.com", "password": "whatever"})
    assert resp.status_code == 401
    assert resp.json() == {"detail": INVALID_CREDENTIALS_MESSAGE}


def test_login_wrong_password_matches_unknown_email_response_byte_for_byte():
    _provision("wrong.pw@example.com", "the-real-password")

    unknown_resp = client.post("/api/auth/login", json={"email": "nobody2@example.com", "password": "whatever"})
    wrong_resp = client.post("/api/auth/login", json={"email": "wrong.pw@example.com", "password": "not-the-real-password"})

    assert wrong_resp.status_code == unknown_resp.status_code == 401
    assert wrong_resp.json() == unknown_resp.json() == {"detail": INVALID_CREDENTIALS_MESSAGE}


# --- AC3: unprovisioned (must_reset_password=true) account ---------------


def test_login_rejected_for_must_reset_password_user_same_generic_error():
    _provision("needs.reset@example.com", "some-password", must_reset=True)
    resp = client.post("/api/auth/login", json={"email": "needs.reset@example.com", "password": "some-password"})
    assert resp.status_code == 401
    assert resp.json() == {"detail": INVALID_CREDENTIALS_MESSAGE}


# --- FR-6: rate limiting ---------------------------------------------------


def test_rate_limiter_returns_429_after_three_failed_attempts():
    email = "rate.limited@example.com"
    for _ in range(3):
        resp = client.post("/api/auth/login", json={"email": email, "password": "wrong"})
        assert resp.status_code == 401

    fourth = client.post("/api/auth/login", json={"email": email, "password": "wrong"})
    assert fourth.status_code == 429
    assert "Retry-After" in fourth.headers


def test_rate_limiter_blocks_even_a_valid_fourth_attempt():
    email = "rate.limited.valid@example.com"
    _provision(email, "correct-password")
    for _ in range(3):
        client.post("/api/auth/login", json={"email": email, "password": "wrong"})

    fourth = client.post("/api/auth/login", json={"email": email, "password": "correct-password"})
    assert fourth.status_code == 429


# --- FR-7: AuthService/UserService module boundary (contract) -------------


def test_auth_logic_is_isolated_to_auth_service():
    auth_methods = {name for name, _ in inspect.getmembers(AuthService, predicate=inspect.isfunction)}
    user_service_methods = {
        name for name, _ in inspect.getmembers(user_service_module.UserService, predicate=inspect.isfunction)
    }

    for name in ("login", "provision_existing_users_with_random_password", "set_user_initial_password"):
        assert name in auth_methods
        assert name not in user_service_methods


# --- NFR-security: log hygiene --------------------------------------------


def test_login_attempts_never_log_plaintext_email_or_password(caplog):
    email = "log.hygiene@example.com"
    password = "super-secret-password"
    _provision(email, password)

    with caplog.at_level(logging.INFO):
        client.post("/api/auth/login", json={"email": email, "password": "wrong-one"})
        client.post("/api/auth/login", json={"email": email, "password": password})
        client.post("/api/auth/login", json={"email": "unknown.user@example.com", "password": "whatever"})

    for record in caplog.records:
        text = record.getMessage()
        assert email not in text
        assert password not in text
        assert "unknown.user@example.com" not in text


# --- ADR-5 (amendment): real JWT signing -----------------------------------


def test_login_returns_a_real_signed_jwt_with_expected_claims():
    email = "jwt.claims@example.com"
    password = "jwt-password"
    _provision(email, password)

    resp = client.post("/api/auth/login", json={"email": email, "password": password})
    assert resp.status_code == 200
    token = resp.json()["token"]

    assert token.count(".") == 2

    decoded = jwt.decode(token, os.environ["JWT_SECRET_KEY"], algorithms=["HS256"])
    assert decoded["sub"] == email
    assert "exp" in decoded


def test_login_fails_generically_when_jwt_secret_key_is_unset(monkeypatch):
    email = "no.secret@example.com"
    password = "some-password"
    _provision(email, password)

    monkeypatch.delenv("JWT_SECRET_KEY", raising=False)

    resp = client.post("/api/auth/login", json={"email": email, "password": password})

    assert resp.status_code == 500
    assert resp.json() == {"detail": "Could not process login. Please try again later."}
    assert "jwt" not in resp.text.lower()
    assert "traceback" not in resp.text.lower()
