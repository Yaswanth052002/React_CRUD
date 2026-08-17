# Feature: AUTH-03 — Password security and server-side hashing

## Problem

AUTH-02 introduced the `password_hash` and `must_reset_password` columns and a stdlib
`pbkdf2_hmac` placeholder hash so it could ship independently. That placeholder is not an
approved production hashing scheme. Until it is replaced, any password persisted or verified
through the create-user and login paths is protected only by a stopgap — an unacceptable state
for credentials that, per the story, must "remain secure even if the database or API responses
are exposed."

## Outcome

Every password persisted via the create-user path is hashed with bcrypt (work factor 12) in
the service layer, and every login verification compares the submitted plaintext against that
bcrypt hash using a constant-time verify. No API response ever includes `password` or
`password_hash`. No user record can be created without an explicit client-supplied password.

## Constraints

- No schema changes: `password_hash` and `must_reset_password` already exist (AUTH-02 D-04).
  This story owns hashing/verification logic only, not the columns.
- Hashing adds ≤300ms to p95 latency of create-user and login endpoints under normal
  (non-concurrent) load.
- Minimum-necessary new dependency: `passlib[bcrypt]` (per story Decision log), bcrypt work
  factor 12.
- Plaintext passwords must never appear in logs, error messages, or stack traces.
- Placeholder-hash rows from AUTH-02 dev/test data become unusable once this story ships; no
  data migration is performed — affected rows are re-provisioned via AUTH-02's AC5 operator
  script.

## Solution sketch

Extend AUTH-02's `AuthService` with two real bcrypt-backed methods — `hash_password` and
`verify_credentials` — replacing the stdlib placeholder implementations in place, while keeping
all existing service/repository/API call sites and signatures unchanged. Response schemas
already exclude password fields; this story adds a regression-style audit confirming that
remains true across all user-returning endpoints.

## Addressing Research Conditions

- C-1 (Performance — latency benchmark ≤300ms p95): `backend/tests/test_password_hashing.py`
  includes a micro-benchmark that hashes 100 passwords at work factor 12 and asserts p95 ≤
  300ms; if exceeded, work factor drops to 11 and the benchmark is re-run and documented in
  PLAN.md.
- C-2 (Compatibility — coordinate with AUTH-02's schema/test fixtures): PLAN.md confirms
  AUTH-02's F-08 has landed (`password_hash`, `must_reset_password` columns, `UserCreate`
  requiring `password`) before implementation starts; all POST/PUT test fixtures for the users
  endpoints are updated to include `password`.
- C-3 (Domain — placeholder-hash incompatibility is expected): PLAN.md and this PRD's Rollout
  plan explicitly document that AUTH-02's `pbkdf2_hmac` placeholder rows fail login once bcrypt
  ships; affected dev/test rows are re-provisioned via AUTH-02's AC5 operator script — no data
  migration in scope.
- C-4 (Domain — response-schema audit): implementation includes an explicit audit pass over
  every router returning a `User`-shaped object (`GET /api/users`, `GET /api/users/{id}`,
  `POST /api/users`, `PUT /api/users/{id}`, and AUTH-04's current-user/me endpoint) confirming
  each declares `response_model=UserOut` (or equivalent) and never serializes a raw ORM
  instance.

## Scope

- In:
  - Replacing AUTH-02's stdlib `pbkdf2_hmac` placeholder in `AuthService` with a bcrypt-backed
    `hash_password` (via `passlib[bcrypt]`, work factor 12).
  - Replacing the placeholder verify path with a bcrypt constant-time `verify_credentials`.
  - Rejecting user-creation requests that omit a password (no invented defaults).
  - Response-schema audit confirming `password`/`password_hash` are absent from every
    user-returning endpoint.
  - Catching hashing/verification library exceptions at the service layer and surfacing a
    generic, readable error (never a raw stack trace).
  - WARN-level logging of hash/verify failures keyed by user id only, never password material.
  - Adding `passlib[bcrypt]` to `backend/requirements.txt`.
- Out:
  - Adding or migrating the `password_hash` or `must_reset_password` columns (owned by AUTH-02).
  - Any data migration of existing placeholder-hashed rows (dev/test rows are re-provisioned
    manually via AUTH-02's AC5 operator script; no automated migration is in scope).
  - The login endpoint itself, session/token issuance, or the current-user/me endpoint
    (owned by AUTH-02 / AUTH-04 respectively) — this story only supplies the hash/verify
    functions those endpoints call.
  - Password-input UX / client-side validation (owned by AUTH-01).
  - Per-deploy pepper or other hashing enhancements beyond bcrypt work factor 12 (flagged as a
    future enhancement in research, not in scope here).

## Functional requirements

FRs trace 1:1 to story ACs; see `docs/stories/AUTH-03.md` for canonical wording.
New impl constraints introduced below (when any):

**AUTH-03-FR-1** — Bcrypt hash implementation replaces placeholder *(extends AC #1 with: library and cost-factor specifics)*

`AuthService.hash_password` uses `passlib`'s `CryptContext` configured for the `bcrypt` scheme
with `bcrypt__rounds=12`, replacing the existing `hashlib.pbkdf2_hmac` call site in place (same
method signature, same call sites in the service layer).

**AUTH-03-FR-2** — Constant-time verify replaces placeholder compare *(extends AC #2 with: library specifics and failure-mode contract)*

`AuthService.verify_credentials` uses the `CryptContext.verify()` constant-time comparison
against the stored bcrypt hash. It returns a plain boolean; it never logs, echoes, or
re-derives the submitted plaintext, and it does not distinguish "user not found" from "password
mismatch" in its return value or in caller-visible error text.

**AUTH-03-FR-3** — Response-schema audit *(extends AC #3 with: concrete audit procedure)*

Implementation includes a checklist/audit step (recorded in PLAN.md) enumerating every router
handler that returns a `User`-shaped object and confirming each uses a response model that
omits `password`/`password_hash`. A new or extended test asserts the raw JSON response body for
each such endpoint has no `password` or `password_hash` key.

**AUTH-03-FR-4** — No invented default password *(extends AC #4 with: rejection behavior)*

When `UserCreate` is submitted without a non-empty `password`, the service layer raises a
validation-level error (surfaced as `422` at the API layer, consistent with existing Pydantic
validation behavior) rather than generating, defaulting, or silently skipping hash generation.

## Non-functional requirements

- Performance: hashing/verification adds ≤300ms to p95 latency of the create-user and login
  endpoints under single-request, non-concurrent load (story NFR). Per
  `.claude/rules/performance-baseline.md`: no unbounded fan-out or N+1 reads are introduced —
  verify remains a single `get_by_email`-then-compare call.
- Security: bcrypt work factor 12 via `passlib[bcrypt]`. Per `.claude/rules/security-baseline.md`:
  applies to the hash/verify code path added here — plaintext passwords never appear in logs,
  error messages, or stack traces; hashing/verification library exceptions are caught at the
  service layer and surfaced as a generic readable error, never a raw exception.
- Accessibility: N/A — backend-only story, no new UI surface (password input UX is owned by
  AUTH-01).
- Observability: hash/verify failures are logged at WARN level with user id only; no password
  material, plaintext or hash, ever appears in log output.

## Rollout plan

- **Strategy**: bang-bang — this is an internal service-layer swap (placeholder hash function →
  bcrypt) with no client-visible contract change beyond the already-in-place `UserCreate`
  password requirement (owned by AUTH-02). Low blast radius, deploys with the next backend
  release.
- **Feature flag**: none — hashing scheme is not user-facing or toggleable; a mid-rollout
  toggle would require supporting two hash schemes simultaneously, which is out of scope.
- **Backout plan**: revert the `AuthService.hash_password`/`verify_credentials` implementation
  commit to restore AUTH-02's placeholder functions; no schema or data changes are made by this
  story, so backout requires no migration. Dev/test rows re-provisioned under bcrypt are simply
  re-provisioned again under the placeholder scheme if a rollback occurs.
- **Success signal**: micro-benchmark in `test_password_hashing.py` reports p95 ≤300ms at work
  factor 12, and the response-schema audit test suite passes with zero `password`/`password_hash`
  leaks across all audited endpoints.

## Documentation requirements

- **README updates**: `README.md` § 10 (API Documentation) — note that `password` is a required
  field on `POST /api/users` payloads and is hashed server-side with bcrypt; no plaintext or
  hash is ever returned in responses.
- **Runbook**: none — no new operational runbook needed beyond AUTH-02's existing AC5
  re-provisioning script, which this story's rollout plan references.
- **API reference**: FastAPI's generated `/docs` (Swagger UI) already reflects `UserCreate`'s
  `password` field and `UserOut`'s exclusion of it; no separate OpenAPI file to hand-maintain.
- **Inline code comments**: `backend/app/services/auth_service.py` — docstring on
  `hash_password`/`verify_credentials` noting the bcrypt work factor 12 choice and the
  constant-time verify contract, for future maintainers considering a work-factor change.
- **Examples / how-to**: none.

## Open questions

Decisions logged in `docs/stories/AUTH-03.md` § Decision log.

## Approvals
- **2026-08-17** — yaswanth.panthangi@apexon.com (PO + Designer + BA, single-approver mode covers all when one human): **APPROVE**
  - Feature Summary, FRs, User Flows reviewed
  - UI specs: N/A for backend-only feature (`design = n/a`)
  - Edge Cases, Open Questions, test-case completeness reviewed
  - No-placeholder check ✓ · `[NEEDS CLARIFICATION]` count=0
  - Research verdict GO-WITH-CONDITIONS (all conditions addressed — see § Addressing Research Conditions)
  - Tracker subtask: n/a (issue tracker = none)
