# PLAN: AUTH-03 — Password security and server-side hashing

Status: Draft
Source: `docs/features/AUTH-03/REQUIREMENTS.md` (APPROVED) · `docs/research/AUTH-03.md` (86/100, GO-WITH-CONDITIONS) · `docs/stories/AUTH-03.md` (v3, PASS)

## Sequencing note (mandatory precondition)

`docs/features/AUTH-02/state.json` reports `"phase": "plan-implementation"` with no `impl` field —
AUTH-02 has **not** been implemented yet as of this PLAN's authoring date. Every task and file
below assumes AUTH-02's `PLAN.md` tasks **T-01** (adds `password_hash`/`must_reset_password`
columns to `backend/app/models/user.py`, ADR-4) and **T-03** (creates
`backend/app/services/auth_service.py` with `AuthService`, its `_verify_credentials` stdlib
`pbkdf2_hmac` placeholder, and the `login` method) have landed and merged first. `/arh-implement`
for AUTH-03 MUST verify both files exist with the shapes documented in AUTH-02's PLAN.md §2/§3
before starting T-01 below. This is a hard external precondition, not a task in this PLAN's DAG
(see §6 Cross-Feature Dependency Notes).

## 1. Architecture Decisions

### ADR-1: Bcrypt via `passlib[bcrypt]` (work factor 12), ratifying the story/research decision · Accepted · 2026-08-17 · impl-planning-agent

**Context**: `docs/stories/AUTH-03.md` § Decision log already chose `passlib[bcrypt]` over `argon2`/`scrypt` and fixed the work factor at 12, and `docs/research/AUTH-03.md` scored this GO-WITH-CONDITIONS (Condition C-1 requires a latency benchmark to confirm the ≤300ms p95 budget holds at that work factor). This mini-ADR ratifies that decision at the implementation-planning level and pins the exact library configuration so the implementation-agent does not re-litigate it.

**Decision**: `AuthService` gets two bcrypt-backed public methods, replacing AUTH-02's stdlib `pbkdf2_hmac` placeholder in place (same class, same call sites): `hash_password(plaintext: str) -> str`, which calls `CryptContext(schemes=["bcrypt"], deprecated="auto", bcrypt__rounds=12).hash(plaintext)`; and `verify_credentials(email: str, plaintext: str) -> bool`, which looks up the user by email via the existing `UserRepository.get_by_email`, and — if a row with a non-null `password_hash` exists — calls the same `CryptContext.verify(plaintext, stored_hash)` for the constant-time compare, returning `False` (never raising, never distinguishing "no such user" from "wrong password") on any negative outcome including a malformed/foreign-format hash (AUTH-02's placeholder format `salt$hex_digest` is not a valid bcrypt hash and `CryptContext.verify` raises `UnknownHashError` for it, which this method catches and treats as `False` — this is the documented AC path for AUTH-03-TC-12). AUTH-02's private `_verify_credentials` (called internally by `login`) is updated to delegate to this new public `verify_credentials`, preserving `login`'s existing signature and call site.

**Alternatives considered**:
- `argon2-cffi` (Argon2id): rejected — story Decision log already ruled this out as not the "minimum-necessary new dependency" for this stack; bcrypt via `passlib` needed no native-toolchain build step beyond the `bcrypt` C extension, which ships prebuilt wheels for the target platforms.
- Raw `bcrypt` package without `passlib`: rejected — `passlib`'s `CryptContext` gives a uniform `verify()` contract that also raises a typed, catchable error (`UnknownHashError`) for foreign hash formats, which this story needs anyway to make TC-12 (placeholder-hash-fails-cleanly) assertable without hand-rolling prefix sniffing.

**Consequences**:
- Positive: matches the story's already-approved library/work-factor decision exactly; `CryptContext.verify`'s typed exception on foreign hash formats gives a clean, testable path for the documented AUTH-02→AUTH-03 placeholder-hash cutover (condition C-3) without extra prefix-detection code.
- Negative: bcrypt truncates input at 72 bytes — a documented bcrypt property, not a project-introduced defect; no additional truncation-guard code is added in this story since password length limits are AUTH-01's client-side concern, not this story's scope. Reversible mechanically — swapping `bcrypt__rounds` or the scheme string is a one-line `CryptContext` config change with no data migration, since `password_hash` stores the scheme identifier inline (standard bcrypt hash format).

## 2. File and Module Plan

| ID   | Action | Path                                              | Reason                                                                 |
|------|--------|----------------------------------------------------|--------------------------------------------------------------------------|
| F-01 | modify | `backend/app/services/auth_service.py`              | Add `hash_password`/`verify_credentials` bcrypt methods; update `_verify_credentials` to delegate (ADR-1, FR-1, FR-2). File created by AUTH-02 T-03 — see Sequencing note. |
| F-02 | modify | `backend/app/schemas/user.py`                       | Add required `password: str` field (non-empty validator, min length 8) to `UserCreate` (FR-4) |
| F-03 | modify | `backend/app/services/user_service.py`              | `create_user` calls `AuthService(db).hash_password(payload.password)`, stores result as `password_hash`, drops plaintext `password` key before persisting (FR-1 wiring — entry-registration site for F-01's new `hash_password` method and F-02's new field) |
| F-04 | modify | `backend/requirements.txt`                          | Add `passlib[bcrypt]==1.7.4` |
| F-05 | create | `backend/tests/test_password_hashing.py`            | TC-02 (unique salts), TC-03/04 (verify success/fail), TC-05 (WARN-log hygiene on library exception), TC-11 (p95 latency benchmark), TC-12 (placeholder-hash rejects cleanly) |
| F-06 | modify | `backend/tests/test_users.py`                       | Add `password` to all existing POST/PUT fixtures (condition C-2); add TC-01 (persisted hash is bcrypt, distinct from plaintext), TC-09/TC-10 (missing/empty password → 422) |
| F-07 | modify | `backend/tests/test_auth.py`                        | Update AUTH-02's login-test fixtures from the stdlib `pbkdf2_hmac` placeholder format to bcrypt hashes produced via `AuthService.hash_password`, so AUTH-02's existing login TCs keep passing once the placeholder is replaced (condition C-2) |
| F-08 | create | `backend/tests/test_response_schema_audit.py`       | TC-06/07/08 — raw-JSON-body audit (no `password`/`password_hash` key) across `GET /api/users`, `GET /api/users/{id}`, `POST /api/users`, `PUT /api/users/{id}` (FR-3) |
| F-09 | modify | `README.md`                                          | § 10 — document `password` as a required `POST /api/users` field, hashed server-side with bcrypt; note no plaintext or hash is ever returned in any response |
| F-10 | modify | `docs/config/project-commands.yaml`                 | `preflight:` — append a smoke-import for the new dependency (config drift C1) |

`F-05` and `F-08` are leaf test files with no consumer/entry-registration site to wire (per
`plan-validation` wiring exception for test files). `F-01`'s two new public methods are consumed
by `F-03` (`hash_password`, new call site in `create_user`) and by `F-01` itself internally
(`verify_credentials`, called from the pre-existing `_verify_credentials`/`login` call chain
that AUTH-02 already wires into `backend/app/api/auth.py` — no new entry point is introduced by
this story on the verify side, only a body swap inside the already-wired method). `F-02`'s new
`password` field is consumed by `F-03`. `F-04`'s new dependency is smoke-checked by `F-10`.

## 3. Module Hierarchy

```
backend/app/
├── services/
│   ├── auth_service.py                 (existing module, created by AUTH-02 T-03; extended here)
│   │   - input:  plaintext: str (hash_password) | email: str, plaintext: str (verify_credentials)
│   │   - output: str (bcrypt hash) | bool
│   │   - public: AuthService(db).hash_password(plaintext: str) -> str
│   │             AuthService(db).verify_credentials(email: str, plaintext: str) -> bool
│   │   - private: _verify_credentials(user_or_none, plaintext) -> bool   (now delegates to verify_credentials's CryptContext.verify call; unchanged signature, per ADR-1)
│   └── user_service.py                 (existing module; create_user modified)
│       - input:  UserCreate (now includes password: str)
│       - output: User (persisted with password_hash set, password never persisted)
│       - public: UserService(db).create_user(payload: UserCreate) -> User   (signature unchanged)
└── schemas/
    └── user.py                          (existing module; UserCreate modified)
        - input:  n/a (DTO)
        - output: UserCreate { name, email, phone, role, status, password: str }
        - public: UserCreate.password validated non-empty, min length 8, via field_validator
```

## 4. State and Data Management

- **No new persistent state.** `password_hash` (String, nullable) and `must_reset_password`
  (Boolean, default `True`) already exist on the `User` model per AUTH-02 D-04 — this story
  writes real bcrypt values into the same column, it does not add or migrate a column.
- **Plaintext lifecycle**: the plaintext `password` field exists only inside the in-memory
  `UserCreate` Pydantic instance and the `create_user` call stack; `UserRepository.create`
  receives a `dict` from which `F-03` has already popped `password` and substituted
  `password_hash` — the plaintext value is never passed to the repository layer, never logged
  (per `.claude/rules/security-baseline.md`), and is garbage-collected once `create_user`
  returns.
- **Placeholder-hash rows** (AUTH-02 dev/test fixtures using the stdlib `pbkdf2_hmac` format):
  become permanently unverifiable once this story ships (`verify_credentials` returns `False`
  for any non-bcrypt hash — ADR-1). No data migration is performed; affected rows are
  re-provisioned via AUTH-02's AC5 `set_initial_password.py` script, per the story's Rollout
  plan and research condition C-3. This is expected behavior, not a defect.
- **No client-side/frontend state** — this story is backend-only (`design = n/a`).

## 5. Task Breakdown

| #    | Title                                                                 | Complexity | [P] | Predecessors | Files | Notes                                                                 |
|------|--------------------------------------------------------------------------|------------|-----|---------------|-------|--------------------------------------------------------------------------|
| T-01 | Add `passlib[bcrypt]==1.7.4` to `requirements.txt`                        | S          | [P] | —             | F-04  | Assumes AUTH-02 T-01/T-03 already merged (Sequencing note)              |
| T-02 | Add required `password: str` field + non-empty/min-length validator to `UserCreate` | S | [P] | — | F-02 | FR-4; independent of hashing implementation                            |
| T-03 | Implement `AuthService.hash_password` / `verify_credentials` bcrypt methods; update `_verify_credentials` to delegate | M | | T-01 | F-01 | ADR-1, FR-1, FR-2; requires `passlib[bcrypt]` installed                |
| T-04 | Wire `UserService.create_user` to `AuthService.hash_password`             | M          |     | T-02, T-03    | F-03  | FR-1 wiring; pops plaintext `password` before persistence               |
| T-05 | Write `test_password_hashing.py` (unique salts, verify success/fail, WARN-log hygiene, p95 latency benchmark, placeholder-hash rejection) | L | | T-03 | F-05 | Covers TC-02, TC-03, TC-04, TC-05, TC-11, TC-12; conditions C-1, C-3    |
| T-06 | Update `test_auth.py` login fixtures from placeholder format to bcrypt hashes | M | | T-03 | F-07 | Condition C-2 (AUTH-02 fixture coordination)                            |
| T-07 | Update `test_users.py` fixtures with `password`; add hash-persisted + missing/empty-password tests | M | | T-04 | F-06 | Covers TC-01, TC-09, TC-10; condition C-2                                |
| T-08 | Create `test_response_schema_audit.py` (list/get/create/update response-body audit) | M | | T-04 | F-08 | Covers TC-06, TC-07, TC-08; condition C-4                                |
| T-09 | `docs`: document required `password` field + bcrypt hashing in `README.md` § 10 | S | | T-04 | F-09 | Documentation requirements section of REQUIREMENTS.md                   |
| T-10 | Update `docs/config/project-commands.yaml preflight:` with a `passlib`/`bcrypt` smoke-import | S | [P] | T-01 | F-10 | Config drift C1 (new runtime dependency)                                 |

`[P]` holds for T-01 and T-02 — disjoint files (`F-04`, `F-02`), no predecessors, no shared
mutable state. T-10 is listed `[P]` relative to T-02/T-03/T-04/T-05..T-09 (disjoint file `F-10`,
touches only the preflight config) but is sequenced after T-01 since it smoke-checks the exact
dependency T-01 adds. All other tasks touch `F-01`/`F-03` or depend on their outputs and run
sequentially.

## 6. Carry-Forward Risks and Conditions

Risks from `docs/research/AUTH-03.md` § Risk register.

### Risks addressed by tasks

| Risk id | Severity | Addressed by |
|---------|----------|---------------|
| #2      | HIGH     | T-05          |

### Risks accepted (carry-forward)

| Risk id | Severity | Rationale                                                                                                   |
|---------|----------|---------------------------------------------------------------------------------------------------------------|
| #1      | HIGH     | accepted — cross-story sequencing risk (AUTH-03 depends on AUTH-02's D-04 columns and `AuthService` skeleton landing first); no task in this PLAN can force an upstream story to ship. Mitigated by the explicit Sequencing note above and AUTH-02's own PLAN.md ADR-4, which documents the handoff. Revisit if AUTH-02's PLAN.md is materially rescoped before implementation. |

### Conditions for GO (research_verdict GO-WITH-CONDITIONS)

| Cond | Condition (verbatim, abbreviated)                                                                                  | Addressed by |
|------|------------------------------------------------------------------------------------------------------------------------|---------------|
| C-1  | Test plan includes a latency benchmark (100 hashes @ work factor 12, p95 ≤300ms; drop to 11 and re-benchmark if exceeded) | T-05          |
| C-2  | Coordinate with AUTH-02's schema and test fixtures (confirm columns/`UserCreate.password` exist; update fixtures)      | T-06, T-07    |
| C-3  | Document placeholder-hash incompatibility (AUTH-02's `pbkdf2_hmac` rows fail verification once bcrypt ships)           | T-05          |
| C-4  | Response-schema audit across all `User`-returning endpoints (`response_model=UserOut`, no raw ORM leak)                | T-08          |

### Cross-Feature Dependency Notes

- **AUTH-02** (existing-user authentication, in `plan-implementation` phase, not yet implemented):
  this PLAN's T-01 and T-03 assume AUTH-02's PLAN.md tasks **T-01** (`backend/app/models/user.py`
  — `password_hash`/`must_reset_password` columns, ADR-4) and **T-03** (`backend/app/services/auth_service.py`
  — `AuthService` class with `login`, rate limiter, and the `_verify_credentials` stdlib
  placeholder) have already landed. `/arh-implement` MUST verify both files exist with the
  documented shapes before starting this PLAN's T-01.
- **AUTH-04** (current-user/me endpoint, `researched` phase): FR-3's response-schema audit
  explicitly names AUTH-04's future `/me` endpoint as an audit target once it ships; this PLAN's
  T-08 audits only the four endpoints that exist today (`GET /api/users`, `GET /api/users/{id}`,
  `POST /api/users`, `PUT /api/users/{id}`) — AUTH-04 is responsible for adding its own
  `response_model=UserOut` audit coverage when it lands, per that story's own PLAN.

## 7. Test Strategy

| Layer       | Test path                                          | TCs covered              | Notes                                                                                                   |
|-------------|-------------------------------------------------------|----------------------------|-------------------------------------------------------------------------------------------------------------|
| Unit        | `backend/tests/test_password_hashing.py`               | AUTH-03-TC-02              | Same plaintext hashed twice via `AuthService.hash_password`; asserts inequality (bcrypt per-call salt)      |
| Integration | `backend/tests/test_password_hashing.py`               | AUTH-03-TC-03, TC-04, TC-12 | Direct `AuthService` calls against the isolated in-memory test DB (same fixture pattern as `test_users.py`); TC-12 seeds a row with AUTH-02's `salt$hex_digest` placeholder format and asserts `verify_credentials` returns `False` without raising |
| Security    | `backend/tests/test_password_hashing.py`               | AUTH-03-TC-05              | Monkeypatches `CryptContext.hash`/`verify` to raise, captures `caplog`, asserts WARN-level log contains only `user_id` and the API-facing error is generic (no raw exception text) |
| Performance | `backend/tests/test_password_hashing.py`               | AUTH-03-TC-11              | Runner: no new runner — pure in-process function-call timing via stdlib `time.perf_counter()` inside the existing `pytest` suite (`hash_password` is a local CPU-bound call, not a network round trip, so no live-server harness like AUTH-02's `conftest.py`/`test_login_perf.py` is needed). Hashes 100 distinct passwords sequentially, computes p95, asserts ≤300ms; on failure, asserts again at `bcrypt__rounds=11` and documents the fallback inline in the test's docstring per condition C-1 |
| Integration | `backend/tests/test_users.py`                          | AUTH-03-TC-01, TC-09, TC-10 | FastAPI `TestClient` against the isolated in-memory SQLite DB (existing pattern); TC-01 asserts the persisted `password_hash` column has the `$2b$` bcrypt prefix and differs from the submitted plaintext; TC-09/10 assert `422` for missing/empty `password` |
| Contract    | `backend/tests/test_response_schema_audit.py`          | AUTH-03-TC-06, TC-07, TC-08 | Runner: existing `pytest` + FastAPI `TestClient` (already configured in `docs/config/project-commands.yaml` `test_unit`) — a structural raw-JSON-body key assertion, not a consumer-driven contract test against an external system, so no new contract-testing tool (e.g. Pact) is installed, matching AUTH-02's precedent for its own contract-typed TC-11 |

Coverage gate: unit/integration coverage for `backend/` follows the repo's existing threshold
(no `harness.yaml` override present → 80% default). E2E: not applicable —
`docs/config/project-commands.yaml` declares `test_e2e: (n/a)` repo-wide, and this story's Test
mapping in `docs/stories/AUTH-03.md` confirms no e2e suite (backend-only story).

### Plan validation rounds

| Round | Verdict | Failing dimensions | Action                   |
|-------|---------|----------------------|----------------------------|
| 1     | PASS    | —                    | Continue to Phase 5 handoff |

## Plan validation

- Date: 2026-08-17T19:15:00Z
- Verdict: PASS
- Wiring: PASS (F-01's two new public methods are consumed at F-03, listed as `modify`; F-02's new `password` field is consumed at F-03; F-05/F-08 are leaf test files, exempt per the wiring test-file exception)
- Docs: PASS (no rubric trigger fires — no new runnable surface, no new HTTP route, no new env var, no new service/port; T-09 documents the `password` field/bcrypt behavior on the existing `POST /api/users` route anyway, per REQUIREMENTS.md § Documentation requirements, which is a story-level requirement independent of the rubric trigger)
- Runner-setup: PASS (TC-11 is `performance`-typed but requires no new runner — it is an in-process wall-clock timing assertion using stdlib `time.perf_counter()` inside the existing `pytest` suite, not a network-load test; TC-06/07/08 are `contract`-typed but require no new runner — they are structural raw-JSON-body assertions via the existing `pytest` + `TestClient`, mirroring AUTH-02's precedent for its own contract-typed TC-11; no e2e TCs exist per repo-wide `test_e2e: n/a`)
- Cross-section: PASS (every `F-NN` file is referenced by at least one task's Files column; every task's Files column references only `F-NN` ids present in §2; every TC type declared in `docs/test-cases/AUTH-03.json` — unit, integration, security, performance, contract — has a matching row in §7 Test Strategy backed by a §5 task; all 12 TCs in the test-case JSON appear exactly once across §7)
- Config drift: PASS (C1 fires — new runtime dependency `passlib[bcrypt]` added via F-04 — addressed by T-10 updating `docs/config/project-commands.yaml preflight:`; C2/C3 do not fire — no new service, port, or host is introduced)
- Rounds: 1
