# Code Review — feature/AUTH-04 (vs feature/AUTH-01)

- Date: 2026-08-18T15:00:00Z
- Mode: branch (feature/AUTH-04, parent feature/AUTH-01 — working-tree diff vs `git diff HEAD`, since AUTH-04 has no commits of its own beyond the shared AUTH-01 ancestor)
- Files reviewed: 11 (7 changed, 3 new untracked test/doc files inspected, 1 docker-compose.yml stray diff)
- Verdict: **PASS WITH WARNINGS**

## Executive summary

AUTH-04 adds the token-storage/interceptor infrastructure exactly as scoped: `userApi.js` gains `getStoredToken`/`setAuthToken`/`clearAuthToken`/`registerUnauthorizedHandler` plus a request/response interceptor pair with a working 401 dedup guard, and `App.jsx` gains `isAuthenticated`/`sessionExpiredMessage` state and a mount-time expiry check — with the render tree still unconditionally mounted (no Sidebar/Header/LoginScreen gating), correctly deferring that to AUTH-05. The two-round validation history is genuine: round 1 correctly caught an undisclosed TC-14 gap and a false PLAN.md coverage claim, and round 2's fix (FLAGS.md correction, PLAN.md §7 correction, two new proxy tests) is itself surgical, non-tautological, and verified passing (49/49 tests, confirmed independently in this review). ADR-3's supersession claim is uncontested — AUTH-01 has no `impl` field and no `LoginScreen`/`setAuthToken` code exists on disk yet. No plaintext credentials are handled; only the opaque JWT is persisted (TC-12 verifies this). The `vi.mock("react", ...)` useState-wrapper trick in `App.auth.test.jsx` is sound and does not leak into other test files (verified by full suite run).

Warnings: an unrelated whitespace-only edit to `docker-compose.yml` is out of scope for this story's declared file list; `handleLoginSuccess`'s implemented signature drops the `token` parameter documented in PLAN.md §3/REQUIREMENTS.md FR-3 (currently harmless since the function is unused/forward-referenced, but is a drift risk for AUTH-05); and `state.json`'s AF-04 flag record was not updated to mention TC-14 the way `FLAGS.md`'s AF-04 was, creating a minor inconsistency between the two flag records for the same finding.

🟢 strengths: honest partial-coverage disclosure, clean scope boundary, working dedup guard, no security regressions, all tests green.
⚠️ warnings: one stray out-of-scope file edit, one signature drift from PLAN, one flag-record inconsistency.
🛑 blockers: none.

## Findings summary

| Severity | Count | Category distribution                                  |
|----------|-------|----------------------------------------------------------|
| CRITICAL |   0   | —                                                          |
| HIGH     |   0   | —                                                          |
| MEDIUM   |   2   | scope-creep (1), integration (1)                           |
| LOW      |   2   | testability (1), scope-creep (1)                            |

## Detailed findings

### MEDIUM

#### F-1 — scope-creep: unrelated whitespace edit to `docker-compose.yml`
- Category: scope-creep
- Path: `docker-compose.yml:16`
- Source: PLAN.md § 2 File and Module Plan (F-01..F-07 — `docker-compose.yml` is not listed); `.claude/rules/surgical-changes.md`
- Description: The diff adds a trailing blank line with trailing whitespace after the `depends_on: - backend` block. This file is not in AUTH-04's declared file list and the change has no functional purpose (it doesn't add a service, port, or env var — Config drift dimensions C2/C3 in PLAN.md correctly report "no docker-compose.yml entry introduced by this story", which this stray edit technically contradicts).
- Suggested fix: Revert the `docker-compose.yml` change; it is unrelated to any AUTH-04 task. If it was an accidental artifact of editor auto-save, discard it before commit.

#### F-2 — integration: `handleLoginSuccess` signature drops the documented `token` parameter
- Category: Integration points
- Path: `frontend/src/App.jsx:89`
- Source: PLAN.md § 3 Module Hierarchy (`handleLoginSuccess(token: string) -> void`); REQUIREMENTS.md FR-3 ("On successful login (`LoginScreen`'s `onLoginSuccess(token)` callback)...")
- Description: The implemented `function handleLoginSuccess()` takes no parameters, whereas PLAN.md and REQUIREMENTS.md both specify `handleLoginSuccess(token)`. The PLAN's own rationale for the parameter is informational only in this story (LoginScreen already calls `setAuthToken` before invoking the callback, so AUTH-04 doesn't need the token value today), so this is not a functional bug in AUTH-04's current scope — but it is a spec/implementation drift that AUTH-05 will need to reconcile when wiring `onLoginSuccess={handleLoginSuccess}` to `LoginScreen`.
- Suggested fix: Either update PLAN.md §3 to reflect the parameterless signature actually shipped, or add the unused `token` parameter now (`function handleLoginSuccess(token) { ... }`, ignoring `token` since `setAuthToken` is called by the caller) so the documented contract and the code match exactly, avoiding a silent signature mismatch AUTH-05 has to discover.

### LOW

#### F-3 — testability: `state.json` AF-04 flag summary not updated in the round-1 fix
- Category: Testability / documentation consistency
- Path: `docs/features/AUTH-04/state.json` (`agent_flags[3]` / AF-04 `summary` field)
- Source: FLAGS.md AF-04 "Correction (2026-08-18, round-1 fix ...)" note (which explicitly adds TC-14 to the disclosure)
- Description: `FLAGS.md`'s AF-04 entry was correctly amended to name TC-14 alongside TC-02/TC-10. The mirrored `agent_flags[].summary` field in `state.json` for the same `flag_id: "AF-04"` still reads "TC-02/TC-10 can only be partially verified today" with no mention of TC-14, so a reader of `state.json` alone (without cross-referencing `FLAGS.md`) would miss that TC-14 is part of the same disclosed gap.
- Suggested fix: Update `state.json`'s AF-04 `summary`/`rationale` text to mention TC-14 alongside TC-02/TC-10, matching `FLAGS.md`'s corrected wording, so both flag records stay in sync.

#### F-4 — scope-creep (minor): `handleLoginSuccess`/`handleLogout` are currently dead code in `App.jsx`
- Category: scope-creep / module structure
- Path: `frontend/src/App.jsx:89-100`
- Source: `.claude/rules/reusability-baseline.md` ("single responsibility... public APIs are intentional"); PLAN.md §3 explicitly labels both as "forward-reference"
- Description: Both handlers are defined but never referenced anywhere in `App.jsx` (no `LoginScreen`/logout button exists yet to call them), so they are currently unreachable code. This is explicitly called out and justified in PLAN.md as intentional forward-references for AUTH-05/AUTH-07 to consume, so it is not a genuine violation — flagging only because unreferenced exported-from-nowhere functions can trip a future linter once one is configured (AF-02 notes no linter exists yet).
- Suggested fix: No action required now; if/when ESLint is introduced (tracked as a pre-existing gap per AF-02), add an eslint-disable or confirm AUTH-05/AUTH-07 land soon enough that this isn't flagged as unused in CI.

## What went well

- Scope discipline: `App.jsx`'s render tree (`Sidebar`/`Header`/`Dashboard`/`Users`) is unconditionally mounted, exactly as PLAN.md requires — no premature Login-vs-protected-view gating was added.
- The 401 dedup guard (`hadToken` checked before `clearAuthToken()`, handler invoked only if a token was present) correctly satisfies ADR-1's rationale and is verified by `TC-09`.
- `localStorage` error handling never silently swallows in a way that hides bugs: `getStoredToken`/`clearAuthToken` fail safe (return null / no-op) as documented, and `setAuthToken` re-throws a readable `Error` rather than swallowing the original `DOMException`.
- TC-02/TC-10/TC-14 are honestly disclosed as PARTIAL in both `FLAGS.md` and `docs/test-cases/AUTH-04.json`, with the round-1→round-2 validation trail showing the actual defect (undisclosed gap + false PLAN.md claim) was fixed, not just re-labeled.
- The `vi.mock("react", ...)`/`vi.hoisted` useState-wrapper in `App.auth.test.jsx` is scoped to that file only (Vitest's default per-file module isolation) and does not affect `App.routing.test.jsx` or any other suite — confirmed by a full local run (49/49 tests passing across 8 files).
- ADR-3's supersession claim is currently uncontested: `docs/features/AUTH-01/state.json` has no `impl` field and no `LoginScreen`/`setAuthToken` code exists on disk, so there is no actual conflict today.
- No plaintext credentials are ever handled — only the opaque JWT is persisted (verified by TC-12: `localStorage.length === 1`, no `password`-matching values).

## Recommendation

**PASS WITH WARNINGS.** No CRITICAL or HIGH findings; two MEDIUM findings (an out-of-scope `docker-compose.yml` whitespace edit, and a `handleLoginSuccess` signature drift from PLAN.md/REQUIREMENTS.md) should be addressed before merge but do not block. Revert the `docker-compose.yml` change and reconcile the `handleLoginSuccess` signature (either add the `token` param or update PLAN.md) as follow-ups; the `state.json` AF-04 summary drift (LOW) can be fixed in the same pass. Proceed to `/arh-security-review`.
