# ADR-0002: System architecture

- Status: Accepted
- Date: 2026-08-14
- Deciders: project lead

## Context

This is a brownfield import: the User Management CRUD Dashboard (React + FastAPI + SQLite,
see ADR-0001) was fully built before harness bootstrap. This ADR reverse-engineers and records
the high-level architecture as it actually exists in the codebase, plus the explicit decisions
settled with the user at Step 4.0, so downstream harness phases (implementation planning,
validation, security review) have a stable reference for system-level shape. This documents
reality — it does not propose a target architecture.

## Decision

- **Runtime & delivery**: Local dev servers only — `uvicorn --reload` serves the FastAPI
  backend, `vite dev` serves the React frontend. CI is planned as plain GitHub Actions running
  lint+test on push/PR (not yet implemented — see Flagged gaps). No containers, no Docker/K8s.
- **State & data**: SQLite via SQLAlchemy 2.0 ORM, single `DATABASE_URL` config
  (`backend/.env`). No migration tool (no Alembic) — schema is created via
  `Base.metadata.create_all` on startup (`backend/app/main.py`).
- **Interfaces & contracts**: REST over JSON, single unversioned API under the `/api` prefix
  (`users`, `dashboard`, `health` routers, mounted in `backend/app/main.py`). No GraphQL/gRPC.
  Frontend calls the API exclusively through `frontend/src/services/userApi.js`.
- **Execution model**: Fully synchronous request/response CRUD. No background jobs, queues, or
  scheduled/event-driven work.
- **Trust & access**: No authentication or authorization is implemented — any client can call
  every endpoint. This is a known, explicit gap (not a near-term requirement); the user
  confirmed the app stays unauthenticated for now and that auth would be a dedicated future
  feature rather than a retrofit onto the current code.
- **Operability**: `GET /api/health` provides a basic liveness check. Centralized exception
  handlers (`backend/app/main.py`) return readable `detail` messages with correct HTTP status
  codes (404 not-found, 409 duplicate-email, 422 validation) and never leak raw stack traces —
  unexpected errors are logged server-side and returned as a generic 500. No structured
  logging, metrics, or tracing beyond Python's stdlib `logging` at INFO level. No explicit
  retry/idempotency logic, which is consistent with the synchronous-CRUD-only execution model.

Backend layering (topology, one tier per process): `api → services → repositories → models`,
per `.claude/skills/fastapi-patterns/SKILL.md`. Frontend is a single-tier SPA with one
API call-site (`services/userApi.js`); no separate BFF or gateway tier.

## Alternatives considered

- N/A — this ADR documents the architecture as already implemented and as explicitly
  confirmed by the user at Step 4.0; it does not choose between architectural alternatives.

## Consequences

- Positive: the synchronous, single-datastore, unversioned-REST shape is simple to reason
  about, test, and trace requirements against; the layered backend and single frontend
  call-site make validation and security review tractable.
- Negative: no authentication/authorization, no CI pipeline, and no migration tooling are
  currently in place — each is a real gap, not an oversight to silently work around (see
  Flagged gaps below).
- Reversible? Swapping the datastore only requires changing `DATABASE_URL` (SQLAlchemy ORM
  insulates the app from raw SQL); adding auth or a migration tool are additive, moderate-cost
  changes; moving to an async/event-driven execution model would be a larger, cross-cutting
  rewrite.

## Flagged gaps

- **No authentication/authorization**: every endpoint is publicly callable. Explicit user
  decision to defer, but security-review and validate-feature phases should treat this as a
  standing known-gap, not silently assume auth exists.
- **No CI pipeline implemented**: `github-actions` is declared as the CI integration (ADR-0001)
  but no `.github/workflows/` exists yet. Out of scope for this ADR — tracked for a separate
  cicd-agent task.
- **No migration tool**: schema changes rely on `Base.metadata.create_all`, which cannot alter
  existing tables. Any future schema change will need a manual migration story or an added
  tool (e.g. Alembic) — not yet decided.
- **No lint/format tooling** for either stack (per ADR-0001 Consequences) — not invented here.
- **Patterns skills**: `.claude/skills/react-patterns/SKILL.md` and
  `.claude/skills/fastapi-patterns/SKILL.md` bodies are already filled with real, stack-specific
  conventions on disk (idioms, layering, error handling, anti-patterns) — only their frontmatter
  `description:` field still carries the generic scaffold boilerplate ("fill body with team
  conventions"). Verified by direct read; flagged here in case that stale description field is
  cleaned up separately.
