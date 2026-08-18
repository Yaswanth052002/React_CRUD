# Code Review — feature/AUTH-03 (vs feature/AUTH-02)

- Date: 2026-08-18T06:20:00Z
- Mode: branch (feature/AUTH-03 diffed against parent feature/AUTH-02; both branches share the
  same merge-base commit, so this diff is uncommitted working-tree changes scoped to AUTH-03 only)
- Files reviewed: 13 tracked modifications + 2 new test files (15 total)
- Verdict: PASS WITH WARNINGS

## Executive summary

This story swaps AUTH-02's stdlib `pbkdf2_hmac` placeholder for a real bcrypt implementation
(via `passlib[bcrypt]`, work factor 12) behind the same `AuthService` method names, wires the new
`hash_password` into `UserService.create_user`, adds a required `password` field to `UserCreate`,
and backfills test coverage (unique salts, verify success/fail, WARN-log hygiene, placeholder-hash
rejection, p95 latency benchmark, response-schema audit). The diff is tightly scoped: the login
endpoint, JWT issuance, and rate-limiting logic in `auth_service.py` are untouched, and no schema
or migration changes were introduced — exactly per the PLAN.md Sequencing note and Scope/Out
section. All 47 backend tests pass locally against the pinned dependency set. One MEDIUM finding
(a test importing a private module-level symbol) and one LOW finding (a slightly imprecise
README sentence) keep this from a clean PASS; neither blocks merge.

🟢 strengths: exact scope discipline (no login/JWT/rate-limit/schema touch), correct bcrypt work
factor 12, clean `UnknownHashError` handling, no plaintext logging, minimal/well-justified
`bcrypt==4.0.1` pin, full test-fixture fallout handled without weakening assertions.
⚠️ warnings: test white-boxes a private `_pwd_context` symbol; one README line slightly overstates
prior behavior.
🛑 blockers: none.

## Findings summary

| Severity | Count | Category distribution                                    |
|----------|-------|------------------------------------------------------------|
| CRITICAL |   0   | —                                                            |
| HIGH     |   0   | —                                                            |
| MEDIUM   |   1   | testability (1)                                              |
| LOW      |   2   | reusability (1), docs (1)                                    |

## Detailed findings

### MEDIUM

#### F-1 — testability: test imports a private module-level symbol
- Category: testability
- Path: `backend/tests/test_password_hashing.py:16` (`from app.services.auth_service import AuthService, PasswordHashingError, _pwd_context`)
- Source: `.claude/rules/reusability-baseline.md` ("Public APIs are intentional. Implementation
  details stay private.")
- Description: `_pwd_context` is a module-private (underscore-prefixed) `CryptContext` instance.
  `test_hash_password_failure_logs_warn_with_no_password_material_and_raises_generic_error` and
  `test_verify_credentials_failure_logs_warn_with_user_id_only_and_returns_false` monkeypatch its
  `hash`/`verify` methods directly to force a library exception (TC-05). This is a reasonable
  white-box technique for forcing an otherwise-hard-to-trigger failure path, but it couples the
  test to an implementation detail rather than a public seam, so any future refactor of the
  module-level context (e.g. moving it inside the class, renaming it) breaks the test even though
  the public `hash_password`/`verify_credentials` contract hasn't changed.
- Suggested fix: not blocking for this story — acceptable given `passlib` doesn't offer a public
  way to force an internal failure. Consider (in a future story) exposing a constructor-injectable
  `CryptContext` on `AuthService` so tests can substitute a fake without reaching into a private
  module global.

### LOW

#### F-2 — docs: README line slightly overstates AUTH-02's prior behavior
- Category: component-architecture (docs accuracy)
- Path: `README.md:194` (§11a)
- Source: `.claude/rules/surgical-changes.md` scope discipline read together with the general
  "docs must be truthful" review concern; not a rule violation, a precision nit.
- Description: The edited sentence reads "Every user row created before this feature has no
  credential and cannot log in until an operator sets one (the CRUD API now requires a `password`
  on every new user — see §10)." The parenthetical is accurate for AUTH-03's state, but the
  leading clause ("before this feature") is now ambiguous about which feature it refers to
  (AUTH-02's provisioning migration vs. AUTH-03's password requirement) since it sits in an AUTH-02
  section describing AUTH-02 behavior that AUTH-03 partially supersedes.
- Suggested fix: optional wording tweak in a future doc pass — not worth a standalone commit for
  this story since it doesn't misstate any current API contract.

#### F-3 — reusability: `_hash_password` alias adds a second name for the same operation
- Category: design-patterns / reusability
- Path: `backend/app/services/auth_service.py:130-133`
- Source: `.claude/rules/reusability-baseline.md` ("Single responsibility per module/function")
- Description: `_hash_password` is kept purely as a private alias delegating to the new public
  `hash_password`, solely so `provision_existing_users_with_random_password` and
  `set_user_initial_password` (AC4/AC5, both AUTH-02-owned call sites) don't need their call sites
  touched. This is intentional and explicitly justified in the docstring and PLAN.md ADR-1
  ("same method signature, same call sites") — flagged as LOW only because it leaves two names for
  one operation permanently in the module rather than as a transitional shim.
- Suggested fix: no action needed for this story (matches ADR-1's explicit "in place" replacement
  design); if AUTH-02's call sites are ever touched by a future story, collapse the alias to a
  single call to `hash_password`.

## What went well

- Scope discipline is excellent: `git diff` confirms no changes to the login endpoint (`login()`
  in `auth_service.py`), JWT issuance (`_issue_token`), rate limiting (`_check_rate_limit`/
  `_record_failed_attempt`), or any model/migration file — exactly matching PLAN.md's Sequencing
  note and the story's declared Out-of-scope list.
- Bcrypt work factor 12 is set once via a single `CryptContext(bcrypt__rounds=12)` and consumed by
  both `hash_password` and `verify_credentials` — no drift between hash and verify configuration.
- `UnknownHashError` (AUTH-02's `salt$hex_digest` placeholder format) is caught explicitly and
  returns `False` without raising or leaking which failure mode occurred — directly covered by
  `test_placeholder_hash_row_fails_verification_without_raising` (TC-12).
- No plaintext password ever reaches a log call or exception message; `hash_password`'s and
  `verify_credentials`'s `except Exception` branches log only a static message or `user_id`,
  matching `.claude/rules/security-baseline.md`'s "never log tokens, passwords... at any log
  level."
- `bcrypt==4.0.1` pin (FLAGS.md AF-01) is a minimal, correctly root-caused two-line addition to
  `requirements.txt`, not a broader dependency bump — verified locally that the pinned venv
  resolves `bcrypt==4.0.1` / `passlib==1.7.4` and all 47 backend tests pass.
- Test-fixture fallout (`test_provisioning.py`, `test_login_perf.py`, `test_auth.py`) is correctly
  scoped: `test_provisioning.py`'s two AC4 tests now simulate a credential-less row via direct ORM
  mutation post-creation (since the API path can no longer produce one), which preserves the
  original assertion intent (migration provisions credential-less rows, is idempotent) rather than
  weakening it.
- Backend layering (`api → service → repository → models`) is unchanged: `UserService.create_user`
  calls `AuthService(self.db).hash_password(...)` (service-to-service, same layer) and
  `self.repo.create(data)` (service-to-repository) — no router bypass, no direct SQL from
  `services/`, consistent with `fastapi-patterns` SKILL.md.
- `UserCreate.password` validation (min length 8, required) lives in `schemas/user.py` per
  `fastapi-patterns`; `UserUpdate` correctly does not inherit the new field, so updates don't
  require re-submitting a password.

## Recommendation

PASS WITH WARNINGS. No CRITICAL or HIGH findings; one MEDIUM (test white-boxing a private
symbol, functionally justified, not a defect) keeps this out of a clean PASS. Merge is safe;
address F-1 opportunistically in a future story if `AuthService`'s hashing internals are
refactored, and consider the F-2 wording tweak in the next doc pass. No action required before
proceeding to `/arh-security-review`.

---

## Addendum — 2026-08-18T21:52:00Z — REGRESSION-01 hotfix (create→login)

- Target: working tree vs `feature/AUTH` HEAD `6ab0e53e` (uncommitted fix found during the
  full-epic regression validation sweep of AUTH-03; recorded as `AUTH-03-TC-13` /
  `REGRESSION-01` in `docs/features/AUTH-03/VALIDATION-20260818-2140.md` and
  `docs/test-cases/AUTH-03.json`).
- Mode: current (working tree).
- Files reviewed: 2 code files (`backend/app/services/user_service.py`,
  `backend/tests/test_users.py`); `docs/activity/2026-08.jsonl` and
  `docs/test-cases/AUTH-0{1,2,3}.json` also carry uncommitted changes but are bookkeeping/
  regression-tag artefacts from the same validation sweep, not part of this code review's
  scope — no findings raised against them.
- Verdict: **PASS**

### Bug and fix

`create_user()` correctly bcrypt-hashed the supplied password but never cleared
`must_reset_password` (model default `True`, intended for the AC4 credential-less-migration
path — `provision_existing_users_with_random_password` in `auth_service.py`). Because
`AuthService._verify_credentials` short-circuits to `False` whenever
`user.must_reset_password` is `True` (`auth_service.py:153`), every freshly created user was
permanently unable to log in, even with the exact password just supplied at creation — a
create→login regression, not a test artifact. The fix adds one line,
`data["must_reset_password"] = False`, in `user_service.py:58`, inside the `try` block
immediately after `data["password_hash"] = ...`, so a hashing failure still raises before this
line executes (unaffected).

### 1. Scope discipline (surgical-changes)

- Confirmed via `git diff` that only `create_user()` in `user_service.py` changed (one added
  line) and only `test_users.py` gained a new test function. No edit touches
  `auth_service.py`, `set_initial_password.py`, or any router/model file.
- `auth_service.py`'s three call sites that already pair `password_hash` with
  `must_reset_password` in a single write (`provision_existing_users_with_random_password:88`,
  `set_user_initial_password:104`) are untouched — this fix makes `create_user` follow the
  same established pairing pattern already used everywhere else a real password is set,
  rather than inventing a new shape (dimension 2, design patterns: compliant).
- No finding. Scope is surgical per `.claude/rules/surgical-changes.md`.

### 2. Test quality (testability)

- `test_newly_created_user_can_log_in_with_creation_password` calls the real
  `POST /api/users` and `POST /api/auth/login` endpoints via the FastAPI `TestClient` (`client`
  fixture already used by every other test in the file) — not an internal
  `UserService`/`AuthService` method call — so it genuinely exercises the create→login flow
  end-to-end through the real router/service/repository layers.
- Confirmed locally: `pytest tests/test_users.py tests/test_auth.py -q` → 31 passed, including
  the existing negative-case tests (wrong-password → 401, unprovisioned/`must_reset_password`
  account → 401) — the fix and its test do not weaken or touch that coverage.
- No finding.

### 3. Security (safety-and-security / adr-violation)

- Setting `must_reset_password = False` in this code path is gated on a real plaintext
  password having just been hashed successfully in the same `try` block (`hash_password`
  raises `PasswordHashingError` — caught and converted to a 500 — before this line would ever
  run on a failure). No check is bypassed: this only marks an account as provisioned when a
  real credential now exists, mirroring `auth_service.py`'s own `set_user_initial_password`
  semantics. The credential-less-migration path (`provision_existing_users_with_random_password`,
  which sets `must_reset_password=True` for rows with no password) is untouched and remains
  correct.
- No finding.

### 4. Documentation trail (adr-violation / traceability)

- This fix is not attributable to a single task row in AUTH-03's `PLAN.md` File and Module
  Plan (F-03 describes `create_user` wiring to `hash_password` but never mentions
  `must_reset_password`) — it is a gap in that already-approved plan surfaced by
  cross-story (AUTH-02/AUTH-03) interaction during regression, not a violation of any written
  ADR. Per this epic's established precedent (AUTH-03's own `state.json.impl_carry_forward_fixes`
  for the `bcrypt==4.0.1` pin, and the `agent_flags` entries), root-cause fixes found during
  implementation/validation are recorded as flags/carry-forward entries rather than requiring a
  PLAN.md rewrite.
- This has already been done for this fix: `docs/features/AUTH-03/VALIDATION-20260818-2140.md`
  documents it as `REGRESSION-01`, and `docs/test-cases/AUTH-03.json` now carries
  `AUTH-03-TC-13` tagged `regression-REGRESSION-01` with `requirement_id: AUTH-03-FR-1` and is
  listed in that requirement's `coverage_audit.covered_by`. No further documentation action is
  required; **finding: LOW (informational)** — recommend also adding a one-line
  `impl_carry_forward_fixes` entry to `docs/features/AUTH-03/state.json` (parallel to the
  existing three entries there) so the fix is discoverable from state without opening the
  validation report, but this is not blocking.

### Findings summary (addendum)

| Severity | Count | Category distribution |
|----------|-------|------------------------|
| CRITICAL | 0 | — |
| HIGH | 0 | — |
| MEDIUM | 0 | — |
| LOW | 1 | adr-violation/traceability (1) — informational, state.json cross-reference only |

### Recommendation (addendum)

**PASS.** The fix is surgical, root-cause-correct, consistent with the existing
`password_hash`/`must_reset_password` pairing pattern used elsewhere in `auth_service.py`, does
not weaken negative-case coverage, and introduces no security regression. Already
documented as `REGRESSION-01` in this epic's validation trail; optionally mirror that into
`state.json.impl_carry_forward_fixes` for discoverability. No action required before
proceeding to `/arh-security-review`.
