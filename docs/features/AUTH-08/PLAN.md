# PLAN: AUTH-08 — Docker and deployment environment configuration for authentication

Status: Draft
Source: `docs/features/AUTH-08/REQUIREMENTS.md` (APPROVED) · `docs/research/AUTH-08.md` (84/100, GO-WITH-CONDITIONS) · `docs/stories/AUTH-08.md` (v2, PASS)

## 1. Architecture Decisions

No mini-ADR is authored for this story. The three implementation decisions — the env var name
(`JWT_SECRET_KEY`), the passthrough mechanism (`docker-compose.yml` `environment:` block
referencing a host-supplied `${JWT_SECRET_KEY}`, never a literal), and the validation approach
(fail-fast check inside the existing `on_startup()` handler, before seeding) — are all locked in
`docs/research/AUTH-08.md` § Conditions and `docs/stories/AUTH-08.md`'s Decision log. None of
these choices has a competing alternative a reviewer would plausibly prefer, so per
`plan-authoring` § When to write an ADR, no ADR is warranted here.

### Cross-plan dependency gap (documented risk, not an ADR)

**Finding**: this story documents and passes through `JWT_SECRET_KEY` on the assumption that
AUTH-04's JWT-signing mechanism reads it on the backend. Investigation of the three already-written
upstream PLANs shows this is **not yet true**:

- `docs/features/AUTH-02/PLAN.md` (`AuthService.login`) returns `LoginResponse {token: str}` per
  condition C-6, but its own § 1 ADR-4 and § 2 file table show the token is a **stub** — no JWT
  library (`python-jose`, `pyjwt`, etc.) is added to `backend/requirements.txt`, and no
  `os.getenv("JWT_SECRET_KEY")` call appears anywhere in F-01 (`auth_service.py`) or F-03
  (`api/auth.py`). AUTH-02's PLAN never mentions `JWT_SECRET_KEY`.
- `docs/features/AUTH-03/PLAN.md` scopes itself entirely to password hashing
  (`hash_password`/`verify_credentials` via `passlib[bcrypt]`) and explicitly does not touch
  `AuthService.login`'s token-issuance path. It never mentions `JWT_SECRET_KEY`.
- `docs/features/AUTH-04/PLAN.md` is explicitly frontend-only (token storage in `localStorage`,
  axios interceptor pair in `userApi.js`, `App.jsx` auth state) per its own § 2 "Cross-plan wiring
  note: no new production module created" and its Cross-Feature Dependency Notes row for AUTH-08
  ("owns CORS/`Authorization` header allowance ... AUTH-04 assumes it is configured correctly").
  It never reads or signs with `JWT_SECRET_KEY` on the backend — it only consumes whatever opaque
  token string AUTH-02's login endpoint returns.

**Conclusion**: as of this PLAN's authoring, **no backend code in any written PLAN (AUTH-02,
AUTH-03, AUTH-04) actually reads `JWT_SECRET_KEY` to sign or verify a JWT.** AUTH-02's `login`
issues a stub token (its real shape/signing mechanism is left open — ADR-4 only replaces the
password-verification stub, not the token-issuance stub). This means AUTH-08, as scoped, will
ship a fully documented and passed-through env var that zero backend code currently consumes.
This is a real gap, not a false alarm: per REQUIREMENTS.md § Scope → Out, "AUTH-04's JWT mechanism
internals (token issuance, signing algorithm...) are not implemented by this story — this story
only configures the environment AUTH-04's mechanism runs in", so AUTH-08's own task set correctly
does NOT add JWT-signing code (that would be an out-of-scope, unrequested feature per
`surgical-changes`). The gap is carried forward explicitly in § 6 below as an accepted risk with
a named owner (whichever story next touches `AuthService.login`'s token issuance — most likely a
follow-up to AUTH-02 or a new story) rather than silently assumed away.

## 2. File and Module Plan

| ID   | Action | Path                                        | Reason                                                                 |
|------|--------|-----------------------------------------------|---------------------------------------------------------------------------|
| F-01 | modify | `backend/.env.example`                        | Add `JWT_SECRET_KEY=CHANGE_ME` with purpose/production-generation comment (FR-1) |
| F-02 | modify | `docker-compose.yml`                          | Add `environment:` block to the `backend` service passing `JWT_SECRET_KEY` (host-referenced) and confirming `CORS_ORIGINS` passthrough (FR-2) |
| F-03 | modify | `backend/app/main.py`                         | `on_startup()` gains a fail-fast check that `JWT_SECRET_KEY` is present/non-empty, before `seed_if_empty` runs (FR-3) |
| F-04 | create | `backend/tests/test_config.py`                | Startup-validation + `.env.example` content tests — TC-01, TC-02, TC-05, TC-06, TC-07, TC-08 |
| F-05 | create | `backend/tests/test_docker_compose_config.py` | Structural assertion that `docker-compose.yml`'s backend service passes `JWT_SECRET_KEY`/`CORS_ORIGINS` — TC-03, TC-04 (TC-04's actual `docker-compose up` runtime check is deferred; see § 7) |
| F-06 | create | `backend/tests/test_cors.py`                  | Regression test confirming `allow_headers=["*"]` already permits `Authorization` cross-origin (condition C-4) — TC-09 |
| F-07 | modify | `README.md`                                   | § 13 (or new subsection) gains the `docker-compose` `JWT_SECRET_KEY` run instruction; env-var reference table entry for `JWT_SECRET_KEY`; documents CORS `Authorization`-header resolution (Documentation requirements, condition C-7) |

F-01, F-02, F-03 are all `modify` rows against already-wired files (`.env.example` is documentation
consumed by developers, not imported code; `docker-compose.yml` is the compose entry point itself;
`backend/app/main.py`'s `on_startup()` is already the FastAPI app's registered startup hook — no
new registration site is needed). F-04, F-05, F-06 are leaf test files with no consumer/entry site
to wire, per the `plan-validation` wiring exception for test files. No new production module is
created by this story — it is deployment/configuration wiring only, matching REQUIREMENTS.md
§ Solution sketch.

## 3. Module Hierarchy

```
backend/app/main.py (F-03, modify)
└── on_startup() — FastAPI startup event handler (already registered via @app.on_event("startup"))
    - input:  process environment (os.environ), specifically JWT_SECRET_KEY
    - output: None on success (falls through to existing seed_if_empty(db) call); raises
      RuntimeError("JWT_SECRET_KEY environment variable is required") on missing/empty value,
      BEFORE seed_if_empty runs
    - public: unchanged signature — still the on_startup() hook FastAPI calls; behavior is
      extended in place, not replaced
    - contract: reads os.getenv("JWT_SECRET_KEY", "").strip(); logs a single readable ERROR-level
      message (no stack trace, no secret value logged) via the existing module-level `logger`,
      then raises — FastAPI's own startup-failure handling stops the app from serving requests
```

No new class, function signature, or public export is introduced anywhere in this story — every
change is either data (`.env.example`, `docker-compose.yml` are not code) or an in-place extension
of an existing function body (`on_startup()`).

## 4. State and Data Management

- **New environment variable**: `JWT_SECRET_KEY` (backend process env var, string). No default
  value ships in `docker-compose.yml` or `backend/.env.example` beyond the placeholder
  `CHANGE_ME` in `.env.example` — `docker-compose.yml` references `${JWT_SECRET_KEY}` from the
  host shell/`.env`, never a literal. Lifecycle: read once, at process startup, by `on_startup()`;
  not cached, not re-read per-request (matches the story's Performance NFR — no new I/O or
  network round-trips).
- **No persistent/DB state change**: this story adds no column, no migration, no new table.
- **No cache**: nothing to invalidate; the env var is process-lifetime-scoped only — a
  `docker-compose up` / `uvicorn` restart is required to pick up a changed value, which is the
  existing, expected behavior for every other env var in this codebase (`DATABASE_URL`,
  `CORS_ORIGINS`).
- **CORS_ORIGINS**: already flows correctly through both `docker-compose` (once F-02 explicitly
  confirms/passes it) and local dev (`backend/.env.example`, already present, unmodified by this
  story) — no new state, only an explicit passthrough confirmation in `docker-compose.yml`.

## 5. Task Breakdown

| #    | Title                                                                         | Complexity | [P] | Predecessors | Files | Notes                                                                 |
|------|----------------------------------------------------------------------------------|------------|-----|---------------|-------|--------------------------------------------------------------------------|
| T-01 | Document `JWT_SECRET_KEY` in `backend/.env.example`                             | S          | [P] | —             | F-01  | FR-1, condition C-1; placeholder `CHANGE_ME`, comment matches REQUIREMENTS.md verbatim wording |
| T-02 | Add `environment:` block to `docker-compose.yml`'s `backend` service            | S          | [P] | —             | F-02  | FR-2, condition C-2; `JWT_SECRET_KEY=${JWT_SECRET_KEY}`, `CORS_ORIGINS=${CORS_ORIGINS:-http://localhost:5173,http://127.0.0.1:5173}`, inline comment per Documentation requirements |
| T-03 | Add fail-fast `JWT_SECRET_KEY` validation to `on_startup()` in `backend/app/main.py` | M     | [P] | —             | F-03  | FR-3, condition C-3; checks `os.getenv("JWT_SECRET_KEY", "").strip()`, logs readable ERROR, raises `RuntimeError` before `seed_if_empty` runs |
| T-04 | Write `backend/tests/test_config.py`                                            | M          |     | T-01, T-03    | F-04  | Covers TC-01, TC-02 (`.env.example` content assertions via plain file read), TC-05, TC-06, TC-07 (startup validation: missing/empty/present env var via `monkeypatch.setenv`/`delenv` + re-import or direct `on_startup()` call), TC-08 (perf: `time.perf_counter()` around the validation branch, asserts <10ms) |
| T-05 | Write `backend/tests/test_docker_compose_config.py`                             | S          |     | T-02          | F-05  | Covers TC-03 (plain-text structural assertion: `docker-compose.yml`'s backend service block contains `JWT_SECRET_KEY` referencing `${JWT_SECRET_KEY}` and `CORS_ORIGINS`); TC-04's actual `docker-compose up` runtime check is deferred — see § 7 for the author-time-smoke justification |
| T-06 | Write `backend/tests/test_cors.py`                                              | S          | [P] | —             | F-06  | Covers TC-09; `TestClient` `OPTIONS` preflight request with `Access-Control-Request-Headers: Authorization`, asserts backend's existing `allow_headers=["*"]` (unmodified by this story) reflects `Authorization` as allowed — regression-confirms condition C-4, no code change needed |
| T-07 | `docs(readme)`: document `JWT_SECRET_KEY`, docker-compose run instruction, CORS resolution | S | | T-01, T-02   | F-07  | Documentation requirements section; condition C-7; T3 doc trigger (new env var) |

`[P]` holds for T-01, T-02, T-03, T-06 — each touches a disjoint file (F-01, F-02, F-03, F-06
respectively), none has a predecessor, and none shares mutable state with another `[P]` task. T-04
and T-05 depend on the code/config they test having landed. T-07 depends on T-01/T-02 since it
documents the exact env-var name and docker-compose instruction those tasks establish.

## 6. Carry-Forward Risks and Conditions

Risks from `docs/research/AUTH-08.md` § Risk register (numbered 1–7 there), plus one new risk
(R-08) discovered during this PLAN's cross-plan investigation (see § 1).

### Risks addressed by tasks

| Risk id | Severity | Addressed by |
|---------|----------|---------------|
| #1      | HIGH     | T-01          |
| #2      | HIGH     | T-02          |
| #3      | MED      | T-03, T-04    |
| #5      | LOW      | T-06 (regression-confirms; no code change — CORS already resolved per research) |
| #6      | LOW      | T-01 (placeholder-only value, verified by TC-02/T-04) |
| #7      | LOW      | T-01, T-02, T-07 (env-var source documented in `.env.example`, `docker-compose.yml`, and `README.md`) |

### Risks accepted (carry-forward)

| Risk id | Severity | Rationale                                                                                                                                                                                                                                              |
|---------|----------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| #4      | MED      | accepted — `VITE_API_URL` hardcoded-localhost scope boundary is explicitly Out-of-scope per REQUIREMENTS.md § Scope → Out; remote-deployment URL discovery is deferred to a future story, per research condition C-5. |
| R-08    | HIGH     | accepted (documented in § 1 "Cross-plan dependency gap") — as of this PLAN's authoring, no backend code in AUTH-02/AUTH-03/AUTH-04's written PLANs reads `JWT_SECRET_KEY` to sign or verify a JWT; AUTH-02's `AuthService.login` issues a stub token whose real signing mechanism is not yet specified in any PLAN. AUTH-08 correctly does not add JWT-signing code itself (out of scope per REQUIREMENTS.md § Scope → Out: "AUTH-04's JWT mechanism internals... are not implemented by this story"). Owner: whichever story next defines `AuthService.login`'s real token-issuance mechanism (most likely a follow-up to AUTH-02, since AUTH-03/AUTH-04 are already scoped away from it) must consume `JWT_SECRET_KEY` via `os.getenv("JWT_SECRET_KEY")` at that time — this PLAN's `on_startup()` validation (T-03) already guarantees the variable is present and non-empty by the time any future signing code runs. Revisit when that story's PLAN.md is authored. |

### Conditions for GO (research_verdict GO-WITH-CONDITIONS)

| Cond | Condition (verbatim, abbreviated)                                                              | Addressed by |
|------|------------------------------------------------------------------------------------------------|---------------|
| C-1  | JWT_SECRET_KEY documentation in `backend/.env.example` (placeholder, comment, never a real secret) | T-01, T-04    |
| C-2  | `docker-compose.yml` environment setup (JWT_SECRET_KEY passthrough + CORS_ORIGINS confirmed)    | T-02, T-05    |
| C-3  | JWT_SECRET_KEY startup validation (fail-fast, readable error, before seeding)                   | T-03, T-04    |
| C-4  | CORS Authorization header resolved (no code change; documented + regression-tested)              | T-06 (regression test), § 1/§ 4 documentation |
| C-5  | Frontend VITE_API_URL scope boundary (accepted, documented, deferred)                            | (accepted, risk #4 above — documented, no task) |
| C-6  | Testing plan (unit for startup validation; docker-compose/local-dev parity; TC coverage)          | T-04, T-05, T-06 |
| C-7  | Documentation (`.env.example` comment, `docker-compose.yml` inline comment, README run instruction) | T-01, T-02, T-07 |

### Cross-Feature Dependency Notes

- **AUTH-04** (JWT bearer mechanism, frontend-only, PLAN written): AUTH-04's PLAN.md explicitly
  assumes AUTH-08 configures the CORS/`Authorization` header allowance (its own § 6 risk #5) — this
  is confirmed already-satisfied by the existing `allow_headers=["*"]` (T-06 regression-confirms
  it, no code change). AUTH-04 does NOT read `JWT_SECRET_KEY` on the backend (it is a frontend-only
  story) — see § 1 for the full cross-plan gap finding.
- **AUTH-02** (`AuthService.login`, PLAN written): issues a **stub** token (`LoginResponse
  {token: str}` per its own condition C-6); does not sign with `JWT_SECRET_KEY` or any JWT library.
  This PLAN's T-03 validates the env var is present at startup regardless of whether it is yet
  consumed — the validation is forward-compatible with whichever future story wires real signing.
- **AUTH-03** (password hashing, PLAN written): scoped entirely to `password_hash`/`verify_credentials`;
  does not touch token issuance; no `JWT_SECRET_KEY` reference.
- **Risk R-08** (§ above): the identified gap that no current PLAN consumes `JWT_SECRET_KEY` for
  actual signing is carried forward explicitly, not silently assumed resolved by this story's
  env-var plumbing work.

## 7. Test Strategy

| Layer                      | Test path                                          | TCs covered | Notes                                                                                                                                          |
|-----------------------------|-------------------------------------------------------|--------------|----------------------------------------------------------------------------------------------------------------------------------------------------|
| Contract                   | `backend/tests/test_config.py`                        | AUTH-08-TC-01 | Plain file read of `backend/.env.example`; asserts a `JWT_SECRET_KEY=CHANGE_ME` line exists preceded by the required comment. Runner: existing `pytest` (`docs/config/project-commands.yaml` `test_unit`) — a structural file-content assertion, not a consumer-driven contract test, matching AUTH-02/AUTH-03's precedent for their own contract-typed TCs; no new contract-testing tool installed. |
| Security                   | `backend/tests/test_config.py`                        | AUTH-08-TC-02 | Asserts the `.env.example` value is exactly `CHANGE_ME` (or empty) — never a random/production-looking string.                                     |
| Integration                | `backend/tests/test_config.py`                        | AUTH-08-TC-05, TC-06, TC-07 | `monkeypatch.delenv("JWT_SECRET_KEY")` / `monkeypatch.setenv("JWT_SECRET_KEY", "")` / `monkeypatch.setenv("JWT_SECRET_KEY", "a-value")`, then calls `on_startup()` directly (imported from `app.main`); asserts `RuntimeError` with the exact readable message for TC-05/06, and no exception + `seed_if_empty` still runs for TC-07. |
| Performance                | `backend/tests/test_config.py`                        | AUTH-08-TC-08 | Runner: no new runner — in-process `time.perf_counter()` wrapping the validation branch inside the existing `pytest` suite (same pattern as AUTH-03's TC-11 hash-latency benchmark); asserts added latency <10ms, well under the 1s budget. |
| Integration                | `backend/tests/test_docker_compose_config.py`          | AUTH-08-TC-03 | Plain-text structural read of `docker-compose.yml`; asserts the `backend` service's `environment:` block references `${JWT_SECRET_KEY}` and `CORS_ORIGINS`. Runner: existing `pytest`, no YAML-parsing dependency added (plain string assertions keep this dependency-free, avoiding a config-drift trigger). |
| Integration (deferred)     | `backend/tests/test_docker_compose_config.py`          | AUTH-08-TC-04 | Execution: deferred to manual verification — requires a live Docker daemon, which is not available in this repo's `pytest`/CI environment (`docs/config/project-commands.yaml` has no Docker-based preflight step). Author-time smoke: TC-03's structural assertion in the same file already verifies the exact `environment:` content (`JWT_SECRET_KEY`, `CORS_ORIGINS` keys and value-reference syntax) that `docker-compose up` depends on to succeed — the docstring on the TC-04 stub test cross-references TC-03 and the story's own Manual test mapping (`docs/stories/AUTH-08.md` § Test mapping: "Run `docker-compose up`... confirm... 200"). |
| E2E (declared, backend-only) | `backend/tests/test_cors.py`                         | AUTH-08-TC-09 | Declared `type: e2e` in `docs/test-cases/AUTH-08.json`, but this check is a CORS-preflight assertion entirely reproducible via FastAPI's `TestClient` issuing an `OPTIONS` request with `Access-Control-Request-Headers: Authorization` — no live browser or cross-container network hop is needed to verify the middleware's `allow_headers` behavior. Runner: existing `pytest`, no browser-automation tool installed, matching AUTH-04's precedent of executing declared-`e2e` TCs under the already-configured test runner rather than installing a new one. |
| Manual                     | Story Test mapping (`docs/stories/AUTH-08.md`)         | AUTH-08-TC-10, TC-11 | Both TCs are `automatable: false` in `docs/test-cases/AUTH-08.json`. Manual procedure: run `docker-compose up`, log in via the frontend UI, refresh, confirm the session persists and protected endpoints return 200 (TC-10); repeat identically under local dev (`uvicorn` + `npm run dev`) and confirm parity (TC-11). Both require AUTH-02's real login endpoint and AUTH-04's frontend token-persistence code to exist and be deployed — this story's manual verification is gated on those stories' implementation landing first, consistent with the story's Dependencies section ("a normal sequencing dependency, not a blocking unknown"). |

Every TC in `docs/test-cases/AUTH-08.json` (TC-01 through TC-11) appears in the table above.
Coverage gate: backend unit/integration coverage follows the repo's existing threshold (no
`harness.yaml` override present → 80% default, per `docs/config/project-commands.yaml`). No new
test runner, e2e framework, or contract tool is installed by this story — every declared `e2e`,
`contract`, and `performance` TC executes under the already-configured `pytest` suite, matching
the identical precedent AUTH-02/AUTH-03/AUTH-04's PLANs each established for their own
declared-but-runner-less TC types in this repo.

### Plan validation rounds

| Round | Verdict | Failing dimensions | Action                     |
|-------|---------|----------------------|-------------------------------|
| 1     | PASS    | —                    | Continue to Phase 5 handoff  |

## Plan validation

- Date: 2026-08-17T23:10:00Z
- Verdict: PASS
- Wiring: PASS (no new production module is `create`d — F-01/F-02/F-03/F-07 are `modify` rows against already-wired files: `.env.example` and `docker-compose.yml` are configuration/entry files with no import-site to register, `backend/app/main.py`'s `on_startup()` is already FastAPI's registered startup hook, `README.md` is documentation. F-04/F-05/F-06 are leaf test files, exempt per the wiring test-file exception.)
- Docs: PASS (T3 fires — new env var `JWT_SECRET_KEY` — addressed by T-01 (`backend/.env.example`) and T-07 (root `README.md` env-var table entry + docker-compose run instruction + CORS resolution note). T1/T2/T4 do not fire: no new runnable surface, no new HTTP route, no new service dir/port introduced.)
- Runner-setup: PASS (TC-01 is `contract`-typed, TC-08 is `performance`-typed, TC-09 is `e2e`-typed in `docs/test-cases/AUTH-08.json`; none requires a new runner — TC-01 is a structural file-content assertion, TC-08 is an in-process `time.perf_counter()` benchmark, and TC-09 is a CORS-preflight assertion fully reproducible via FastAPI's `TestClient`, all executed under the already-configured `pytest` runner, mirroring the identical precedent AUTH-02/AUTH-03/AUTH-04's PLANs established for their own declared-but-runner-less TC types. No browser-automation or load-test tool is required.)
- Cross-section: PASS (every TC-01..TC-11 in `docs/test-cases/AUTH-08.json` appears in § 7's table; every file table row F-01..F-07 is referenced by at least one task's Files column in § 5 — F-01 by T-01, F-02 by T-02, F-03 by T-03, F-04 by T-04, F-05 by T-05, F-06 by T-06, F-07 by T-07; every task's Files column references only F-NN ids present in § 2; all 7 research conditions C-1..C-7 appear in § 6's Conditions for GO sub-section with non-empty Addressed-by cells.)
- Config drift: PASS (no new runtime dependency, service, or port is introduced — TC-03's structural docker-compose assertion deliberately avoids adding a YAML-parsing dependency, using plain-text assertions instead; `docs/config/project-commands.yaml preflight:` and `docs/config/stack-smoke.md` require no edits.)
- Rounds: 1
