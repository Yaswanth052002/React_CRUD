# Feature: AUTH-02 — Existing-user authentication and credential validation

## Problem

Existing users (Admin and Regular User) of the CRUD dashboard have no way to authenticate as
themselves — there is no login endpoint, and the `users` table has no credential column today.
Separately, once AUTH-03 adds the credential column, every pre-existing/seeded user row still
has no password and no mechanism exists to give one, so no legitimate account could actually
reach a login flow at all. Operators need a controlled, auditable way to bootstrap initial
credentials without ever introducing a hardcoded or guessable default password.

## Outcome

An existing user with a valid credential can log in with email + password and receive a
successful authentication response, with no row inserted or duplicated in `users`. A user with
no matching email, a wrong password, or an unprovisioned (`must_reset_password=true`) account
receives an identical generic `401` in all three cases — no observable signal distinguishes
them. Every pre-existing/seeded row is safely provisioned with an unusable random credential by
a one-time, idempotent startup migration, and an operator can subsequently assign a real initial
password to a specific user via a local, non-network-reachable script that never logs or
persists the plaintext value.

## Constraints

- No credential column exists on `users` yet; AUTH-03 supplies `password_hash` and the
  hash/verify interface. AUTH-02's own validation stubs that interface (`verify_credentials`);
  real end-to-end production login is gated on AUTH-03 landing, but is not a blocker for this
  story's implementation or validation.
- No rate-limiter, secrets store, or `scripts/` package exists in this codebase today —
  AUTH-02 introduces all three of these primitives (rate-limiter, `AuthService`, `backend/app/scripts/`).
- No hardcoded, default, or guessable password may be introduced anywhere in code, migrations,
  seed data, or documentation.
- The provisioning script (AC5) must never be reachable via HTTP; it requires direct
  server/deployment access only.
- Deployment target is single-server (per README's target platform); no shared cache (Redis)
  exists, constraining the rate-limiter to an in-process implementation for v1.

## Solution sketch

Add a new `AuthService` (separate from `UserService`) that owns three responsibilities: (1) a
`POST /api/auth/login` endpoint validating email/password against AUTH-03's hash-verify
interface and returning a generic `401` for any invalid case (unknown email, wrong password, or
unprovisioned account), backed by an in-process per-email rate limiter; (2) a one-time,
idempotent startup migration that assigns every credential-less row a cryptographically random,
unusable password hash and sets `must_reset_password=true`; and (3) a companion CLI script
(`python -m app.scripts.set_initial_password <email>`) that reads a real password interactively
via `getpass`, hashes it, updates the target row, and clears `must_reset_password`. All three
pieces share the existing `UserRepository` and never bypass the `api → service → repository →
models` layering.

## Addressing Research Conditions

- C-1 (AC4 migration idempotence and startup integration, Domain, HIGH): mitigated by requiring
  the migration to filter `WHERE password_hash IS NULL` before updating, and by fixing the
  startup order to `create_all → seed_if_empty → provision_existing_users_with_random_password`
  (FR-4). Re-running the migration against already-provisioned rows is a no-op, verified by a
  dedicated test case.
- C-2 (AC5 script security and password input method, Security, HIGH): resolved as a decision —
  password input is an interactive, non-echoing stdin prompt (`getpass`), never a CLI argument,
  eliminating shell-history/`ps` exposure. Script output is limited to a minimal
  success/failure confirmation that never echoes the password (FR-5).
- C-3 (Error message consistency audit, Domain, AC2): mitigated by requiring a single shared
  error-message constant reused for both "email not found" and "wrong password" cases, and by
  requiring `verify_credentials` to perform equivalent work regardless of email existence to
  avoid a timing side-channel (FR-2). A dedicated test asserts byte-for-byte identical status +
  body across both cases.
- C-4 (Rate-limiter implementation scope, Integration, HIGH): resolved as a decision — an
  in-process sliding-window counter (dict keyed by hashed email, timestamp list, pruned per
  request) is used for v1, given no shared store exists and the deployment is single-server
  (FR-6). The in-process/no-persistence caveat (lost on restart, does not scale horizontally) is
  documented for a future distributed-deployment follow-up story.
- C-5 (Service/API structure decision, Domain): resolved as a decision — a new `AuthService`,
  separate from `UserService`, owns login, the AC4 migration function, and the AC5 provisioning
  function, calling `UserRepository` directly (FR-7). This keeps auth concerns isolated from
  CRUD concerns per the reusability baseline's single-responsibility rule.
- C-6 (Response model alignment with AUTH-04, Integration, MED): mitigated by defining a
  minimal `LoginResponse {token: str}` schema now (FR-1), stubbed in AUTH-02's own tests; the
  shape will be reconciled once AUTH-04 (currently story-validated, not yet researched) is
  researched and implemented.
- C-7 (Test fixtures and schema updates, Compatibility, MED): mitigated by requiring all
  existing `test_users.py` POST/PUT payloads to include the new `password` field once AUTH-03
  lands, and by adding `README.md` documentation of the new field and the new
  `/api/auth/login` endpoint (see Documentation requirements below).
- C-8 (Latency benchmarks for AC4 and AC5, Performance, MED): mitigated by including a p95
  latency assertion on the login endpoint in the test suite (target < 400 ms at 50 RPS, per
  NFR below) and by documenting expected AC4 (<2 s for 5 seeded rows) and AC5 (<1.5 s per
  invocation) durations as non-blocking, non-user-facing budgets.
- C-9 (Logging strategy for failed attempts and provisioning, Security/Observability): mitigated
  by requiring all login-attempt logs to key on `user_id` or a hashed email only (never
  plaintext email or password), and by requiring the AC5 script to log only a generic
  success/failure line, never the plaintext password or the target email in a form usable for
  log injection (control characters stripped/rejected).
- C-10 (Scripts infrastructure and entry point, Domain): mitigated by requiring a new
  `backend/app/scripts/` package (`__init__.py` + `set_initial_password.py`) invoked as
  `python -m app.scripts.set_initial_password <email>`, matching AC5's example verbatim (FR-5).

## Scope

- In: `POST /api/auth/login` endpoint (AC1-AC3); one-time idempotent startup migration
  provisioning credential-less rows (AC4); operator-invoked `set_initial_password` CLI script
  (AC5); new `AuthService`; in-process per-email login rate limiter; generic-error handling
  shared across AC2/AC3; login-attempt and provisioning observability (opaque keys only).
- Out: AUTH-03's actual password hashing/verification implementation and schema migration for
  `password_hash` (owned by AUTH-03; AUTH-02 stubs it). AUTH-01's login screen UI. AUTH-04's
  token/session persistence and exact response shape beyond the `{token: str}` stub. A
  self-service, user-facing "forgot password" or first-login password-reset UI/endpoint (not
  scoped to any story today; AC4/AC5 replace the need for it in this deployment model). A
  distributed/shared-store (Redis) rate-limiter backend (future story once multi-server
  deployment is needed).

## Functional requirements

FRs trace 1:1 to story ACs; see `docs/stories/AUTH-02.md` for canonical wording.
New impl constraints introduced below (when any):

**AUTH-02-FR-1** — Login endpoint and response contract *(extends AC1 with: response schema and layering)*

`POST /api/auth/login` accepts `{email, password}`, calls `AuthService.login`, which uses
AUTH-03's `verify_credentials(email, password) -> bool` stub interface via `UserRepository`. On
success, returns `200` with a `LoginResponse {token: str}` stub schema (aligned with AUTH-04
once that story ships). No row is inserted into or duplicated in `users` as a side effect of
login.

**AUTH-02-FR-2** — Generic-error and timing-consistency enforcement *(extends AC2 with: constant reuse and constant-time behavior)*

A single shared error constant (`401`, body `"Invalid email or password."`) is reused for both
"email not found" and "wrong password" outcomes — no second message constant may exist anywhere
in the codebase for these cases. `verify_credentials` performs equivalent hashing/comparison
work regardless of whether the email exists, so response timing does not create an observable
enumeration side-channel.

**AUTH-02-FR-3** — Unprovisioned-account rejection path *(extends AC3 with: shared code path)*

When `must_reset_password=true`, the login path returns via the same code path and same error
constant as FR-2 (no distinct branch, message, or status code) — verified by asserting the
response is byte-for-byte identical to the AC2 cases.

**AUTH-02-FR-4** — Startup migration ordering and idempotence *(extends AC4 with: sequencing and query predicate)*

The migration runs at application startup in the fixed order `create_all → seed_if_empty →
provision_existing_users_with_random_password`. It updates only rows matching
`WHERE password_hash IS NULL`, setting a cryptographically random unusable hash (via AUTH-03's
hashing scheme, generated from `os.urandom` or equivalent CSPRNG input — never a fixed string)
and `must_reset_password=true`. If the migration raises, application startup aborts (no partial
credential state is left running).

**AUTH-02-FR-5** — Provisioning CLI script *(extends AC5 with: package layout, invocation, and I/O contract)*

A new `backend/app/scripts/` package (with `__init__.py` and `set_initial_password.py`) exposes
`python -m app.scripts.set_initial_password <email>`. The script reads the new password via
`getpass` (non-echoing stdin), never as a CLI argument or environment variable. On success it
calls `AuthService.set_user_initial_password`, prints a minimal confirmation
(`"Password set for user <email>"` with the email sanitized of control characters) with exit
code `0`; on any failure (user not found, hashing error) it prints an error to stderr with exit
code `1`. The plaintext password is never logged, persisted, or echoed beyond the operator's own
terminal input, and is discarded immediately after hashing.

**AUTH-02-FR-6** — In-process login rate limiting *(new: derived from research Condition C-4)*

Login attempts are throttled per hashed email at 3 attempts / 60-minute rolling window, using an
in-process dict keyed by hashed email mapping to a pruned list of attempt timestamps. Exceeding
the limit returns `429` with a `Retry-After` header, per `.claude/rules/security-baseline.md`.
This state is lost on process restart and does not synchronize across multiple server instances
— documented as a known v1 limitation, not a defect.

**AUTH-02-FR-7** — `AuthService` module boundary *(new: derived from research Condition C-5)*

A new `backend/app/services/auth_service.py` module owns `login`,
`provision_existing_users_with_random_password`, and `set_user_initial_password`. It calls
`UserRepository` directly (no new repository is introduced) and does not add auth-specific
methods to `UserService`, keeping CRUD and auth concerns separate per the reusability baseline.

## Non-functional requirements

- Performance: login endpoint responds within p95 < 400 ms at 50 RPS sustained for 60 s (best-judgment budget per `.claude/rules/performance-baseline.md`'s bounded-I/O guidance; no repo-wide auth SLA exists today). AC4 migration completes in < 2 s for the current 5 seeded rows; AC5 script completes in < 1.5 s per invocation (non-user-facing, best-effort budget).
- Security: Per `.claude/rules/security-baseline.md`: applies to `/api/auth/login` and the provisioning script/migration. Password verification and hashing use AUTH-03's argon2id/bcrypt scheme; no plaintext password is ever logged, persisted outside the hash, or echoed. Rate-limit per the rule's default (3/email/60 min rolling, HTTP 429 + `Retry-After`) via the in-process limiter in FR-6. Login-attempt logs use opaque `user_id`/hashed-email keys only, never plaintext email. No hardcoded or guessable default password is introduced by the AC4 migration or AC5 script.
- Accessibility: not applicable to this backend-only feature; login-form error messaging accessibility (WCAG 2.1 AA, `aria-describedby`) is owned by AUTH-01's UI implementation.
- Observability: emit a counter metric for failed-login rate (keyed by hashed email) to support monitoring the rate-limit threshold in FR-6; log successful/failed authentication attempts and provisioning script outcomes keyed by opaque identifiers only, per the security NFR above.

## Rollout plan

- **Strategy**: bang-bang — the login endpoint, migration, and script are net-new surfaces with
  no existing traffic depending on them; AUTH-01's UI (which will drive real user traffic to
  this endpoint) ships separately and later.
- **Feature flag**: none — the endpoint is inert until AUTH-01's UI calls it, and the migration
  only affects rows that currently have no credential (a strictly additive, safe default state).
- **Backout plan**: the `/api/auth/login` route and `AuthService` module can be removed/disabled
  without a data migration, since no other code path depends on `password_hash` or
  `must_reset_password` yet (AUTH-03 owns the schema; a rollback of AUTH-02 alone leaves those
  columns present but simply unused). The AC4 migration is idempotent and additive-only, so it
  is safe to leave applied even if AUTH-02's endpoint code is rolled back.
- **Success signal**: `test_auth.py` suite (AC1-AC5) passes in CI, and the login endpoint's p95
  latency benchmark stays under the 400 ms budget in the test run.

## Documentation requirements

- **README updates**: `README.md` — add `POST /api/auth/login` to the API documentation table (§10), document the new `password` field on POST/PUT `/api/users` request bodies once AUTH-03 lands, and add a new subsection describing the `python -m app.scripts.set_initial_password <email>` operator workflow (interactive `getpass` prompt, exit codes, no HTTP exposure).
- **Runbook**: `README.md` §14 Troubleshooting — add a row covering "existing/seeded user cannot log in" pointing to the AC5 provisioning script as the resolution.
- **API reference**: Swagger UI (`/docs`), auto-generated from the FastAPI route and Pydantic schemas — no separate OpenAPI file exists in this repo; no additional action beyond ensuring `LoginResponse`/request schemas have docstrings.
- **Inline code comments**: docstring on `AuthService.provision_existing_users_with_random_password` explaining the idempotence predicate and startup-ordering requirement (FR-4); docstring on `set_initial_password.py` explaining the `getpass`-only input contract and why a CLI argument is deliberately not supported (FR-5).
- **Examples / how-to**: none beyond the README subsection above — the script's own `--help`/usage text (printed on invocation without an email argument) serves as the primary operator-facing example.

## Open questions

Decisions logged in `docs/stories/AUTH-02.md` § Decision log.

## Approvals

**APPROVED** — 2026-08-17, reviewer: yaswanth.panthangi@apexon.com
  - Feature Summary, FRs, User Flows reviewed
  - UI specs: N/A for backend-only feature (`design = n/a`)
  - Edge Cases, Open Questions, test-case completeness reviewed
  - No-placeholder check done · `[NEEDS CLARIFICATION]` count=0
  - Research verdict GO-WITH-CONDITIONS (all 10 conditions addressed above)
  - Tracker subtask: n/a (issue tracker = none)
