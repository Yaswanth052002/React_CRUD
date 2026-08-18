# Code Review — feature/AUTH-04 (vs feature/AUTH-01)

- Date: 2026-08-18T16:00:00Z
- Mode: branch (feature/AUTH-04 @ a2ec706f, diffed against its actual parent `feature/AUTH-01` @ 58fe64c0, per `git diff feature/AUTH-01...feature/AUTH-04`)
- Files reviewed: 16 (source: `frontend/src/services/userApi.js`, `frontend/src/App.jsx`, `frontend/package.json`, `docs/config/project-commands.yaml`, `frontend/src/pages/__tests__/App.routing.test.jsx`; new tests: `frontend/src/services/__tests__/userApi.auth.test.js`, `frontend/src/__tests__/App.auth.test.jsx`, `frontend/src/__tests__/App.auth.perf.test.jsx`; docs/state: `PLAN.md`, `FLAGS.md`, `state.json`, `docs/state/features.json`, two `VALIDATION-*.md`, `docs/test-cases/AUTH-04.json`, `docs/activity/2026-08.jsonl`; lockfile: `frontend/package-lock.json`)
- Verdict: **PASS**

## Re-run context: prior findings verified resolved

This is a re-run against the final committed diff (a2ec706f) after 3 findings from the prior review were reportedly fixed. All 3 are confirmed genuinely resolved in this diff:

1. **`docker-compose.yml` stray whitespace edit** — confirmed reverted. `git diff feature/AUTH-01...feature/AUTH-04 -- docker-compose.yml` returns empty; the file does not appear anywhere in the 23-file changed-file list for this branch.
2. **`handleLoginSuccess` dropped `token` parameter** — confirmed fixed. `frontend/src/App.jsx` now reads `function handleLoginSuccess(_token) { setIsAuthenticated(true); setSessionExpiredMessage(null); }`, matching PLAN.md §3's `handleLoginSuccess(token: string) -> void` contract shape (parameter present, intentionally unused per the accompanying comment explaining `setAuthToken` already persisted it before this callback runs).
3. **`state.json` AF-04 summary out of sync with FLAGS.md** — confirmed fixed. `docs/features/AUTH-04/state.json`'s AF-04 entry now reads "TC-02/TC-10/TC-14 can only be partially verified today ... TC-14 disclosure gap corrected in round-2 fix per VALIDATION-20260818-1420.md", matching `FLAGS.md`'s AF-04 correction which names TC-02/TC-10/TC-14 together.

## Executive summary

AUTH-04 adds the token-storage/interceptor infrastructure exactly as scoped: `userApi.js` gains `getStoredToken`/`setAuthToken`/`clearAuthToken`/`registerUnauthorizedHandler` plus a request/response interceptor pair with a working 401 dedup guard (`hadToken` checked before `clearAuthToken()`, handler invoked only if a token was present — satisfies ADR-1 and research risk #1), and `App.jsx` gains `isAuthenticated`/`sessionExpiredMessage` state plus a mount-time `jwt-decode` expiry check, with the render tree still unconditionally mounted (no Sidebar/Header/LoginScreen gating) — correctly deferring that switch to AUTH-05 per PLAN.md's declared scope boundary. Layering is respected throughout: `App.jsx` never touches `localStorage` or `axios` directly, only calling into `userApi.js`; `userApi.js` remains the sole HTTP/storage entry point per `react-patterns` and `CLAUDE.md`. All three prior-review findings (stray `docker-compose.yml` edit, dropped `token` param, state/FLAGS drift) are confirmed resolved above. No new CRITICAL, HIGH, or MEDIUM findings surfaced in this fresh six-dimension pass. `npm run test` was re-run independently for this review: 49/49 tests pass across 8 files, including the new `userApi.auth.test.js` (8 tests), `App.auth.test.jsx` (7 tests), and `App.auth.perf.test.jsx` (1 test, p95 < 100ms). No SAST-pattern grep hits (eval/innerHTML/hardcoded secrets/PII-in-logs) in the diff. Only the opaque JWT is ever persisted (TC-12 verifies `localStorage.length === 1`, no password-shaped values). File scope is clean: every changed file maps to a PLAN.md F-01..F-07 row or an expected mirrored doc/state/lockfile artifact — no out-of-scope edits found.

🟢 strengths: all 3 prior findings genuinely fixed, clean scope discipline, working dedup guard, honest partial-coverage disclosure, no security regressions, full green test run independently verified.
⚠️ warnings: none blocking; two pre-existing LOW observations carried forward (see below), already deemed acceptable in the prior review and unchanged in nature.
🛑 blockers: none.

## Findings summary

| Severity | Count | Category distribution                                  |
|----------|-------|----------------------------------------------------------|
| CRITICAL |   0   | —                                                          |
| HIGH     |   0   | —                                                          |
| MEDIUM   |   0   | —                                                          |
| LOW      |   1   | module-structure (1, carried forward, deemed acceptable) |

## Detailed findings

### LOW

#### F-1 — module-structure: `handleLoginSuccess`/`handleLogout` are currently dead code in `App.jsx`
- Category: Module structure & boundaries
- Path: `frontend/src/App.jsx:89-100`
- Source: `.claude/rules/reusability-baseline.md` ("single responsibility... public APIs are intentional"); PLAN.md §3 explicitly labels both as "forward-reference"
- Description: Both handlers are defined but never referenced anywhere in `App.jsx` (no `LoginScreen`/logout button exists yet to call them), so they are currently unreachable code. This is explicitly called out and justified in PLAN.md as intentional forward-references for AUTH-05/AUTH-07 to consume — carried forward unchanged from the prior review, which already deemed this acceptable. Re-flagged at LOW only because an eventual linter (currently absent, tracked as pre-existing gap AF-02) could flag these as unused.
- Suggested fix: No action required now; revisit only if/when ESLint is introduced and flags these, or if AUTH-05/AUTH-07 land with a different signature than PLAN.md documents.

## What went well

- Scope discipline: `App.jsx`'s render tree (`Sidebar`/`Header`/`Dashboard`/`Users`) remains unconditionally mounted, exactly as PLAN.md requires — no premature Login-vs-protected-view gating was added, and no file outside the PLAN's F-01..F-07 list was touched (docker-compose.yml confirmed absent from the diff).
- The 401 dedup guard is correctly implemented and verified by `TC-09` (a second in-flight 401 after the token is already cleared does not re-invoke the handler).
- `localStorage` error handling never silently swallows in a way that hides bugs: `getStoredToken`/`clearAuthToken` fail safe (return null / no-op) as documented, and `setAuthToken` re-throws a readable `Error` rather than the raw `DOMException`.
- `handleLoginSuccess`'s signature now matches PLAN.md's documented `(token: string) -> void` contract, closing the drift the prior review flagged, with a clear comment explaining why the parameter is unused today.
- TC-02/TC-10/TC-14 remain honestly disclosed as PARTIAL in both `FLAGS.md` and `docs/test-cases/AUTH-04.json`; `state.json`'s AF-04 summary now matches `FLAGS.md` word-for-word on which TCs are affected, closing the second prior-review drift.
- Independently re-run test suite: 49/49 passing (`userApi.auth.test.js`, `App.auth.test.jsx`, `App.auth.perf.test.jsx`, plus all pre-existing suites, including the updated `App.routing.test.jsx` mock additions for the new `userApi.js` exports).
- No plaintext credentials are ever handled — only the opaque JWT is persisted (TC-12).
- ADR-3's supersession claim remains uncontested: `docs/features/AUTH-01/state.json` has no `impl` field and no `LoginScreen`/`setAuthToken` code exists on disk, so there is no actual conflict today.

## Recommendation

**PASS.** No CRITICAL, HIGH, or MEDIUM findings. All 3 findings from the prior review round are confirmed genuinely fixed in this commit (a2ec706f), not just re-labeled. One pre-existing LOW observation (dead-code forward-references) is carried forward unchanged and remains non-blocking, as PLAN.md explicitly documents the forward-reference intent for AUTH-05/AUTH-07. Proceed to `/arh-security-review`.
