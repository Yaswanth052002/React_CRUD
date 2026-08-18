"""
Config/startup-validation tests (AUTH-08): `.env.example` content
assertions (TC-01, TC-02) and `on_startup()`'s fail-fast `JWT_SECRET_KEY`
check (TC-05, TC-06, TC-07, TC-08).
"""
import os
import time
from pathlib import Path
from unittest.mock import patch

import pytest

from tests.conftest import TestingSessionLocal
from app.main import on_startup

ENV_EXAMPLE_PATH = Path(__file__).resolve().parents[1] / ".env.example"


# --- TC-01 / TC-02: backend/.env.example content ------------------------


def test_env_example_documents_jwt_secret_key_with_comment():
    lines = ENV_EXAMPLE_PATH.read_text().splitlines()
    key_line_index = next(
        i for i, line in enumerate(lines) if line.startswith("JWT_SECRET_KEY=")
    )
    assert lines[key_line_index] == "JWT_SECRET_KEY=CHANGE_ME"
    # Preceded by at least one comment line describing purpose/production guidance.
    preceding = lines[key_line_index - 1]
    assert preceding.startswith("#")


def test_env_example_jwt_secret_key_is_never_a_real_secret():
    lines = ENV_EXAMPLE_PATH.read_text().splitlines()
    key_line = next(line for line in lines if line.startswith("JWT_SECRET_KEY="))
    value = key_line.split("=", 1)[1]
    assert value in ("CHANGE_ME", "")


# --- TC-05/06/07: on_startup() fail-fast validation ----------------------


def test_on_startup_raises_when_jwt_secret_key_missing(monkeypatch):
    monkeypatch.delenv("JWT_SECRET_KEY", raising=False)
    with pytest.raises(RuntimeError, match="JWT_SECRET_KEY environment variable is required"):
        on_startup()


def test_on_startup_raises_when_jwt_secret_key_empty(monkeypatch):
    monkeypatch.setenv("JWT_SECRET_KEY", "")
    with pytest.raises(RuntimeError, match="JWT_SECRET_KEY environment variable is required"):
        on_startup()


def test_on_startup_succeeds_and_seeds_when_jwt_secret_key_present(monkeypatch):
    monkeypatch.setenv("JWT_SECRET_KEY", "a-non-empty-test-value")
    with patch("app.main.SessionLocal", TestingSessionLocal):
        on_startup()  # must not raise; existing seed behavior runs unaffected

    db = TestingSessionLocal()
    try:
        from app.models.user import User

        assert db.query(User).first() is not None
    finally:
        db.close()


# --- TC-08: negligible added startup latency -----------------------------


def test_jwt_secret_key_validation_adds_negligible_latency(monkeypatch):
    monkeypatch.delenv("JWT_SECRET_KEY", raising=False)
    start = time.perf_counter()
    with pytest.raises(RuntimeError):
        on_startup()
    elapsed_ms = (time.perf_counter() - start) * 1000
    assert elapsed_ms < 10
