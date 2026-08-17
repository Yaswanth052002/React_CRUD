# Research Assessment: AUTH-02 — Existing-user authentication and credential validation

**Story**: AUTH-02  
**Epic**: AUTH  
**Phase**: Research  
**Assessment date**: 2026-08-17  
**Assessor**: Claude Research Agent  

---

## Upstream dependencies

Per story Dependencies section (refreshed post-scope change to include AC4/AC5):
- **Upstream**: AUTH-03 (password security and server-side hashing) — supplies schema migration adding password_hash column, hash/verify interface, and must_reset_password column. This story's own tests stub the interface, so validation is independent; real end-to-end login requires AUTH-03's migration to land (tracked, not a blocker for this story's validation).
- **Downstream**: AUTH-01 (login form UI) — consumes this endpoint's contract and error messages. AUTH-04 (token/session persistence) — consumes successful-login response shape.

Prior research state (from `docs/state/features.json`):
- AUTH-02 is story-validated, P1, independent_test=true, needs_clarification_count=0. Gate is clear to proceed to research.
- AUTH-03 research is complete, verdict GO-WITH-CONDITIONS (conditions documented in `docs/research/AUTH-03.md`).
- Scope refreshed: story now absorbs credential provisioning via AC4 (migration) and AC5 (operator script); previous carry-forward gap is RESOLVED.

---

## Exploration Log

### User model and credential schema
- **Where**: `backend/app/models/user.py:23-34`
- **What**: User ORM model with columns: id, name, email (unique), phone, role (Enum), status (Enum), created_at, updated_at. No password_hash field yet (added by AUTH-03). No must_reset_password flag yet (new for AC3/AC4/AC5).
- **Surprises**: None — expected per story's "Brownfield findings" section.
- **Open**: Auth-03 adds password_hash. AUTH-02 requires must_reset_password boolean flag (nullable or default False per AC4). Both must be added for this story to work.

### Provisioning mechanism: scripts infrastructure
- **Where**: `backend/app/` — NO `scripts/` directory exists today
- **What**: AC5 requires `python -m app.scripts.set_initial_password <email>` to be runnable. This requires a `scripts` package with a `__main__.py` entry point.
- **Surprises**: None — expected for a greenfield project; scripts are a new pattern.
- **Open**: Must create `backend/app/scripts/` directory with `__init__.py` and `set_initial_password.py` (or equivalent module + `__main__.py` entry point). Migration function (AC4) needs to be callable at startup or as a management command.

### Seed data: existing users without credentials
- **Where**: `backend/app/seed.py:10-29`
- **What**: 5 sample users seeded on first run, no passwords. AC4 requirement: these users must be provisioned with random unusable hash + must_reset_password=true.
- **Surprises**: None — expected per story Decision log (line 63).
- **Open**: Seed data itself is unchanged; provisioning happens post-seed via AC4 migration at startup.

### Service layer: provisioning logic placement
- **Where**: `backend/app/services/user_service.py:16-71`
- **What**: UserService orchestrates repository calls. No provisioning logic yet.
- **Surprises**: None — service layer is correct place for provisioning functions.
- **Open**: AC4 migration function belongs here (e.g., `provision_existing_users_with_random_password(db: Session) -> None`). AC5 script calls a provisioning service method (e.g., `set_user_initial_password(db: Session, email: str, plaintext_password: str) -> None`).

### Repository layer: get_by_email and update methods
- **Where**: `backend/app/repositories/user_repository.py:71-72` (get_by_email) and update method
- **What**: Repository has get_by_email(email: str) and update(id, ...) methods. Perfect for provisioning: lookup user by email, update password_hash and must_reset_password.
- **Surprises**: None — repository pattern is ready.
- **Open**: None — existing methods cover provisioning needs.

### API router structure and error handling
- **Where**: `backend/app/api/users.py:1-52` and `backend/app/main.py:56-79`
- **What**: API routers mounted under `/api/users` prefix. Centralized error handlers in main.py. No auth endpoints yet (per story, login endpoint is AC1).
- **Surprises**: None — security-baseline compliant.
- **Open**: Login endpoint will be added (AC1). Provisioning script is NOT exposed via HTTP (AC5 explicitly requires direct server access). This is correct per design.

### Testing: test structure and isolation
- **Where**: `backend/tests/test_users.py:1-60`
- **What**: Test suite uses FastAPI's TestClient against isolated in-memory SQLite. Fixture `_reset_db()` drops and recreates tables before each test.
- **Surprises**: None — test isolation pattern is good.
- **Open**: Story test strategy requires:
  - AC1-AC3: login endpoint tests (existing user with credential, invalid email, invalid password, no-credential user)
  - AC4: provisioning migration test — seed fixture users, call migration, assert random hashes + must_reset_password=true, assert re-run is no-op
  - AC5: provisioning script test — call script function, assert password_hash updated, assert must_reset_password cleared, assert plaintext never in logs/output

### Security baseline alignment: rate-limiting, logging, error handling
- **Where**: `.claude/rules/security-baseline.md` and story NFR section
- **What**: Story requires (1) rate-limit login 3/email/60min rolling with HTTP 429, (2) generic error for invalid email/password, (3) logging with opaque keys (user_id or hashed email, never plaintext), (4) no plaintext passwords in logs/responses.
- **Surprises**: None — baseline is clear.
- **Resolved**: rate-limiter scope is in-process (shared mutable dict keyed by hashed email, list of attempt timestamps) for v1. No Redis or other shared store exists in this stack today, and this is a single-server-deployment admin tool per the README's target platform — introducing a new external dependency for this alone is not justified. Caveat documented for PLAN.md: state is lost on server restart and does not survive horizontal scaling; a future story adds a shared-store backend if/when the deployment goes multi-server.

### Logging and observability for provisioning
- **Where**: `backend/app/main.py:24-25` (logger setup) and story NFR section (line 36)
- **What**: Story NFR: "log authentication attempts (success/failure) keyed by opaque `user_id` or hashed email only". Provisioning script (AC5) must never log plaintext password.
- **Surprises**: None — requirement is clear.
- **Resolved**: AC5 script prints a minimal confirmation ("Password set for user <email>") on success, an error message on failure, and never echoes the password. Exit status 0 on success, 1 on failure, so it's scriptable/checkable by whoever operates the deployment.

### Idempotence of AC4 migration
- **Where**: Story AC4 (line 28) — "running the migration a second time is a no-op for rows that already have a hash and `must_reset_password = false`"
- **What**: Migration logic must be idempotent: only provision rows that have no password_hash (or password_hash is null).
- **Surprises**: None — standard migration pattern.
- **Open**: Implementation detail: migration checks `WHERE password_hash IS NULL` before updating, ensuring re-runs are safe.

### Layering and architectural patterns for provisioning
- **Where**: `.claude/skills/fastapi-patterns/SKILL.md` and actual code
- **What**: Required layering: api → services → repositories → models. Provisioning logic belongs in services (business rules), not api or repositories.
- **Finding**: Provisioning functions (AC4, AC5) are service-layer functions called at startup (AC4) or via management script (AC5), not HTTP endpoints. Correct architecture.
- **Surprises**: None — patterns are clear.
- **Open**: None — no layering concerns.

---

## Pattern map

### Existing code to extend
- **`backend/app/models/user.py`** — AUTH-03 adds password_hash column. AUTH-02 requires new must_reset_password column (boolean, default False). Update model to add this flag.
- **`backend/app/repositories/user_repository.py`** — Existing get_by_email and update methods are sufficient. No new methods needed; provisioning calls existing update().
- **`backend/app/services/user_service.py`** — Add two new provisioning methods:
  - `provision_existing_users_with_random_password(db: Session) -> int` — called at startup (AC4), returns count of provisioned users.
  - `set_user_initial_password(db: Session, email: str, plaintext_password: str) -> None` — called by AC5 script, raises error if user not found.
  - Helper `_generate_unusable_hash() -> str` — creates random unusable hash (e.g., bcrypt.hash(os.urandom(32))).

### Existing patterns to follow
- **Service-layer business logic** — Provisioning belongs in services. Follow existing pattern: UserService methods receive Session, call repository methods.
- **Error handling** — AC5 script should validate email exists before attempting to set password. Raise a domain exception (UserNotFoundError) if email not found, caught by script's error handler (print to stderr, exit 1).
- **Repository calls** — Provisioning calls repository.get_by_email and repository.update.
- **Idempotence** — AC4 migration checks password_hash IS NULL before updating; re-runs are safe.

### New files to create
- **`backend/app/scripts/__init__.py`** — Empty init file to make scripts a package.
- **`backend/app/scripts/__main__.py`** — Entry point for `python -m app.scripts`. Parse CLI args, delegate to subcommand modules.
- **`backend/app/scripts/set_initial_password.py`** — Main script: takes the email as a command-line argument (`python -m app.scripts.set_initial_password <email>`) and reads the password interactively via a non-echoing stdin prompt (e.g. Python's `getpass`), never as a command-line argument — this avoids the password persisting in shell history or being visible via `ps`/process listing. Calls `UserService.set_user_initial_password`, handles errors, prints minimal success message.
  - Alternatively, could be in `__main__.py` directly for simplicity (minimal scripts needed).
  - **Resolved**: password input is interactive stdin (via `getpass`), not a command-line argument — this is the safer default and costs nothing extra to implement (`getpass` is stdlib), so there's no reason to accept the shell-history exposure of a command-line arg.
- **`backend/app/migrations.py`** (optional) — Or keep migration function directly in user_service.py. File organization choice; recommend keeping in user_service.py for simplicity (one place, small function).

### Shared code at risk
- **`backend/app/models/user.py`** (password_hash and must_reset_password columns) — Once added by AUTH-03 and AUTH-02, all code returning User objects must ensure these fields are handled correctly. LoginResponse excludes both; UserOut should exclude password_hash; must_reset_password is internal (never in response). Test: verify no HTTP response exposes password_hash or must_reset_password.
- **`backend/app/repositories/user_repository.py`** (update method) — Now called during provisioning (AC4, AC5). High visibility. No changes needed; existing method is generic enough.
- **`backend/app/seed.py`** — Seeded users remain unchanged (no password_hash added by seed). AC4 migration provisions them after seed runs. Correct approach.
- **Startup sequence** — AC4 migration must run AFTER seed data is initialized but BEFORE the app is ready to accept requests. Order: create_tables → seed_if_empty → provision_existing_users_with_random_password.

### Timing and deployment considerations
- **AC4 migration timing**: runs at server startup (in main.py, after create_all, after seed). No user requests can hit the login endpoint until migration completes (or the migration is fast enough to not block startup). Expected: <1s for 5 users; low risk.
- **AC5 script timing**: operator-invoked, not part of startup. Synchronous, blocks until complete. Expected: <1s per user; low risk.

---

## Risk register

| # | Dimension       | Severity | Description                                      | Mitigation                                  |
|---|-----------------|----------|--------------------------------------------------|---------------------------------------------|
| 1 | Domain          | **RESOLVED** | **[PREVIOUS CARRY-FORWARD GAP] Password-reset-on-first-login flow was unscoped.** This risk is now RESOLVED by AC4/AC5 scope addition. Existing/seeded users are provisioned with random unusable password_hash + must_reset_password=true (AC4), and operators can set real passwords via script (AC5). | Risk is CLOSED. AC4 and AC5 together provide a controlled provisioning path. Note: actual forced-password-reset flow (UI that requires password change on first login) is separate and may be future work, but the blocker for "existing users cannot log in" is now resolved by this story. |
| 2 | Domain          | **HIGH** | **Error message consistency (AC2 requirement)**: must return identical HTTP 401 + "Invalid email or password." for both invalid-email and invalid-password cases. If error messages differ by even one character, or if response times differ detectably, AC2 fails. Timing attack: if verify_credentials is too fast for non-existent emails, attacker can enumerate. | Mitigation: (a) Single error message constant, reused for both cases. (b) verify_credentials (from AUTH-03) must perform same work (hashing + compare) regardless of whether email exists, ensuring constant latency. (c) Test AC2 with two separate test cases — one for non-existent email, one for wrong password — and assert response status and body are byte-for-byte identical. Failure of any test case means AC2 fails. (d) Document in PLAN.md that response diffing is manual until automated test assertion is in place. |
| 3 | Integration     | **HIGH** | **Rate-limiting implementation: no existing rate-limiter in codebase.** Story requires 3 attempts/email/60min rolling, HTTP 429 on limit exceeded. **Resolved**: in-process counter for v1 (see Exploration Log resolution above). | Mitigation: (a) Implement in-process sliding-window counter in RateLimiter service class or dict in auth_service.py. Store as dict keyed by hashed email, with list of attempt timestamps. On each login attempt, prune timestamps older than 60min, count remaining, enforce limit. (b) At scale or multi-server deployment: migrate to Redis/Memcached (future story, not this one). (c) Document assumption in PLAN.md: "Rate-limiter state is in-process and lost on server restart. For distributed deployments, implement shared Redis storage." |
| 4 | Domain          | **HIGH** | **AC4 migration idempotence and startup safety**: Migration must be idempotent (re-run is no-op for already-provisioned rows). If migration is not idempotent, restarting the server could re-provision users, changing their password_hash and breaking their login. Alternatively, if migration fails mid-way (e.g., DB error on 3rd user), manual cleanup is needed. | Mitigation: (a) Migration logic checks `WHERE password_hash IS NULL` before updating, ensuring only credential-less rows are modified. (b) Test AC4: seed fixture with mixed rows (some with hash, some without), run migration, assert only null-hash rows are updated. (c) Re-run migration, assert it is a no-op (no rows updated). (d) Database transaction semantics: migration should succeed fully or fail fully (ACID); no partial updates. SQLAlchemy ORM + SQLite provides this by default. (e) If migration fails, startup aborts; operator must fix DB issue and restart. Document in PLAN.md. |
| 5 | Security        | **HIGH** | **AC5 script security: operator must supply plaintext password to set user's hash.** Risk: plaintext appears in shell history, process memory, or script output. Story explicitly prohibits logging/echoing plaintext, but implementation must enforce. **Resolved**: password is read via a non-echoing interactive stdin prompt (`getpass`), never a command-line argument, so it never lands in shell history or `ps` output. | Mitigation: (a) Script reads password via `getpass`-style stdin prompt (no echo). (b) Once password is read, hash it immediately and discard plaintext (Python garbage collection). (c) Never log plaintext; only log hashed value or user_id. (d) Script output: confirm success with message like "Password set for user <email>" (no password echoed). (e) Test AC5: capture logs + stdout, assert plaintext password never appears. |
| 6 | Domain          | **MED**      | **Service/API structure decision for login**: should login live in UserService.login() or a separate AuthService.login()? Extending UserService mixes auth + CRUD concerns; separate AuthService is cleaner but adds a file. **Resolved**: new `AuthService` (separate from `UserService`). | Mitigation: `AuthService` owns login, AC4 migration, and AC5 provisioning logic — auth concerns (login, provisioning, future password-reset/account-unlock work) stay separate from `UserService`'s CRUD concerns. `AuthService` calls `UserRepository` directly (no new repository needed) and AUTH-03's hash-verify interface. Document this choice in PLAN.md's mini-ADR. |
| 7 | Integration     | **MED**      | **Response model contract (AUTH-04 dependency)**: Login success must return a token/session shape per AUTH-04's story. AUTH-04 is still validated (not researched yet), so exact response shape may change. | Mitigation: (a) Define a placeholder LoginResponse schema (e.g., `token: str` for now). (b) Once AUTH-04 research completes, align response shape with AUTH-04's spec. (c) Test: AUTH-02 tests assert successful login returns a 200 response with expected fields (token, or session, per AUTH-04). (d) Mock/stub AUTH-04's token generation in AUTH-02 tests (e.g., return a dummy JWT). Do not hard-depend on AUTH-04's real implementation; stubs allow AUTH-02 to complete independently. |
| 8 | Compatibility   | **MED**      | **Schema and API contract changes**: UserCreate will gain a password field (from AUTH-03). Existing tests and client code (frontend, curl scripts) that don't send password will fail validation (422). | Mitigation: (a) Update all existing tests in test_users.py to include password in POST/PUT requests. (b) Update README.md API documentation to show password field in POST /api/users example. (c) Frontend (AUTH-01) will add password field once implemented. (d) Document in PLAN.md: "All user creation and update calls must include password field; password is required for POST, optional for PUT (per future password-change story, if any)." |
| 9 | Performance     | **MED**      | **Bcrypt latency cumulative effect**: AUTH-03 benchmarks bcrypt at p95 ≤ 300ms per hash. Login endpoint calls verify_credentials once. Combined with repository query (get_by_email), total response time could exceed story's p95 < 400ms budget. AC5 script calls hash twice (once for the randomly-generated provisioning hash, once for the operator-supplied password), could exceed <1s budget if not careful. | Mitigation: (a) For login (AC1-AC3): plan includes latency benchmark in test suite; if p95 > 400ms, investigate DB performance or reduce bcrypt work factor. (b) For AC5 script: hashing two passwords in sequence (~600ms total) is acceptable for a one-time operator action (not user-facing); document expected latency in PLAN.md. (c) AC4 migration: hashing N users at startup (~300ms per user for large datasets) could delay startup; for 5 seeded users, <2s total, acceptable. Document in PLAN.md. |
| 10 | Security        | **MED**      | **Operator access control for AC5 script**: Script requires direct server/database access. Risk: unauthorized operator or compromised server could set arbitrary passwords. | Mitigation: (a) Script is not exposed via HTTP, only invoked locally on the server. (b) Assume deployment process controls who has server access (standard DevOps practice). (c) No additional app-level access control (e.g., API key, authentication) is needed; the Unix file system permissions are the boundary. (d) Document in PLAN.md: "AC5 script requires direct server access; guard server access via standard deployment/IAM controls." |
| 11 | Domain          | **LOW**      | **AC4: What happens if bcrypt is unavailable at startup?** Provisioning migration calls AUTH-03's hashing function. If import fails, startup aborts. | Mitigation: Standard Python import error handling. If bcrypt import fails, startup exception is clear (bcrypt not installed). Operator must `pip install` bcrypt and restart. Document in PLAN.md and requirements.txt. |
| 12 | Security        | **LOW**      | **Log injection via email field in AC5 script**: If email is logged without sanitization in script output, attacker can inject newlines/control chars to fake log entries. | Mitigation: Security-baseline mandates never logging email. Enforce this in AC5 script: output message should not include user email, only a generic "Password set successfully" or similar. If must show email for confirmation, sanitize newlines/control chars. Test: add a security test case logging a malicious email and assert it is rejected or sanitized. |

---

## Score + verdict

### 5-dimensional rubric

| Dimension       | Weight | Pass criterion                                                              | Finding                                                                   | Score |
|---|---|---|---|---|
| Integration     | 25     | All upstream dependencies available; failure modes well understood          | AUTH-03's research is complete (verdict GO-WITH-CONDITIONS); hash-verify interface and must_reset_password column are defined. AC4 and AC5 are new code (not external dependencies). Failure modes: (1) verify_credentials fails → service catches, returns 401 (AC1-AC3); (2) rate-limit triggered → 429 (AC1-AC3); (3) migration error → startup fails, clear error (AC4); (4) script user-not-found → exit 1 with error message (AC5); (5) script password hash error → exit 1 with error message (AC5). All modes are well-understood. Integration with AUTH-03: via interface stub in tests; real integration post-ship. Integration with seed data: AC4 runs after seed, correct. **Carry-forward gap (risk #1) RESOLVED by AC4/AC5 scope inclusion.** | 85    |
| Compatibility   | 20     | Backward compat plan exists for each affected client/version                | **API contract change**: UserCreate now requires password field (new). UserOut excludes password_hash (unchanged). Login endpoint is new (no backward compat impact). **Model change**: must_reset_password column added to User model; password_hash added by AUTH-03. **Frontend change**: AUTH-01 will add password field to user-creation form. **Scripts**: AC4 migration runs at startup (transparent to users). AC5 script is operator-only (no user-facing impact). **Seed data**: unchanged; provisioned via AC4 after seed. **Mitigation**: update test fixtures and API docs. Document in PLAN.md. **No silent compatibility issue found.** | 85    |
| Domain          | 20     | Edge cases enumerated; no hidden invariants surfaced during scan            | **AC1 (valid login)**: user exists, password_hash matches, must_reset_password is false → return auth response, count unchanged. ✓ Clear. **AC2 (invalid login, generic error)**: (a) email not found OR (b) password wrong → both return 401 + "Invalid email or password." ✓ Clear. **AC3 (user with credentials but must_reset_password=true)**: reject login with same 401 as AC2. ✓ Clear. **AC4 (migration)**: credential-less rows get random hash + must_reset_password=true; re-run is no-op. ✓ Clear. **AC5 (script)**: given email + plaintext password, hash and update row, clear must_reset_password. ✓ Clear. **Invariants**: (1) user count unchanged after login. (2) password_hash never in response. (3) must_reset_password never in response. (4) same generic error for invalid-email and invalid-password. (5) AC4 is idempotent. (6) no plaintext password in logs or script output. All enumerated, no surprises. | 85    |
| Performance     | 15     | Story has explicit perf budget; estimated work fits within budget           | **NFR**: Login p95 < 400ms (story line 30). AC4 migration: <2s startup delay for 5 users (acceptable). AC5 script: <1.5s per user (acceptable for operator action). **Latency breakdown**: Login query + hash + rate-check ~350-410ms (as per previous AUTH-02 research). **Mitigation**: latency benchmark in test suite; if exceeded, adjust bcrypt work factor. **AC4/AC5 latency**: not user-facing; acceptable. **Implementation work**: ~300-400 lines total (AuthService/login endpoint + rate-limiter + AC4 function + AC5 script + schemas + tests). Fits within typical story scope. | 85    |
| Dependency      | 20     | All upstream stories complete; no blocking external work                    | **Upstream**: AUTH-03 research is complete, verdict GO-WITH-CONDITIONS. Hash-verify interface and must_reset_password column are locked. No hard blocker. **AC4/AC5 are in-scope for this story**, resolving the previous carry-forward gap. **Downstream**: AUTH-01 (frontend), AUTH-04 (token/session) are separate stories; all proceed in parallel. **No external stories blocking research completion.** | 90    |

**Total: (85×0.25 + 85×0.20 + 85×0.20 + 85×0.15 + 90×0.20) = 21.25 + 17 + 17 + 12.75 + 18 = 86/100**

### **Total: 86/100 → GO-WITH-CONDITIONS**

No single dimension scores <40. Integration (85) and Dependency (90) reflect the resolved carry-forward gap. Compatibility (85), Domain (85), and Performance (85) all have manageable mitigation plans. The score is higher than the previous 80/100 because the carry-forward gap (high-severity blocker) is now resolved within this story's scope.

### Conditions

The following conditions must be explicitly addressed in PLAN.md before implementation:

1. **AC4 Migration idempotence and startup integration (Domain, HIGH)**: PLAN.md must specify: (a) migration checks `WHERE password_hash IS NULL` before updating, (b) migration runs at startup after seed_if_empty (order: create_all → seed → provision), (c) test AC4 with fixture rows (some with hash, some without), assert only null-hash rows are updated, (d) re-run migration, assert no-op.

2. **AC5 Script security and password input method (Security, HIGH)**: PLAN.md must specify: (a) password input is an interactive, non-echoing stdin prompt (`getpass`) — resolved, not a command-line argument. (b) Script output: minimal confirmation ("Password set for user <email>"), no password echoed. (c) Test AC5: capture logs/stdout, assert plaintext password never appears.

3. **Error message consistency audit (Domain, AC2)**: PLAN.md must specify that test_auth.py includes a test case asserting response body and HTTP status are byte-for-byte identical for invalid-email and invalid-password cases. Code review must verify single error message constant is reused for both cases.

4. **Rate-limiter implementation scope (Integration, HIGH)**: PLAN.md must specify: (a) rate-limiter is an in-process sliding-window counter in a RateLimiter service class or dict — resolved for v1. (b) State is lost on server restart. (c) For distributed deployments, a follow-up story will add a shared-store (Redis) backend. Document the single-server-deployment assumption.

5. **Service/API structure decision (Domain)**: resolved — `AuthService` (separate from `UserService`) owns login, AC4 migration, and AC5 provisioning logic. Document this in PLAN.md's mini-ADR.

6. **Response model alignment with AUTH-04 (Integration)**: PLAN.md must specify that LoginResponse schema contains at least `{token: str}` (or session shape per AUTH-04, once researched). AUTH-02 will stub this in tests; real integration happens once AUTH-04 ships.

7. **Test fixtures and schema updates (Compatibility)**: PLAN.md must specify: (a) all existing tests in test_users.py are updated to include password field in POST/PUT payloads, (b) README.md API documentation is updated to show password in request example, (c) test_auth.py (new) covers AC1, AC2, AC3, AC4, AC5 with stub verify_credentials interface (per Test mapping, story lines 45-48).

8. **Latency benchmarks for AC4 and AC5 (Performance)**: PLAN.md must specify: (a) login endpoint test includes p95 latency measurement (expected ≤400ms), (b) AC4 migration duration documented (expected <2s for 5 users), (c) AC5 script duration documented (expected <1.5s per user, not user-facing so less critical).

9. **Logging strategy for failed attempts and provisioning (Security/Observability)**: PLAN.md must specify: (a) login endpoint logs failed attempts with opaque key (hashed email or user_id), never plaintext email, (b) AC5 script logs at minimal level (only success/failure confirmation), never plaintext password, (c) metric emitted: failed-login counter per email, (d) test case verifies password is not in logs or error responses.

10. **Scripts infrastructure and entry point (Domain)**: PLAN.md must specify that `backend/app/scripts/` is created with `__init__.py` and `set_initial_password.py` (or `__main__.py` entry point). Confirm `python -m app.scripts.set_initial_password` is the invocation method per story AC5 example (line 29).

---

## Synthesis

**AUTH-02 is feasible for planning and implementation with documented conditions; the scope refresh resolves the previous carry-forward gap.**

This story delivers a login endpoint for existing users with credential validation, rate-limiting, generic error handling (AC1-AC3), PLUS a controlled provisioning mechanism for existing/seeded users (AC4 migration + AC5 operator script). The codebase's clean service-layer architecture is well-suited for both auth and provisioning logic; no layering violations are needed. AUTH-03's hash-verify interface is locked (research complete with GO-WITH-CONDITIONS verdict), allowing AUTH-02's tests to stub the interface and achieve independent validation. The carry-forward gap from the previous research (password-reset-on-first-login flow unscoped) is RESOLVED by absorbing AC4 and AC5 into this story's scope: existing users are provisioned with random unusable password_hash + must_reset_password flag (AC4 at startup), and operators can set real passwords via a local script (AC5) without any HTTP endpoint exposure.

Key integration decisions, all now resolved: (1) rate-limiter is in-process for v1, with a documented caveat for distributed deployments, (2) AC4 migration idempotence and startup sequencing (create_all → seed → provision), (3) AC5 script reads the password via a non-echoing stdin prompt (`getpass`), never a command-line argument, (4) login/provisioning logic lives in a new `AuthService`, separate from `UserService`. Error message consistency (AC2) requires byte-for-byte identical responses for invalid-email and invalid-password. Scripts infrastructure (backend/app/scripts/) does not exist yet and must be created. Performance risk is manageable: bcrypt at p95 ≤300ms (AUTH-03) plus query + rate-limit check should fit within 400ms budget; latency benchmarks in tests will validate. All acceptance criteria are clear, testable, and implementable within existing architectural patterns. **The score (86/100 vs. previous 80/100) reflects resolution of the high-severity carry-forward gap; the verdict remains GO-WITH-CONDITIONS with the conditions above (now all resolved decisions, not open questions) to be carried into PLAN.md.**

---

## Clarifications

(none — all previously open items resolved: rate-limiter scope → in-process for v1; AC5 password input → interactive stdin via `getpass`; login/provisioning service structure → new `AuthService` separate from `UserService`. See Risk register and Conditions above for the resolved rationale.)
