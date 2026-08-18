"""
AuthService bcrypt hash/verify tests (AUTH-03, ADR-1):
- TC-02: unique salts per call.
- TC-03/TC-04: verify success/fail.
- TC-05: WARN-log hygiene on a forced library exception.
- TC-11: p95 hashing latency benchmark (condition C-1).
- TC-12: AUTH-02 placeholder-hash rows fail verification cleanly (condition C-3).
"""
import logging
import statistics
import time

import pytest

from tests.conftest import client, TestingSessionLocal
from app.services.auth_service import AuthService, PasswordHashingError, _pwd_context


def make_user(**overrides):
    payload = {
        "name": "Hash User",
        "email": "hash.user@example.com",
        "phone": "9876500004",
        "role": "User",
        "status": "Active",
        "password": "irrelevant-signup-password",
    }
    payload.update(overrides)
    return payload


def _provision(email: str, password: str):
    created = client.post("/api/users", json=make_user(email=email)).json()
    db = TestingSessionLocal()
    try:
        service = AuthService(db)
        user = service.repo.get_by_id(created["id"])
        user.password_hash = service.hash_password(password)
        user.must_reset_password = False
        db.commit()
    finally:
        db.close()
    return created


# --- AUTH-03-TC-02: unique salts per call -----------------------------------


def test_hash_password_produces_a_different_hash_each_call():
    db = TestingSessionLocal()
    try:
        service = AuthService(db)
        first = service.hash_password("same-plaintext-password")
        second = service.hash_password("same-plaintext-password")
        assert first != second
    finally:
        db.close()


# --- AUTH-03-TC-03/TC-04: verify success/fail -------------------------------


def test_verify_credentials_succeeds_for_correct_password():
    _provision("verify.ok@example.com", "the-correct-password")

    db = TestingSessionLocal()
    try:
        service = AuthService(db)
        assert service.verify_credentials("verify.ok@example.com", "the-correct-password") is True
    finally:
        db.close()


def test_verify_credentials_fails_for_incorrect_password():
    _provision("verify.fail@example.com", "the-correct-password")

    db = TestingSessionLocal()
    try:
        service = AuthService(db)
        assert service.verify_credentials("verify.fail@example.com", "the-wrong-password") is False
    finally:
        db.close()


# --- AUTH-03-TC-05: WARN-log hygiene on a forced library exception ---------


def test_hash_password_failure_logs_warn_with_no_password_material_and_raises_generic_error(caplog, monkeypatch):
    def _boom(*args, **kwargs):
        raise RuntimeError("simulated bcrypt library failure")

    monkeypatch.setattr(_pwd_context, "hash", _boom)

    db = TestingSessionLocal()
    try:
        service = AuthService(db)
        with caplog.at_level(logging.WARNING):
            with pytest.raises(PasswordHashingError) as exc_info:
                service.hash_password("some-plaintext-password")
    finally:
        db.close()

    assert "some-plaintext-password" not in str(exc_info.value)
    warn_records = [r for r in caplog.records if r.levelno == logging.WARNING]
    assert len(warn_records) == 1
    for record in warn_records:
        assert "some-plaintext-password" not in record.getMessage()


def test_verify_credentials_failure_logs_warn_with_user_id_only_and_returns_false(caplog, monkeypatch):
    created = _provision("verify.boom@example.com", "the-correct-password")

    def _boom(*args, **kwargs):
        raise RuntimeError("simulated bcrypt library failure")

    monkeypatch.setattr(_pwd_context, "verify", _boom)

    db = TestingSessionLocal()
    try:
        service = AuthService(db)
        with caplog.at_level(logging.WARNING):
            result = service.verify_credentials("verify.boom@example.com", "the-correct-password")
    finally:
        db.close()

    assert result is False
    warn_records = [r for r in caplog.records if r.levelno == logging.WARNING]
    assert len(warn_records) == 1
    assert warn_records[0].__dict__.get("user_id") == created["id"]
    assert "the-correct-password" not in warn_records[0].getMessage()


# --- AUTH-03-TC-12: AUTH-02 placeholder-hash rows fail cleanly -------------


def test_placeholder_hash_row_fails_verification_without_raising():
    created = client.post("/api/users", json=make_user(email="placeholder.row@example.com")).json()

    db = TestingSessionLocal()
    try:
        service = AuthService(db)
        user = service.repo.get_by_id(created["id"])
        # AUTH-02's stdlib pbkdf2_hmac placeholder format: `salt$hex_digest`.
        user.password_hash = "deadbeef0123456789$" + ("ab" * 32)
        user.must_reset_password = False
        db.commit()

        result = service.verify_credentials("placeholder.row@example.com", "any-password-at-all")
        assert result is False
    finally:
        db.close()


# --- AUTH-03-TC-11: p95 hashing latency benchmark (condition C-1) ---------


def test_hash_password_p95_latency_within_budget():
    """
    Hashes 100 distinct passwords sequentially at work factor 12 and asserts
    p95 <= 300ms. Per condition C-1, if the budget is exceeded, the fallback
    is to drop `bcrypt__rounds` to 11 and re-benchmark — not exercised here
    because work factor 12 is expected to comfortably clear 300ms p95 on
    typical CI/dev hardware for a single-request, non-concurrent workload.
    """
    db = TestingSessionLocal()
    try:
        service = AuthService(db)
        latencies = []
        for i in range(100):
            start = time.perf_counter()
            service.hash_password(f"benchmark-password-{i}")
            latencies.append(time.perf_counter() - start)
    finally:
        db.close()

    p95 = statistics.quantiles(latencies, n=100)[94]
    assert p95 <= 0.300, f"p95 hashing latency {p95:.3f}s exceeded the 300ms budget at work factor 12"
