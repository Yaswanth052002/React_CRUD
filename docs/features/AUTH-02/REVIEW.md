# Code Review — feature/AUTH-02

- Date: 2026-08-18T00:00:00Z
- Mode: branch (feature/AUTH-02, diffed against `main`; working-tree implementation changes isolated from the prior AUTH-epic docs-only commit `58fe64c0`)
- Files reviewed: 16 (`backend/app/models/user.py`, `backend/app/services/auth_service.py`, `backend/app/schemas/auth.py`, `backend/app/api/auth.py`, `backend/app/repositories/user_repository.py`, `backend/app/scripts/__init__.py`, `backend/app/scripts/set_initial_password.py`, `backend/app/main.py`, `backend/requirements.txt`, `backend/tests/conftest.py`, `backend/tests/test_auth.py`, `backend/tests/test_provisioning.py`, `backend/tests/test_users.py`, `backend/tests/perf/conftest.py`, `backend/tests/perf/test_login_perf.py`, `backend/pytest.ini`, `README.md`, `docs/config/project-commands.yaml`)
- Verdict: **PASS**

## Executive summary

AUTH-02 adds a new `AuthService` module (login, AC4 startup provisioning, AC5 operator
credential script) that stays strictly within `api → service → repository → models` layering,
implements a shared generic-401 code path for AC2/AC3 with timing-equivalent verification, an
in-process sliding-window rate limiter (ADR-2), and — per the ADR-5 amendment — real HS256 JWT
signing via `PyJWT` reading `JWT_SECRET_KEY` through `os.getenv` with a generic 500 on failure.
The AF-01 `conftest.py` fixture extraction and the AF-03 `http_exception_handler` header fix are
both surgical, one-purpose changes that match their FLAGS.md descriptions exactly, and
`test_users.py`'s test bodies are untouched. File scope matches `PLAN.md` §2's file list exactly
(F-01..F-14); README changes land only in the sections PLAN's T-10 scoped (API table, §11a,
troubleshooting row) with no unrelated edits. No layering violations, no plaintext
password/hash logging, no CLI-argument password input, and no extra JWT claims beyond
`sub`/`exp` were found. Three medium-severity issues (an audit-log ordering inaccuracy on
token-issuance failure, a JWT-TTL assertion gap versus PLAN's own test-strategy commitment, and
the rate limiter's email-only keying versus the stricter security-baseline default) and one
low-severity perf-harness design nit keep this from a clean pass, but nothing here blocks merge.

🟢 strengths: layering discipline, generic-error/timing-safety implementation, AC5 script's
`getpass`-only input and log hygiene, surgical AF-01/AF-03 fixes, JWT payload minimalism (ADR-5).
⚠️ warnings: audit-log ordering, JWT TTL test gap, rate-limiter keying vs. baseline default.
🛑 blockers: none.

## Findings summary

| Severity | Count | Category distribution                                              |
|----------|-------|--------------------------------------------------------------------|
| CRITICAL |   0   | —                                                                    |
| HIGH     |   0   | —                                                                    |
| MEDIUM   |   3   | safety-security (2), testability (1)                                |
| LOW      |   1   | testability (1)                                                     |

## Detailed findings

### MEDIUM

#### F-1 — safety-security: "Successful login" is logged before token issuance can still fail
- Category: safety-security
- Path: `backend/app/services/auth_service.py:67-69`
- Source: `docs/features/AUTH-02/REQUIREMENTS.md` § Non-functional requirements → Observability ("log successful/failed authentication attempts... per the security NFR"); `.claude/rules/security-baseline.md` § Core (audit-relevant events logged with accurate outcome, per `security-review-checklist` § Logs and errors)
- Description: `login()` calls `logger.info("Successful login", ...)` immediately after `_verify_credentials` passes, then calls `_issue_token(user.email)`, which can itself raise `HTTPException(500)` (e.g. `JWT_SECRET_KEY` unset, per T-14's own test). In that failure path the audit log already recorded a "successful login" for a request that ultimately 500s and returns no usable token — an inaccurate audit trail entry an operator/SIEM could rely on to believe a session was established.
- Suggested fix: move the `logger.info("Successful login", ...)` call to after `_issue_token` returns successfully (or log it once around the `LoginResponse` construction), so the audit record only reflects a request that actually completed.

#### F-2 — testability: JWT `exp` claim value is never asserted against the 60-minute TTL
- Category: testability
- Path: `backend/tests/test_auth.py:166-179`
- Source: `docs/features/AUTH-02/PLAN.md` § 7 Test Strategy, ADR-5 (amendment) row ("asserts... `exp` ≈ now+60min... within a small tolerance window") and T-13's own Notes column
- Description: `test_login_returns_a_real_signed_jwt_with_expected_claims` only asserts `"exp" in decoded`, never that the value is approximately `now + 60 minutes`. A regression that hardcodes `exp` to e.g. 1 second, or drops `_JWT_TTL_MINUTES` to a wrong value, would still pass this test — the PLAN's own test-strategy commitment for T-13 is not fully met.
- Suggested fix: add an assertion comparing `decoded["exp"]` to `time.time() + 60*60`, with a small tolerance window (e.g. ±60s), matching the PLAN's stated intent.

#### F-3 — safety-security: login rate limiter is keyed by hashed email only, not email+IP
- Category: safety-security
- Path: `backend/app/services/auth_service.py:35-37,137-146`
- Source: `.claude/rules/security-baseline.md` § Auth tokens, SSRF, parsing, rate-limit, CSRF ("Rate limit: auth endpoints throttled per (hashed) email AND IP, default 3/email/60min rolling")
- Description: ADR-2 in `PLAN.md` and `REQUIREMENTS.md` FR-6 both scope the v1 rate limiter to hashed-email-only, citing single-server deployment and no shared cache. This is a real, if already-reviewed and accepted, gap against the baseline rule's explicit "AND IP" requirement: an attacker rotating target emails from one IP is unconstrained by this limiter, and a legitimate user behind a shared/NAT'd IP is not protected from a different account's lockout. This was surfaced and accepted during planning (GO-WITH-CONDITIONS C-4), so it is not a new violation introduced by this diff, but it should be visible in review output as an explicit rule deviation rather than silently matching the baseline's full text.
- Suggested fix: no change required to merge this story (the ADR-2 trade-off stands as approved); track IP-dimension rate-limiting as a follow-up story once a shared cache/store is introduced, and reference ADR-2 explicitly wherever the baseline rule is cited going forward so future reviewers don't re-discover this as a fresh gap.

### LOW

#### F-4 — testability: sustained-load perf test's alternating valid/invalid requests trip its own rate limiter
- Category: testability
- Path: `backend/tests/perf/test_login_perf.py:44-58,79-90`
- Source: `docs/features/AUTH-02/PLAN.md` § 7 Test Strategy (TC-12: "p95 < 400ms @ 50 RPS / 60s sustained-load test")
- Description: `test_login_perf_sustained_load_p95_under_400ms` sends 3,000 requests to the same email, alternating valid/invalid passwords. After the first 3 invalid attempts, `AuthService`'s rate limiter (ADR-2) returns `429` for every subsequent request on that email — including the alternating "valid" ones — well before the 60s window elapses. The p95 assertion then measures mostly fast-fail `429` responses rather than the real login/hash/DB-query path the NFR is meant to benchmark.
- Suggested fix: use distinct emails per request (or per small batch) in the sustained-load run, or provision a set of emails and never send invalid attempts, so the rate limiter does not short-circuit the majority of the measured workload.

## What went well

- Layering is fully respected: `AuthService` only calls `UserRepository` methods (`get_by_email`, `get_without_credential`, `update`); no raw SQLAlchemy queries appear outside `user_repository.py`.
- The AC2/AC3 generic-error path uses a single shared constant and a constant-work `_verify_credentials` (dummy hash comparison for unknown users) — verified byte-for-byte by `test_login_wrong_password_matches_unknown_email_response_byte_for_byte` and `test_login_rejected_for_must_reset_password_user_same_generic_error`.
- AC5's `set_initial_password.py` takes only `<email>` positionally, reads the password via `getpass.getpass()`, and never logs/echoes it — confirmed by `test_script_never_logs_or_prints_the_plaintext_password`.
- JWT payload is exactly `{sub, exp}` per ADR-5, with a generic 500 (no raw `jwt`/`os.environ` text) on a missing `JWT_SECRET_KEY`, matching T-14's test.
- AF-01's `conftest.py` extraction and AF-03's `http_exception_handler` header fix are both minimal, correctly scoped, single-purpose changes — `test_users.py` test bodies are untouched, and the header fix is a one-line `getattr(exc, "headers", None)` pass-through with no other behavior change.
- File-scope discipline is exact: every touched/created file maps 1:1 to `PLAN.md` §2's F-01..F-14, and README edits are confined to the sections T-10 scoped.

## Recommendation

**PASS.** No critical or high-severity issues; the three medium findings (audit-log ordering,
JWT TTL assertion gap, and the already-accepted email-only rate-limiter keying) are quality/
follow-up items, not blockers. Address F-1 and F-2 opportunistically before AUTH-03/AUTH-04
build on this endpoint's token/audit behavior, and carry F-3 forward as a tracked follow-up
story once a shared rate-limit store exists.

---

## Addendum — 2026-08-18T22:30:00Z — GET /api/auth/me epic gap fix

- Target: working tree vs `feature/AUTH` HEAD `eb946e72` (uncommitted fix found during a
  full-epic post-merge regression validation sweep; the gap and root cause are documented in
  `docs/features/AUTH-06/VALIDATION-20260818-1601.md` § `LIVE-01`).
- Mode: current (working tree).
- Files reviewed: 4 code files (`backend/app/api/auth.py`, `backend/app/schemas/auth.py`,
  `backend/app/services/auth_service.py`, `backend/tests/test_auth.py`).
  `docs/activity/2026-08.jsonl`, `docs/test-cases/AUTH-05.json`, `docs/test-cases/AUTH-06.json`,
  and the untracked `docs/features/AUTH-05/VALIDATION-*.md` /
  `docs/features/AUTH-06/VALIDATION-*.md` / `docs/sessions/` / `tmp/` paths also carry
  uncommitted changes in the working tree, but these are bookkeeping/telemetry/validation
  artefacts from the same interrupted sweep, not code under review here — no findings raised
  against them, consistent with AUTH-03's REGRESSION-01 addendum precedent above.
- Verdict: **PASS WITH WARNINGS**

### Bug and fix

No PLAN.md across AUTH-02, AUTH-04, or AUTH-06 ever implemented `GET /api/auth/me`: AUTH-02's
file table (F-01..F-14) only builds `POST /api/auth/login` plus provisioning; AUTH-04 is
frontend-only; AUTH-06's `REQUIREMENTS.md` explicitly placed the backend route "Out" of its own
scope and attributed it to "AUTH-04/AUTH-02's implementation." The endpoint fell into a genuine
cross-plan gap, masked because `Settings.test.jsx` mocks `userApi.getCurrentUser()` at the HTTP
boundary and `backend/tests/test_auth.py` had no `/me` coverage. The fix adds
`AuthService.get_current_user_from_token(token)` (decodes/verifies the bearer JWT via
`os.getenv("JWT_SECRET_KEY")`, loads the user by the `sub` claim through
`UserRepository.get_by_email`), a `CurrentUserResponse {name, email}` schema, and a
`GET /api/auth/me` route in `api/auth.py` using an `HTTPBearer`-backed `get_current_user`
dependency.

### 1. Layering (module structure & boundaries)

- `api/auth.py`'s new `get_current_user` dependency and `me` route call only
  `AuthService(db).get_current_user_from_token(...)` — the service layer. The service calls
  only `self.repo.get_by_email(email)` — the repository layer. No router-level SQL, no
  raw `Session` query in `api/` or `services/`. Matches `fastapi-patterns` § Layering &
  dependency rules and `README.md` §2's `api → service → repository → models` diagram exactly.
- No finding.

### 2. Response shape (safety-security / contract)

- `CurrentUserResponse(name=current_user.name, email=current_user.email)` is constructed with
  explicit named fields, not `CurrentUserResponse.model_validate(current_user)` or any
  `**dict`/wildcard pattern — `id`, `role`, `status`, `phone`, and `password_hash` are not
  reachable through this endpoint even if the `User` ORM model gains fields later. Matches
  `docs/features/AUTH-06/REQUIREMENTS.md` C-1's locked `{name: string, email: string}` contract
  exactly (also independently restated in AUTH-06's `PLAN.md`/`REVIEW.md`).
- No finding.

### 3. Security — generic error discipline (safety-security)

- `get_current_user_from_token` raises the identical `HTTPException(401, "Could not validate
  credentials.")` object for every internal failure mode (missing `JWT_SECRET_KEY`, invalid/
  expired JWT, missing `sub` claim, unknown user) — confirmed by
  `test_me_with_an_invalid_token_returns_generic_401` asserting the exact body. No PII (email,
  token value) is logged anywhere in the new code path — confirmed by inspection, no `log`/
  `print` calls were added. This matches AUTH-02's existing `login()` generic-401 pattern
  (`.claude/rules/security-baseline.md` § Core, "errors shown to end users contain no stack
  traces or internal identifiers").
- **Finding (MEDIUM, safety-security): the no-token case is NOT covered by the same generic
  contract.** `fastapi.security.HTTPBearer()` is instantiated with its default
  `auto_error=True`, so a request with **no** `Authorization` header never reaches
  `get_current_user_from_token` at all — Starlette/FastAPI short-circuits with `403
  {"detail": "Not authenticated"}`, a different status code and a different message than the
  malformed/expired/unknown-user case's `401 {"detail": "Could not validate credentials."}`.
  `test_me_without_a_token_is_rejected` was written to accept either
  (`assert resp.status_code in (401, 403)`), which normalizes the test to the inconsistency
  rather than the code to a single contract — masking a real behavioral difference an
  API consumer (or a future authz middleware keyed on status code) could observe. This is a
  narrower version of the same "distinguishable auth failure" concern
  `.claude/rules/security-baseline.md` guards against for ownership checks
  ("Return HTTP 404, never 403... 403 confirms existence") — here it isn't an existence leak,
  but it is an avoidable, undocumented two-shape error contract for what the code's own
  docstring calls a "single generic 401."
  - Path: `backend/app/api/auth.py:12` (`_bearer_scheme = HTTPBearer()`),
    `backend/tests/test_auth.py:221-223`.
  - Suggested fix: construct `HTTPBearer(auto_error=False)` and check `credentials is None`
    inside `get_current_user`, raising the same `HTTPException(401, "Could not validate
    credentials.")` used by the service layer — normalizing the missing-header case to the
    identical 401 contract used everywhere else in this file — then tighten the test to assert
    `== 401` and the exact body, not `in (401, 403)`.

### 4. Testability

- The three new tests exercise the real HTTP path end-to-end (`client.post(.../login)` then
  `client.get(.../me)` with the real returned token) rather than calling
  `AuthService` methods directly or mocking JWT decode — this is exactly the class of coverage
  whose absence caused the original regression (mocked-only tests never caught a missing route).
  Confirmed locally via the stated `pytest` 60/60 pass count (up from 57 — 3 new tests, matching
  T-count here).
- Minor gap tied to Finding #3 above: `test_me_without_a_token_is_rejected` asserting `in (401,
  403)` is a weakened assertion rather than a precise one; folded into the MEDIUM finding above
  rather than double-counted.

### 5. Documentation trail (adr-violation / traceability)

- This fix is not attributable to a single task row in any PLAN.md — it closes a genuine
  cross-story gap between AUTH-02, AUTH-04, and AUTH-06 (none of their PLANs list this file
  action), not a violation of a written ADR. AUTH-02 is the correct home for this addendum: it
  already owns the file-table slots for all four files this fix touches
  (`backend/app/api/auth.py` = F-03, `backend/app/schemas/auth.py` = F-02,
  `backend/app/services/auth_service.py` = F-01, `backend/tests/test_auth.py` = F-06).
  AUTH-06 is the consumer that surfaced the gap via its live-contract validation
  (`docs/features/AUTH-06/VALIDATION-20260818-1601.md` `LIVE-01`) and should cross-link here
  rather than duplicate this review.
- **Finding (LOW, informational): no regression-tagged test case was registered.**
  `backend/tests/test_auth.py`'s new tests are labeled
  `regression-AUTH-06-TC-01` in a comment, but neither `docs/test-cases/AUTH-02.json` nor
  `docs/test-cases/AUTH-06.json` gained a corresponding `regression-AUTH-06-TC-01`-tagged entry
  in this diff (both files' diffs are timestamp-only churn from re-running existing TCs).
  Recommend adding the regression-tagged TC entry to `docs/test-cases/AUTH-02.json` (this is now
  an AUTH-02-owned route) per the epic's regression-tag protocol, and adding an
  `impl_carry_forward_fixes` entry to `docs/features/AUTH-02/state.json` mirroring the
  AUTH-03/REGRESSION-01 precedent, for discoverability without opening this review file. Not
  blocking.

### Findings summary (addendum)

| Severity | Count | Category distribution |
|----------|-------|------------------------|
| CRITICAL | 0 | — |
| HIGH | 0 | — |
| MEDIUM | 1 | safety-security (1) — inconsistent no-token (403) vs invalid-token (401) error contract |
| LOW | 1 | adr-violation/traceability (1) — informational, missing regression-tagged TC registry entry |

### Recommendation (addendum)

**PASS WITH WARNINGS.** Layering, response-shape discipline, and generic-error handling for
malformed/expired/unknown-user tokens are all correct and match this epic's established
patterns; the fix is scoped exactly to the missing route and its direct dependencies with no
adjacent-code drift. The one MEDIUM finding (missing-header 403 vs. every-other-failure 401) is
a real, fixable inconsistency but not a security leak — fix it by setting
`HTTPBearer(auto_error=False)` and normalizing to 401 before merging to `main`, or explicitly
accept it as a documented v1 limitation (mirroring how AUTH-02's F-3 rate-limiter gap was
accepted) if there's a reason to keep FastAPI's default behavior. The LOW finding is
informational only. No blocker to proceeding to `/arh-security-review`.
