# Code Review — AUTH-05 (uncommitted working tree, feature/AUTH @ 03c50389)

- Date: 2026-08-18T00:00:00Z
- Mode: story (AUTH-05, uncommitted working-tree diff against feature/AUTH HEAD 03c50389)
- Files reviewed: 7 (2 modified source/test, 1 new test, 4 docs/state)
- Verdict: PASS

## Executive summary

This diff adds the `isAuthenticated`-gated conditional render branch to `App.jsx`, wires
`LoginScreen` in exactly the shape PLAN.md §3 specifies, extends `handleLoginSuccess` to reset
`activeView` to `"dashboard"` unconditionally, and adds/repairs the two test files the PLAN
scopes (`App.routing.test.jsx` mock audit, new `App.authGate.test.jsx` covering TC-01..TC-11).
The change is a faithful, line-for-line implementation of PLAN.md §2/§3/§5 with no drift: no
`authError` prop, no null/loading tri-state, no changes to `Sidebar.jsx`/`Header.jsx`, and no
new state. Docs/state artifacts (`state.json`, `FLAGS.md`, evidence logs, `VALIDATION-*.md`,
`test-cases/AUTH-05.json` last-run enrichment) are all harness bookkeeping produced by the
already-completed implementation/validation run (11/11 PASS) and fall outside the six
architectural dimensions.

🟢 Render branch matches PLAN.md §3 exactly; `handleLoginSuccess` correctly adds the
`setActiveView("dashboard")` call per C-5; no ADR-worthy decision needed or introduced;
Sidebar/Header untouched.
⚠️ None blocking.
🛑 None.

## Findings summary

| Severity | Count | Category distribution |
|----------|-------|------------------------|
| CRITICAL |   0   | — |
| HIGH     |   0   | — |
| MEDIUM   |   0   | — |
| LOW      |   0   | — |

No findings raised in any of the six dimensions, scope-creep, or adr-violation.

## Detailed findings

None.

## Focus-area verification (per task brief)

1. **ADR drift** — PLAN.md § Architecture Decisions explicitly states no ADR-worthy decision is
   required for this story (a one-level conditional-render extension of an already-decided
   pattern). Confirmed: the diff introduces no new abstraction, no router, no new state
   primitive, and no mini-ADR was needed or written. No `docs/adr/*` file was touched. **No ADR
   violation.**

2. **Render branch shape** — `frontend/src/App.jsx` new code:
   ```jsx
   if (!isAuthenticated) {
     return (
       <LoginScreen
         onLoginSuccess={handleLoginSuccess}
         sessionExpiredMessage={sessionExpiredMessage}
       />
     );
   }
   ```
   This is exactly the branch PLAN.md §3 specifies: `isAuthenticated === false` → exactly one
   element (`LoginScreen` with only the two locked props), nothing else in the tree;
   `isAuthenticated === true` falls through unchanged to the existing
   `Sidebar`+`Header`+`activeView` tree. Grepped the whole diff — no `authError` prop, no
   `null`/loading tri-state (`isAuthenticated` is read as a plain boolean via `!isAuthenticated`,
   consistent with AUTH-04's contract, condition C-1). **Confirmed correct.**

3. **`handleLoginSuccess`** — now calls `setIsAuthenticated(true)` (pre-existing, AUTH-04),
   `setSessionExpiredMessage(null)` (pre-existing, AUTH-04), and the newly added
   `setActiveView("dashboard")`, unconditionally, matching AUTH-05-FR-2/condition C-5 and
   verified independently by `App.authGate.test.jsx` TC-04/TC-05. **Confirmed correct.**

4. **Sidebar.jsx / Header.jsx** — `git diff --name-only` shows neither file touched. PLAN.md
   explicitly calls this out ("No changes to `Sidebar.jsx` or `Header.jsx`... both are omitted
   from the tree (not CSS-hidden)"), and `App.authGate.test.jsx` TC-01/TC-02/TC-10 assert
   `.sidebar`/`.topbar`/`.nav-item` are absent from the DOM (not merely hidden) when
   unauthenticated. **Confirmed — no unrelated component changes.**

5. **Scope-creep check** — PLAN.md §2 declares exactly three files in scope: F-01
   (`frontend/src/App.jsx`), F-02 (`frontend/src/pages/__tests__/App.routing.test.jsx`), F-03
   (`frontend/src/__tests__/App.authGate.test.jsx`, new). The working-tree diff touches:
   - `frontend/src/App.jsx` — F-01, in scope.
   - `frontend/src/pages/__tests__/App.routing.test.jsx` — F-02, in scope (mock-only change:
     `getStoredToken: vi.fn(() => MOCK_TOKEN)`, matching the C-3 audit-fix task exactly — no
     assertion logic changed).
   - `frontend/src/__tests__/App.authGate.test.jsx` (new) — F-03, in scope.
   - `docs/features/AUTH-05/state.json`, `docs/features/AUTH-05/FLAGS.md` (new),
     `docs/features/AUTH-05/evidence/*` (new), `docs/features/AUTH-05/VALIDATION-20260818-1130.md`
     (new), `docs/test-cases/AUTH-05.json` (`last_run`/`budget` enrichment only) — these are the
     mandated per-feature state/evidence/validation artefacts written by
     `/arh-implement`/`/arh-validate-feature`, not production or test code; they are outside the
     PLAN's File-and-Module table by design (that table only lists source/test deliverables) and
     do not constitute a refactor of adjacent code. No content in them alters application
     behavior.
   - No other file (component, service, backend, config) is touched. `docs/activity/2026-08.jsonl`
     changes, `docs/sessions/`, and `tmp/*` are session/harness-internal logs outside git's
     tracked story scope and outside this review's target diff.
   **No scope-creep finding.**

## Rule/pattern cross-check

- `react-patterns` — conditional-render pattern matches the existing `activeView`-switch idiom
  (no new abstraction); `LoginScreen` import and usage follow the `pages/` → `components/`
  dependency direction; no direct `axios` calls introduced.
- `surgical-changes` — every changed line traces to T-01/T-02/T-03; the `App.routing.test.jsx`
  diff is a minimal, targeted mock-value change (comment + one line) with no adjacent reformatting.
- `security-baseline` / `accessibility-baseline` — TC-08 (no `authError` prop) and TC-10/TC-11
  (no protected DOM/network surface when unauthenticated; nav-item focus/tab-order) directly
  test the security- and accessibility-relevant contracts introduced by this story; no
  regressions found.
- `performance-baseline` — TC-09 asserts no additional network round-trip is introduced by the
  auth-gate branch itself, satisfying the "no unbounded fan-out reads" concern for this change.

## What went well

- PLAN.md's own render-branch spec, module-hierarchy diagram, and condition table (C-1..C-6) are
  all traceable 1:1 into the actual diff — an unusually low-drift implementation.
- The inline code comment at the conditional documents the locked contracts so future edits
  don't reintroduce `authError` or a loading tri-state (T-01's Notes column requirement, honored).
- Test coverage is complete: all 11 declared TCs implemented and independently verified PASS
  (per `VALIDATION-20260818-1130.md`), including the C-3 regression fix for the pre-existing
  `App.routing.test.jsx`.

## Recommendation

PASS. No CRITICAL/HIGH/MEDIUM/LOW findings, no ADR violations, no scope-creep. Proceed to
`/arh-security-review`.

---

# Addendum — Post-security-fix diff (2026-08-18, uncommitted working tree @ e28cf953/HEAD 20c29a58)

- Date: 2026-08-18T18:00:00Z
- Mode: current (uncommitted working-tree diff against `git diff HEAD` / branch feature/AUTH)
- Trigger: `docs/features/AUTH-05/SECURITY-20260818.md` F-001 (Critical) — `LoginScreen.jsx`
  still called the AUTH-01 mock `userAuthService.js` instead of AUTH-02's real
  `POST /api/auth/login`. User elected to fix immediately rather than defer.
- Files reviewed: 5 source/test files + 3 state/docs bookkeeping files
- Verdict: **PASS**

## Executive summary

This is a fix-loop round on top of an already-reviewed/validated AUTH-05 implementation. The
diff adds `login(email, password)` to `frontend/src/services/userApi.js`, repoints
`LoginScreen.jsx`'s import to it, deletes the mock `userAuthService.js`, and updates the two
test files that mocked the deleted module. It is a minimal, surgical fix precisely scoped to
the Critical security finding. No other application code, layering, or contract is touched.

🟢 `login()` matches the file's established try/catch/`normalizeError` pattern exactly.
🟢 `LoginScreen.jsx` diff is a one-line import change; `handleSubmit` untouched.
🟢 No orphaned `userAuthService` references anywhere in `frontend/src` (grep-verified).
⚠️ None blocking.
🛑 None.

## Findings summary

| Severity | Count | Category distribution |
|----------|-------|------------------------|
| CRITICAL |   0   | — |
| HIGH     |   0   | — |
| MEDIUM   |   0   | — |
| LOW      |   0   | — |

## Focus-area verification

1. **`userApi.js` pattern consistency** — `login()` (lines 165-172) is placed among the other
   exported functions and follows the identical shape used by `getUsers`/`getUser`/
   `createUser`/`updateUser`/`deleteUser`: `try { const res = await client.<verb>(...); return
   res.data; } catch (err) { throw normalizeError(err); }`. No special-casing (no bespoke error
   handling, no bypass of `normalizeError`, no direct axios usage outside `client`). **Confirmed
   consistent — no `design-patterns` finding.**

2. **`LoginScreen.jsx` import-only change** — diff is exactly:
   ```diff
   -import { login } from "../services/userAuthService";
   -import { setAuthToken } from "../services/userApi";
   +import { login, setAuthToken } from "../services/userApi";
   ```
   `handleSubmit`, the `authError`/`isSubmitting` state, and the prop contract passed to
   `LoginForm` (`onSubmit`, `isSubmitting`, `serverError={authError}`) are byte-for-byte
   unchanged. No `authError` prop leakage reintroduced (the generic `GENERIC_AUTH_ERROR` message
   is still the only string surfaced to `LoginForm`, per `security-baseline` no-leak requirement
   and the story's existing TC-04/TC-07 contracts). **Confirmed — surgical, in line with
   `.claude/rules/surgical-changes.md`.**

3. **No orphaned `userAuthService` references** — `grep -rn "userAuthService"
   frontend/src` returns no matches after the deletion. **Confirmed clean.**

4. **Scope-creep check** — diff (`git diff HEAD --stat`) touches exactly:
   `frontend/src/services/userApi.js` (+9), `frontend/src/components/LoginScreen.jsx` (import
   line), `frontend/src/services/userAuthService.js` (deleted, -21),
   `frontend/src/components/__tests__/LoginForm.test.jsx` (mock target renamed),
   `frontend/src/components/__tests__/LoginScreen.test.jsx` (mock target renamed) — exactly the
   five files the fix was scoped to. The remaining changed files
   (`docs/features/AUTH-01/state.json` carry-forward-item resolution,
   `docs/test-cases/AUTH-05.json` re-run timestamps from the independent re-validation,
   `docs/activity/2026-08.jsonl` harness activity log) are state/evidence bookkeeping mandated
   by the SDLC state-write contract, not production or test code, and do not alter application
   behavior. **No scope-creep finding.**

5. **Security-baseline check (`.claude/rules/security-baseline.md`)** — grepped the new `login`
   function and its call site for logging of `email`/`password`/`token`: no `console.log`,
   `print`, or `log.*` call appears in `login()` or in the deleted `userAuthService.js`'s
   replacement path. The response-interceptor's existing `console.log("auth_session_expired")`
   (pre-existing, AUTH-04, unrelated to this diff) logs only an opaque event string, no PII. The
   credential values (`email`, `password`) flow directly into `client.post(...)` as the request
   body and are never captured into a local var that's logged. **No PII-in-logs finding.**

## Rule/pattern cross-check

- `react-patterns` — `services/` remains the sole HTTP-call layer; `login` is exported the same
  way as every sibling function; `components/` still doesn't import axios directly.
- `security-baseline` — no credential logging introduced; error surfaced to the user remains the
  generic, non-leaking `GENERIC_AUTH_ERROR` string (unchanged from before this fix).
- `surgical-changes` — every changed line traces to the F-001 fix; no adjacent reformatting or
  refactor bundled in.

## What went well

- The fix closes the Critical finding with the smallest possible diff — no new abstractions, no
  incidental refactor of `userApi.js`'s existing functions.
- Independent re-validation (`docs/features/AUTH-05/VALIDATION-20260818-1730.md`, 11/11 PASS,
  including a live curl check of `POST /api/auth/login` returning a generic 401) was already
  performed before this review, so the review's own findings and the runtime evidence agree.

## Recommendation

PASS. No CRITICAL/HIGH/MEDIUM/LOW findings, no ADR violations, no scope-creep. The Critical
security finding F-001 is resolved. Proceed to `/arh-security-review` to close out the
re-review of this specific fix (confirm F-001 marked resolved and no new findings introduced).
