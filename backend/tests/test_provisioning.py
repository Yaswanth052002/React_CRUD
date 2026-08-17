"""
Provisioning tests (AUTH-02): the AC4 startup migration and the AC5
operator `set_initial_password` script.
"""
import io
from contextlib import redirect_stderr, redirect_stdout
from unittest.mock import patch

import pytest

from tests.conftest import client, TestingSessionLocal
from app.services.auth_service import AuthService
from app.scripts import set_initial_password


def make_user(**overrides):
    payload = {
        "name": "Provision User",
        "email": "provision.user@example.com",
        "phone": "9876500001",
        "role": "User",
        "status": "Active",
    }
    payload.update(overrides)
    return payload


# --- AC4: startup migration -------------------------------------------


def test_migration_provisions_every_credential_less_row():
    created_a = client.post("/api/users", json=make_user(email="cred.less.a@example.com")).json()
    created_b = client.post("/api/users", json=make_user(email="cred.less.b@example.com")).json()

    db = TestingSessionLocal()
    try:
        service = AuthService(db)
        # Row B already has a hash — must be left untouched.
        user_b = service.repo.get_by_id(created_b["id"])
        pre_existing_hash = service._hash_password("already-set")
        user_b.password_hash = pre_existing_hash
        user_b.must_reset_password = False
        db.commit()

        count = service.provision_existing_users_with_random_password()
        assert count == 1

        user_a = service.repo.get_by_id(created_a["id"])
        user_b = service.repo.get_by_id(created_b["id"])

        assert user_a.password_hash is not None
        assert user_a.must_reset_password is True
        assert user_b.password_hash == pre_existing_hash
        assert user_b.must_reset_password is False
    finally:
        db.close()


def test_migration_rerun_is_a_noop_for_already_provisioned_rows():
    created = client.post("/api/users", json=make_user(email="idempotent@example.com")).json()

    db = TestingSessionLocal()
    try:
        service = AuthService(db)
        first_count = service.provision_existing_users_with_random_password()
        assert first_count == 1

        user = service.repo.get_by_id(created["id"])
        hash_after_first_run = user.password_hash

        second_count = service.provision_existing_users_with_random_password()
        assert second_count == 0

        user = service.repo.get_by_id(created["id"])
        assert user.password_hash == hash_after_first_run
        assert user.must_reset_password is True
    finally:
        db.close()


# --- AC5: provisioning script -------------------------------------------


def test_set_user_initial_password_sets_hash_and_clears_reset_flag():
    created = client.post("/api/users", json=make_user(email="script.target@example.com")).json()

    db = TestingSessionLocal()
    try:
        service = AuthService(db)
        service.set_user_initial_password("script.target@example.com", "brand-new-password")

        user = service.repo.get_by_id(created["id"])
        assert user.password_hash is not None
        assert user.must_reset_password is False
        assert service._verify_password(user.password_hash, "brand-new-password") is True
    finally:
        db.close()

    login_resp = client.post(
        "/api/auth/login", json={"email": "script.target@example.com", "password": "brand-new-password"}
    )
    assert login_resp.status_code == 200


def test_set_user_initial_password_raises_for_unknown_email():
    db = TestingSessionLocal()
    try:
        service = AuthService(db)
        with pytest.raises(ValueError):
            service.set_user_initial_password("nobody.here@example.com", "irrelevant")
    finally:
        db.close()


def test_script_never_logs_or_prints_the_plaintext_password(caplog):
    client.post("/api/users", json=make_user(email="cli.target@example.com"))
    plaintext = "cli-secret-password"

    stdout = io.StringIO()
    stderr = io.StringIO()
    with patch("app.scripts.set_initial_password.SessionLocal", TestingSessionLocal), \
         patch("app.scripts.set_initial_password.getpass.getpass", return_value=plaintext), \
         patch("sys.argv", ["set_initial_password.py", "cli.target@example.com"]), \
         redirect_stdout(stdout), redirect_stderr(stderr):
        exit_code = set_initial_password.main()

    assert exit_code == 0
    assert plaintext not in stdout.getvalue()
    assert plaintext not in stderr.getvalue()
    assert "Password set for user cli.target@example.com" in stdout.getvalue()
    for record in caplog.records:
        assert plaintext not in record.getMessage()


def test_script_exits_1_and_never_leaks_plaintext_on_unknown_user(caplog):
    plaintext = "irrelevant-password"
    stdout = io.StringIO()
    stderr = io.StringIO()
    with patch("app.scripts.set_initial_password.SessionLocal", TestingSessionLocal), \
         patch("app.scripts.set_initial_password.getpass.getpass", return_value=plaintext), \
         patch("sys.argv", ["set_initial_password.py", "does.not.exist@example.com"]), \
         redirect_stdout(stdout), redirect_stderr(stderr):
        exit_code = set_initial_password.main()

    assert exit_code == 1
    assert plaintext not in stdout.getvalue()
    assert plaintext not in stderr.getvalue()
    for record in caplog.records:
        assert plaintext not in record.getMessage()
