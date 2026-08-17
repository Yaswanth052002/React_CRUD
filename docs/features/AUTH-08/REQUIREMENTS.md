# Feature: AUTH-08 — Docker and deployment environment configuration for authentication

## Problem

AUTH-04 introduces a JWT bearer-token auth mechanism, but the deployment environments that must
carry it — `docker-compose` (separate backend/frontend containers) and local dev (`uvicorn` +
`npm run dev`) — are not yet wired to support it. Today `backend/.env.example` has no
`JWT_SECRET_KEY` entry, `docker-compose.yml` passes no environment variables to the backend
container, and the backend has no startup-time check that required auth env vars are present.
An operator following the README to stand the app up under docker-compose would hit either a
silent misconfiguration (auth mechanism cannot sign tokens) or a late, opaque runtime failure —
never a clear, fail-fast error at container start.

## Outcome

`docker-compose up` and local dev (`uvicorn` / `npm run dev`) both produce a working,
identically-behaving AUTH-04 login flow: login succeeds, the Bearer token is accepted by
protected endpoints from either container, and the session survives a page refresh — with zero
hardcoded environment-specific URLs in source. `JWT_SECRET_KEY` is documented in
`backend/.env.example` alongside the existing `DATABASE_URL` / `CORS_ORIGINS` entries, is passed
into the backend container via `docker-compose.yml`, and the backend refuses to start with a
readable error (not a stack trace) if it is missing.

## Constraints

- Upstream dependency: AUTH-04's JWT-bearer mechanism (bearer token in `Authorization` header,
  no cookies) must be finalized before this story's validation can run end-to-end; the
  configuration work itself is independent of AUTH-04's implementation status.
- No new required env var may ship undocumented (existing project convention, `.env.example`
  pattern).
- `JWT_SECRET_KEY` MUST NOT carry a real secret value anywhere in version control
  (`backend/.env.example`, `docker-compose.yml`) — placeholder only.
- docker-compose here is explicitly local/dev scope (per README target-platform statement); no
  HTTPS/TLS or Secure-flag enforcement is required at this layer.
- Startup validation must not add more than 1s to either container's startup time (story NFR).

## Solution sketch

Extend the three existing local/dev-facing configuration surfaces — `backend/.env.example`,
`docker-compose.yml`, and the backend's FastAPI startup hook — to document, pass through, and
fail-fast-validate `JWT_SECRET_KEY`, the new env var AUTH-04's signing mechanism depends on.
`CORS_ORIGINS` already flows correctly through both environments and needs no code change; the
CORS `Authorization`-header allowance AUTH-04's research flagged as a risk is already satisfied
by the existing `allow_headers=["*"]` wildcard in `backend/app/main.py`. No new runtime surface,
UI, or business logic is introduced — this is deployment/configuration wiring only.

## Addressing Research Conditions

- C-1 (JWT_SECRET_KEY documentation, Integration/HIGH): `backend/.env.example` adds
  `JWT_SECRET_KEY=CHANGE_ME` with a comment ("Secret key for signing JWT tokens — generate a
  random value for production, e.g. `openssl rand -hex 32`; never commit a real secret"), in the
  same style as the existing `DATABASE_URL` / `CORS_ORIGINS` entries. Covered by FR-1.
- C-2 (docker-compose.yml environment passthrough, Integration/HIGH): `docker-compose.yml`'s
  `backend` service gains an `environment:` block passing `JWT_SECRET_KEY` (referencing a host
  env var, e.g. `${JWT_SECRET_KEY}`, never a literal secret) and confirming `CORS_ORIGINS` is
  passed through. Covered by FR-2.
- C-3 (JWT_SECRET_KEY startup validation, Domain/MED): `backend/app/main.py`'s existing
  `on_startup()` handler gains a check that `JWT_SECRET_KEY` is present and non-empty before the
  app finishes starting; on failure it logs a readable message and raises to stop startup — no
  stack trace surfaced. Covered by FR-3.
- C-4 (CORS Authorization header resolved, Integration/LOW): No code change required —
  `backend/app/main.py`'s existing `allow_headers=["*"]` already allows the `Authorization`
  header cross-origin. This PRD documents the resolution explicitly (see Scope → In) so
  downstream planning does not re-open it.
- C-5 (VITE_API_URL scope boundary, Compatibility/MED): Documented as an explicit Out-of-scope
  item below — hardcoded `http://localhost:8000` in `frontend/.env.example` is accepted for
  local/dev and docker-compose-on-one-host; remote-deployment URL discovery is deferred to a
  future story.
- C-6 (Testing plan, Integration/Compatibility): Covered by the unit test for startup validation
  (`backend/tests/test_config.py` or extension of `test_users.py`), the manual docker-compose /
  local-dev parity check in the story's Test mapping, and the TC set generated in
  `docs/test-cases/AUTH-08.json` (FR-1/FR-2/FR-3/NFR-security/NFR-observability coverage).
- C-7 (Documentation, Domain): Covered by the `## Documentation requirements` section below —
  `.env.example` comment, `docker-compose.yml` inline comment, and a docker-compose run
  instruction added to `README.md`.

## Scope

- In:
  - Adding `JWT_SECRET_KEY` to `backend/.env.example` with a placeholder value and explanatory
    comment.
  - Adding an `environment:` block to the `backend` service in `docker-compose.yml` to pass
    `JWT_SECRET_KEY` and confirm `CORS_ORIGINS` passthrough.
  - Adding startup-time validation in `backend/app/main.py` (`on_startup()`) that fails fast
    with a readable error when `JWT_SECRET_KEY` is missing or empty.
  - Documenting (no code change) that CORS `Authorization`-header support is already satisfied
    by the existing `allow_headers=["*"]` in `backend/app/main.py`.
  - Verifying and documenting that `CORS_ORIGINS` already flows correctly in both docker-compose
    and local dev.
  - Manual + automated verification that login, protected-endpoint calls, and refresh-persisted
    auth state behave identically under docker-compose and local dev.
- Out:
  - Remote-deployment URL discovery for `VITE_API_URL` (currently hardcoded to
    `http://localhost:8000`) is deferred to a future story.
  - HTTPS/TLS termination is out of scope for local/dev docker-compose; assumed to be handled by
    a reverse proxy/infra layer outside this repo if ever deployed beyond local/dev.
  - AUTH-04's JWT mechanism internals (token issuance, signing algorithm, localStorage storage,
    axios interceptor wiring) are not implemented by this story — this story only configures the
    environment AUTH-04's mechanism runs in.
  - Any new UI surface (none is introduced).
  - Cookie-based session / SameSite / cookie-domain configuration (AUTH-04 uses bearer tokens
    only, not cookies).

## Functional requirements

FRs trace 1:1 to story ACs; see `docs/stories/AUTH-08.md` for canonical wording.
New impl constraints introduced below:

**AUTH-08-FR-1** — Document `JWT_SECRET_KEY` in `backend/.env.example`  *(extends AC #4 with: exact placeholder value and comment content)*

`backend/.env.example` gains a `JWT_SECRET_KEY=CHANGE_ME` line, positioned after the existing
`DATABASE_URL` / `CORS_ORIGINS` entries, with a comment: "# Secret key for signing JWT tokens.
Generate a random value for production (e.g. `openssl rand -hex 32`). Never commit a real
secret." No other `.env.example` entries are modified.

**AUTH-08-FR-2** — Pass `JWT_SECRET_KEY` and confirm `CORS_ORIGINS` through `docker-compose.yml`  *(extends AC #1 with: environment-variable passthrough mechanism)*

The `backend` service in `docker-compose.yml` gains an `environment:` block that (a) passes
`JWT_SECRET_KEY` by referencing a host-supplied env var (`${JWT_SECRET_KEY}`), never a literal
secret value, and (b) explicitly passes or confirms `CORS_ORIGINS` is available to the container.
`docker-compose up` with `JWT_SECRET_KEY` set on the host (or in a local, gitignored `.env`)
starts the backend successfully; without it, startup fails per FR-3.

**AUTH-08-FR-3** — Fail-fast startup validation for `JWT_SECRET_KEY`  *(extends the story's Observability NFR with: exact validation point and error contract)*

`backend/app/main.py`'s `on_startup()` event handler checks that `JWT_SECRET_KEY` is present and
non-empty (`os.getenv("JWT_SECRET_KEY", "").strip()`) before the app finishes startup, and before
any DB seeding runs. If missing or empty, it logs a readable message (e.g. "JWT_SECRET_KEY
environment variable is required") and raises to stop startup — no raw stack trace is surfaced
to logs or clients, per project convention.

Story ACs #1–#3 (docker-compose/local-dev auth parity, no hardcoded URLs, Bearer token accepted
cross-container with no cookie config) are otherwise satisfied by the existing `CORS_ORIGINS` /
`VITE_API_URL` env-var convention and the already-present `allow_headers=["*"]` CORS setting —
no new FR is needed for these; they are verified by test cases, not new code.

## Non-functional requirements

- Performance: Startup-time env-var validation (FR-3) adds negligible overhead (a `getenv` call
  plus a string check, well under 1ms); combined with existing seeding logic this stays within
  the story's 1s startup-delay budget. Per `.claude/rules/performance-baseline.md`: no new I/O,
  no new network round-trips are introduced by this story.
- Security: Per `.claude/rules/security-baseline.md`: no real secret is ever committed to
  `backend/.env.example` or `docker-compose.yml` — placeholder/host-env-var reference only, and
  `.env` files remain gitignored. `docker-compose` is treated as local/dev; no HTTPS/Secure-flag
  enforcement is required at this layer, consistent with the story's accepted scope boundary.
- Accessibility: N/A — no new UI surface is introduced by this story.
- Observability: Backend startup fails fast with a single readable log line
  ("JWT_SECRET_KEY environment variable is required") when the required env var is missing,
  rather than starting in a broken/insecure default state or surfacing a raw stack trace.

## Rollout plan

- **Strategy**: bang-bang — this is a local/dev-only configuration change with no production
  traffic exposure; both docker-compose and local dev pick up the new env var and validation
  immediately on next deploy/restart.
- **Feature flag**: none — env var presence is not user-facing behavior to toggle.
- **Backout plan**: revert the three changed files (`backend/.env.example`,
  `docker-compose.yml`, `backend/app/main.py`); no schema or data migration involved, so
  reverting is a plain code revert.
- **Success signal**: `docker-compose up` and local dev both boot successfully with
  `JWT_SECRET_KEY` set, and both fail fast with a readable error when it is unset — verified by
  the story's manual test mapping and the automated test cases in
  `docs/test-cases/AUTH-08.json`.

## Documentation requirements

- **README updates**: `README.md` §13 (or a new §"Running with docker-compose") gains an
  instruction: "Set `JWT_SECRET_KEY` on the host (e.g. `export JWT_SECRET_KEY=dev-secret`) before
  running `docker-compose up`."
- **Runbook**: none.
- **API reference**: none — no endpoint changes.
- **Inline code comments**: `backend/.env.example` comment above `JWT_SECRET_KEY` explaining its
  purpose and production-generation guidance; `docker-compose.yml` inline comment on the
  `environment:` block explaining that `JWT_SECRET_KEY` is host-supplied, never literal.
- **Examples / how-to**: none beyond the README update above.

## Open questions

Decisions logged in `docs/stories/AUTH-08.md` § Decision log.

## Approvals

**APPROVED** — 2026-08-17, reviewer: yaswanth.panthangi@apexon.com
  - Feature Summary, FRs, User Flows reviewed
  - UI specs: N/A — backend/deployment-config feature, no UI
  - Edge Cases, Open Questions, test-case completeness reviewed
  - No-placeholder check ✓ · `[NEEDS CLARIFICATION]` count=0
  - Research verdict GO-WITH-CONDITIONS (all 7 conditions addressed above)
  - Tracker subtask: n/a (issue tracker = none)
