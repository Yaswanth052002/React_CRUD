# Story: AUTH-08 — Docker and deployment environment configuration for authentication

**Epic**: AUTH
**Status**: Validated
**Priority**: P2
**Independent test**: false
**Owner**: Backend lead
**Updated**: 2026-08-17

**Source**: intake:raw-input (RTM: docs/requirements/RTM.md#AUTH-08)

## User story

As an Admin or Regular User accessing the dashboard in either the `docker-compose` deployment or local dev (`README.md` §8-9), I want the authentication mechanism introduced in AUTH-04 to work correctly and consistently across both environments, so that login/session behavior does not silently break when the app is containerized versus run locally.

## Acceptance criteria

1. Given the app is started via `docker-compose up` (backend container on port 8000, frontend container on port 5173→80 per `docker-compose.yml`), when a user logs in through the frontend container's served UI, then the auth request reaches the backend container, the resulting session/token is accepted on subsequent authenticated requests (e.g. current-user/me, protected `GET /api/users`), and the user remains authenticated across a page refresh — with no hardcoded `localhost` or environment-specific URL baked into frontend or backend code (all origin/URL values are sourced from `VITE_API_URL` / `CORS_ORIGINS` env vars per existing convention).
2. Given the app is started via local dev (`uvicorn` on `http://localhost:8000`, `npm run dev` on `http://localhost:5173` per README §8-9), when a user logs in, then the same auth mechanism (AUTH-04) works end-to-end identically to the docker-compose case — login succeeds, protected endpoints accept the session/token, and refreshing the page preserves the authenticated state.
3. Given the app is running under docker-compose (backend and frontend in separate containers), when a user logs in and the JWT is issued, then the Bearer token is sent via the `Authorization` header on all subsequent API calls and is validated by the backend regardless of which container originated the request, with no cookie-domain or SameSite configuration required.
4. Given the JWT signing secret (`JWT_SECRET_KEY`) is a new required backend environment variable introduced to support AUTH-04's mechanism, when a developer inspects `backend/.env.example`, then `JWT_SECRET_KEY` is present there with a placeholder value (e.g. `CHANGE_ME`) and a comment describing its purpose, consistent with the existing `DATABASE_URL` / `CORS_ORIGINS` documentation style — no new required env var is undocumented.

## Non-functional requirements

- Performance: No additional network round-trips introduced by this story beyond what AUTH-04's mechanism already requires; startup of either container must not be delayed by more than 1s due to new env var loading/validation.
- Security: `JWT_SECRET_KEY` MUST NOT ship with a real default value in `backend/.env.example` — only a placeholder (e.g. `CHANGE_ME`) or empty value, consistent with the "no hardcoded credentials" governance rule; `docker-compose.yml` must not embed the secret literal — it is supplied via `.env` file or `environment:` referencing a host env var, never committed. docker-compose here is treated as **local/dev** (per README's target platform: "Generic internal admin tool... standard PII hygiene only"), so no HTTPS/Secure-flag enforcement is required at this layer; if the app is ever deployed beyond local dev, HTTPS termination is assumed to be handled by a reverse proxy/infra layer outside this repo's scope. This is an accepted scope boundary, not an open question.
- Accessibility: N/A — this story has no new UI surface.
- Observability: Backend startup MUST fail fast with a readable error message (not a raw stack trace, per project convention) if a required new auth-related env var is missing, rather than starting in a broken/insecure default state.

## Dependencies

- Upstream: AUTH-04 (finalized: JWT bearer token issued at login, stored client-side in localStorage, sent via `Authorization: Bearer` header through an axios interceptor). This story is now fully specifiable and buildable once AUTH-04 lands — a normal sequencing dependency, not a blocking unknown.
- Downstream: none.

## Test mapping

- E2E: NA — no independent frontend flow; validated as a deployment/config concern layered on top of AUTH-01/AUTH-02/AUTH-04's E2E login flow, run once under docker-compose and once under local dev.
- Unit: `backend/tests/test_users.py` (extend, or a new `backend/tests/test_config.py`) covering: app fails fast with a readable error when a required auth env var is absent; CORS/cookie config values are read from env, not hardcoded.
- Manual: Run `docker-compose up`, log in via the frontend container's UI, confirm the session/token persists across refresh and protected endpoints respond 200 (not 401/403); repeat under local dev (`uvicorn` + `npm run dev`) and confirm identical behavior.

## Clarifications

## Decision log

- 2026-08-17 Owner: Backend lead (resolved during story validation round 2, consistent with AUTH-04's finalized JWT-bearer mechanism; consistent with AUTH-03/AUTH-04).
- 2026-08-17 AUTH-04 mechanism: JWT bearer token issued at login, stored in localStorage, sent via `Authorization: Bearer` header through an axios interceptor — no cookie-based session (resolved during story validation round 2, consistent with AUTH-04's finalized JWT-bearer mechanism).
- 2026-08-17 Docker-compose environment classification: treated as local/dev, no HTTPS/Secure-flag enforcement required at this layer; HTTPS termination assumed to be handled by a reverse proxy/infra layer outside this repo's scope if ever deployed beyond local dev (resolved during story validation round 2, consistent with AUTH-04's finalized JWT-bearer mechanism).
- 2026-08-17 AC3 rewritten to a concrete, unconditional Bearer-token check (no cookie-domain/SameSite configuration required) (resolved during story validation round 2, consistent with AUTH-04's finalized JWT-bearer mechanism).
- 2026-08-17 New required env var `JWT_SECRET_KEY` documented in `backend/.env.example` with placeholder value and comment, consistent with existing `DATABASE_URL`/`CORS_ORIGINS` conventions (resolved during story validation round 2, consistent with AUTH-04's finalized JWT-bearer mechanism).

## Validation log

- 2026-08-17T11:36:00Z v1 total=65 Feasibility=50 Clarity-Unresolved=0 (FAIL)
- 2026-08-17T12:00:00Z v2 total=98 PASS

