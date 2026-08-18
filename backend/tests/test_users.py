"""
End-to-end API tests using FastAPI's TestClient against an isolated
in-memory SQLite database (separate from the dev users.db file).

The client/engine/`get_db` override and the `_reset_db` fixture are
shared with every other test module via `tests/conftest.py` (AUTH-02) —
see that file's docstring for why they must not be redefined per-module.
"""
from tests.conftest import client, TestingSessionLocal
from app.services.auth_service import AuthService


def make_user(**overrides):
    payload = {
        "name": "Test User",
        "email": "test.user@example.com",
        "phone": "9876500000",
        "role": "User",
        "status": "Active",
        "password": "irrelevant-signup-password",
    }
    payload.update(overrides)
    return payload


def test_create_user():
    resp = client.post("/api/users", json=make_user())
    assert resp.status_code == 201
    body = resp.json()
    assert body["name"] == "Test User"
    assert body["email"] == "test.user@example.com"
    assert "id" in body


def test_get_users_returns_created_user():
    client.post("/api/users", json=make_user())
    resp = client.get("/api/users")
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 1
    assert body["page"] == 1
    assert len(body["items"]) == 1
    assert body["items"][0]["email"] == "test.user@example.com"


def test_get_users_paginates_with_page_size():
    for i in range(3):
        client.post("/api/users", json=make_user(email=f"page{i}@example.com"))
    resp = client.get("/api/users", params={"page": 1, "page_size": 2})
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 3
    assert body["page"] == 1
    assert body["page_size"] == 2
    assert len(body["items"]) == 2

    resp2 = client.get("/api/users", params={"page": 2, "page_size": 2})
    assert len(resp2.json()["items"]) == 1


def test_get_single_user():
    created = client.post("/api/users", json=make_user()).json()
    resp = client.get(f"/api/users/{created['id']}")
    assert resp.status_code == 200
    assert resp.json()["id"] == created["id"]


def test_get_user_not_found():
    resp = client.get("/api/users/9999")
    assert resp.status_code == 404


def test_update_user():
    created = client.post("/api/users", json=make_user()).json()
    updated_payload = make_user(name="Updated Name", role="Admin")
    resp = client.put(f"/api/users/{created['id']}", json=updated_payload)
    assert resp.status_code == 200
    body = resp.json()
    assert body["name"] == "Updated Name"
    assert body["role"] == "Admin"


def test_update_user_not_found():
    resp = client.put("/api/users/9999", json=make_user())
    assert resp.status_code == 404


def test_delete_user():
    created = client.post("/api/users", json=make_user()).json()
    resp = client.delete(f"/api/users/{created['id']}")
    assert resp.status_code == 204

    resp = client.get(f"/api/users/{created['id']}")
    assert resp.status_code == 404


def test_delete_user_not_found():
    resp = client.delete("/api/users/9999")
    assert resp.status_code == 404


def test_duplicate_email_rejected():
    client.post("/api/users", json=make_user(email="dup@example.com"))
    resp = client.post("/api/users", json=make_user(email="dup@example.com", name="Someone Else"))
    assert resp.status_code == 409


def test_invalid_email_validation_error():
    resp = client.post("/api/users", json=make_user(email="not-an-email"))
    assert resp.status_code == 422


def test_invalid_phone_validation_error():
    resp = client.post("/api/users", json=make_user(phone="abc"))
    assert resp.status_code == 422


def test_missing_required_field():
    payload = make_user()
    del payload["name"]
    resp = client.post("/api/users", json=payload)
    assert resp.status_code == 422


def test_dashboard_stats():
    client.post("/api/users", json=make_user(email="a@example.com", role="Admin", status="Active"))
    client.post("/api/users", json=make_user(email="b@example.com", role="User", status="Active"))
    client.post("/api/users", json=make_user(email="c@example.com", role="User", status="Inactive"))

    resp = client.get("/api/dashboard/stats")
    assert resp.status_code == 200
    stats = resp.json()
    assert stats["total_users"] == 3
    assert stats["active_users"] == 2
    assert stats["admin_users"] == 1
    assert stats["regular_users"] == 2


def test_search_filters_by_name_email_phone():
    client.post("/api/users", json=make_user(name="Alice Wonderland", email="alice@example.com"))
    client.post("/api/users", json=make_user(name="Bob Builder", email="bob@example.com", phone="9876511111"))

    resp = client.get("/api/users", params={"search": "alice"})
    assert resp.status_code == 200
    results = resp.json()["items"]
    assert len(results) == 1
    assert results[0]["name"] == "Alice Wonderland"


# --- AUTH-03-TC-01: create user persists bcrypt hash, never plaintext -----


def test_create_user_persists_bcrypt_hash_distinct_from_plaintext():
    plaintext = "correct-horse-battery-staple"
    created = client.post("/api/users", json=make_user(password=plaintext)).json()

    db = TestingSessionLocal()
    try:
        service = AuthService(db)
        user = service.repo.get_by_id(created["id"])
        assert user.password_hash is not None
        assert user.password_hash.startswith("$2b$")
        assert user.password_hash != plaintext
    finally:
        db.close()


# --- regression-AUTH-03-TC-01: a freshly created user can log in immediately
# with the password supplied at creation. create_user must clear
# must_reset_password (defaults True on the model for the provisioning-
# migration path) since a real password was already set — otherwise
# AuthService._verify_credentials treats the account as unprovisioned and
# every login attempt is rejected, even with the correct password.


def test_newly_created_user_can_log_in_with_creation_password():
    plaintext = "correct-horse-battery-staple"
    created = client.post("/api/users", json=make_user(email="fresh.login@example.com", password=plaintext)).json()

    db = TestingSessionLocal()
    try:
        user = AuthService(db).repo.get_by_id(created["id"])
        assert user.must_reset_password is False
    finally:
        db.close()

    resp = client.post(
        "/api/auth/login", json={"email": "fresh.login@example.com", "password": plaintext}
    )
    assert resp.status_code == 200
    assert "token" in resp.json()


# --- AUTH-03-TC-09/TC-10: no invented default password --------------------


def test_create_user_without_password_rejected_with_422():
    payload = make_user()
    del payload["password"]
    resp = client.post("/api/users", json=payload)
    assert resp.status_code == 422


def test_create_user_with_empty_password_rejected_with_422():
    resp = client.post("/api/users", json=make_user(password=""))
    assert resp.status_code == 422


def test_role_and_status_filters():
    client.post("/api/users", json=make_user(email="admin1@example.com", role="Admin"))
    client.post("/api/users", json=make_user(email="user1@example.com", role="User"))

    resp = client.get("/api/users", params={"role": "Admin"})
    assert resp.status_code == 200
    results = resp.json()["items"]
    assert len(results) == 1
    assert results[0]["role"] == "Admin"
