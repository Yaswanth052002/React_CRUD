"""
Response-schema audit (AUTH-03 FR-3): confirms every User-returning endpoint's
raw JSON body never leaks `password` or `password_hash`, independent of the
schema-level guarantee already provided by `UserOut` (regression-style check,
per condition C-4 / AUTH-03-TC-06, TC-07, TC-08).
"""
from tests.conftest import client


def make_user(**overrides):
    payload = {
        "name": "Audit User",
        "email": "audit.user@example.com",
        "phone": "9876500003",
        "role": "User",
        "status": "Active",
        "password": "irrelevant-signup-password",
    }
    payload.update(overrides)
    return payload


def _assert_no_password_keys(body: dict):
    assert "password" not in body
    assert "password_hash" not in body


# --- AUTH-03-TC-06: GET /api/users list response -----------------------------


def test_list_users_response_omits_password_fields():
    client.post("/api/users", json=make_user())
    resp = client.get("/api/users")
    assert resp.status_code == 200
    for item in resp.json()["items"]:
        _assert_no_password_keys(item)


# --- AUTH-03-TC-07: GET /api/users/{id} response -----------------------------


def test_get_single_user_response_omits_password_fields():
    created = client.post("/api/users", json=make_user()).json()
    _assert_no_password_keys(created)

    resp = client.get(f"/api/users/{created['id']}")
    assert resp.status_code == 200
    _assert_no_password_keys(resp.json())


# --- AUTH-03-TC-08: POST and PUT /api/users responses ------------------------


def test_create_and_update_user_responses_omit_password_fields():
    created = client.post("/api/users", json=make_user()).json()
    _assert_no_password_keys(created)

    updated_payload = make_user(name="Audit User Updated")
    resp = client.put(f"/api/users/{created['id']}", json=updated_payload)
    assert resp.status_code == 200
    _assert_no_password_keys(resp.json())
