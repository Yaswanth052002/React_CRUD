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
