---
name: fastapi-patterns
description: fastapi patterns for this project — fill body with team conventions. Used by implementation/validation/arh-review agents.
when_to_use: Writing or reviewing fastapi code.
user-invocable: false
allowed-tools: Read Write Edit Bash Grep Glob
---
# fastapi Patterns

<!-- Harness scaffold: stack=fastapi — STRUCTURE only; -->
<!-- Fill every CORE section below. Under OPTIONAL, keep only the sections that apply to -->
<!-- this stack and DELETE the heading+slot of the rest BEFORE filling. Keep ≤ 200 lines. -->
<!-- Deletion is safe: OPTIONAL slots use the word OPTIONAL (not TODO) so the lint does not -->
<!-- nag for them; CORE TODO slots are nagged until filled — that is intentional. -->
<!-- Loaded by implementation-, impl-planning-, validation-, code-review-, security-review-, -->
<!-- scaffold-, and cicd-agents when this stack is active. -->

## Idioms

- Routers named `<resource>.py` under `app/api/`, one `APIRouter()` per resource, mounted with a `/api` prefix in `app/main.py`.
- Pydantic v2 schemas per resource in `app/schemas/<resource>.py`; separate `*Create`, `*Update`, `*Read` models — never reuse the ORM model as the response model.
- Service functions are plain functions (or a thin class) in `app/services/<resource>.py`, one per use case (`create_user`, `get_user_or_404`, ...).
- Repository functions take a `Session` explicitly as the first arg; no hidden global session state.
- Snake_case for functions/vars, PascalCase for Pydantic/SQLAlchemy classes, matching FastAPI/PEP 8 conventions.

## Project structure

```text
backend/app/
├── api/            # routers — request/response only, no SQL, no business rules
├── models/         # SQLAlchemy ORM models
├── schemas/        # Pydantic request/response DTOs + validators
├── repositories/   # all SQLAlchemy query logic
├── services/       # business rules (uniqueness, 404s, orchestration)
├── database.py     # engine / SessionLocal / Base
├── seed.py         # first-run sample data
└── main.py         # app instance, CORS, router include, exception handlers
```
- New resource ⇒ add one file per layer (`models/`, `schemas/`, `repositories/`, `services/`, `api/`) named after the resource; wire the router in `main.py`.

## Layering & dependency rules

- Allowed direction only: `api → services → repositories → models`. Never skip a layer (routers must not import repositories or the ORM `Session` query API directly).
- `schemas/` may be imported by `api/` and `services/`; it must not import from `repositories/` or `models/` (keep DTOs decoupled from ORM internals).
- `repositories/` is the only layer allowed to write SQLAlchemy queries (`session.query(...)`, `select(...)`).
- `services/` holds cross-cutting business rules (e.g. duplicate-email check, "get or 404") — routers stay thin (parse → call service → return).

## Error handling

- Domain errors are raised as typed exceptions from `services/` (e.g. `UserNotFoundError`, `DuplicateEmailError`), not raw `HTTPException` — keeps services HTTP-agnostic.
- `api/` layer (or a central handler in `main.py` via `@app.exception_handler`) translates domain exceptions to HTTP: not-found → 404, duplicate → 409, validation → 422 (handled automatically by Pydantic).
- Never leak stack traces or raw exception text to the client; return a `detail` message naming the invalid field/resource.
- No bare `except Exception: pass` — let unexpected errors propagate to FastAPI's default 500 handler so they surface in logs.

## Anti-patterns

- Router functions doing SQL directly — violates layering; move the query into `repositories/`.
- Returning the SQLAlchemy model instance directly from an endpoint — always map through a `schemas/*Read` model to control the response shape.
- Global mutable session/engine state shared across requests instead of FastAPI's `Depends(get_db)` per-request session.
- Catching and silencing exceptions in `services/`/`repositories/` to "keep things working" — violates the no-swallow rule in `.claude/rules/*-baseline.md`.

## Examples

```python
# BAD — router queries the DB directly
@router.get("/users/{id}")
def get_user(id: int, db: Session = Depends(get_db)):
    return db.query(User).filter(User.id == id).first()
```

```python
# GOOD — router delegates to service/repository layers
@router.get("/users/{id}", response_model=UserRead)
def get_user(id: int, db: Session = Depends(get_db)):
    return user_service.get_user_or_404(db, id)
```

## References

- `README.md` §2 (Architecture) — layered request flow diagram.
- `README.md` §4 (Project Structure) — canonical backend tree.
- `backend/tests/test_users.py` — reference test coverage per endpoint (create/list/get/update/delete/404/409/422).

## API / interface contracts

- Base path `/api`; resource routers mounted under it (`/api/users`, `/api/dashboard`).
- Request/response bodies are always Pydantic schemas — no raw dicts.
- List endpoints accept filter query params (`search`, `role`, `status`) rather than a separate search endpoint.
- Mutations return the updated resource as JSON (200/201); `DELETE` returns `204 No Content` with an empty body.
- Uniqueness conflicts (e.g. duplicate email) return `409 Conflict`; validation errors return FastAPI's default `422` with a `detail` array.

## Security (stack-specific)

- All request bodies validated via Pydantic v2 field constraints (e.g. email format, phone regex `^[0-9+\-() ]{7,20}$`) — never trust unvalidated client input in a service/repository.
- CORS origins are read from `backend/.env` (`CORS_ORIGINS`), never hardcoded or set to `*` in `main.py`.
- No secrets or DB URLs committed to source — `.env` is git-ignored, `.env.example` documents required keys only.

## Data access & migrations

- SQLAlchemy 2.0 ORM; `Base.metadata.create_all` on startup for this SQLite-backed app — no separate migration tool is in use.
- All queries live in `repositories/`; one function per query shape (e.g. `get_by_email`, `list_filtered`), returning ORM instances or `None`.
- Session lifecycle is per-request via a `Depends(get_db)` generator in `database.py`; services never open their own session.

## Dependency, build & CI

- Python 3.11+, dependencies pinned in `backend/requirements.txt`, installed via `pip install -r requirements.txt` inside a venv.
- Run backend tests with `pytest` from `backend/` (see `docs/config/project-commands.yaml` for the canonical command).
- CI (GitHub Actions) should run `pip install -r requirements.txt` then `pytest` on every push/PR touching `backend/**`.

