---
name: pytest-patterns
description: pytest test patterns for this project — fill body with team test conventions. Used by validation/arh-implementation agents.
when_to_use: Writing or reviewing pytest tests.
user-invocable: false
allowed-tools: Read Write Edit Bash Grep Glob
---
# pytest Test Patterns

<!-- Harness scaffold: test-runner=pytest — STRUCTURE only; -->
<!-- Fill every CORE section. Under OPTIONAL, keep only what applies and DELETE the rest -->
<!-- (heading+slot) before filling. OPTIONAL slots are not lint-nagged; CORE TODO slots are. -->
<!-- Loaded by validation-agent (and implementation-agent for test code) when this runner is active. -->

## Idioms

- Test files live in `backend/tests/`, named `test_<subject>.py` (e.g. `test_users.py`).
- Test functions named `test_<behavior>_<condition>` (e.g. `test_create_user_duplicate_email_returns_409`).
- Structure every test as Arrange / Act / Assert, with a blank line between each block.
- Use `TestClient` from `fastapi.testclient` as the single entrypoint for hitting the API — no direct calls to service/repository layers from a test that exercises an endpoint.
- Prefer plain pytest functions over test classes; use fixtures for shared setup instead of `setUp`/`tearDown`.
- Each test asserts one behavior; use `@pytest.mark.parametrize` for validation-rule variants (bad email, bad phone, missing fields) instead of duplicating near-identical tests.

## Test layering

- **Unit** — service and repository functions tested directly against an in-memory/test SQLite session; no HTTP layer involved. May not import FastAPI routing.
- **Integration** — `TestClient` hitting `/api/*` endpoints end-to-end through API → service → repository → SQLite. This is the primary tier for this project given its thin layering.
- **E2E** — none configured for the backend; the README's frontend Vitest suite and manual UI walkthrough cover end-to-end user flows. Do not add browser-driving E2E tests to the pytest suite.

## Mocking & test data

- Use a dedicated test database (file-based or in-memory SQLite via a fixture-overridden `get_db` dependency) — never point tests at `backend/users.db`.
- Reset/recreate tables per test function (or per session with per-test transaction rollback) so tests don't leak state or depend on ordering.
- Do not mock SQLAlchemy or the repository layer in integration tests — the point of this tier is to exercise the real API → service → repository → SQLite path.
- Build request payloads via a small fixture/factory helper (e.g. `valid_user_payload()`) and override only the fields under test, rather than repeating full JSON bodies.

## Examples

**BAD** — no isolation, asserts too much at once:
```python
def test_user():
    client = TestClient(app)  # hits real users.db
    r = client.post("/api/users", json={"name": "A", "email": "a@a.com"})
    assert r.status_code == 200  # wrong: create returns 201
```

**GOOD** — isolated test DB, one behavior, precise assertion:
```python
def test_create_user_valid_payload_returns_201(client, valid_user_payload):
    response = client.post("/api/users", json=valid_user_payload)

    assert response.status_code == 201
    assert response.json()["email"] == valid_user_payload["email"]
```

## References

- `backend/tests/test_users.py` — canonical example covering create/list/get/update/delete, 404s, 409 duplicate email, and 422 validation errors.
- `README.md` §12 (Testing) — how to run `pytest` locally and what the suite covers.
- `backend/app/main.py` — dependency wiring point for overriding `get_db` in test fixtures.

<!-- ============================================================================ -->
<!-- OPTIONAL — keep only what applies to pytest; DELETE the rest.            -->
<!-- ============================================================================ -->

## Coverage & flake policy

- No enforced coverage threshold currently configured; new endpoints and validation branches must ship with at least one covering test (mirrors the existing create/list/get/update/delete/404/409/422 coverage pattern).
- Tests must be deterministic — no reliance on wall-clock time, network access, or external services; the full suite runs against local SQLite only.
- A flaky test is treated as a bug in the test (or the code it exercises), not quarantined — fix the root cause before merging.
