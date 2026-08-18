# Code Review — feature/AUTH (working tree vs 339e338c)

- Date: 2026-08-18T00:00:00Z
- Mode: story (AUTH-07)
- Files reviewed: 5 (AUTH-07-owned) — `frontend/src/services/userApi.js` (logout() slice only), `frontend/src/services/__tests__/userApi.logout.test.js`, `README.md` §11, `frontend/src/__tests__/App.logoutFocus.test.jsx`, `frontend/src/components/LoginForm.jsx`
- Verdict: PASS

## Executive summary

This diff delivers AUTH-07's logout capability: a synchronous, no-arg `logout()` export in
`userApi.js` that calls `clearAuthToken()` exactly once and logs a PII-free `auth:logout`
observability event, backed by a thorough `userApi.logout.test.js` covering every TC in
`docs/test-cases/AUTH-07.json` (TC-01..TC-10). A fix-loop closed a real coverage gap for TC-11
(keyboard-operability + post-logout focus) with a new `App.logoutFocus.test.jsx` that mounts the
real `App`/`LoginScreen`/`LoginForm`/`Settings` tree (mocking only `userApi.js`, per
`react-patterns`) and a minimal `useRef`+`useEffect` focus-on-mount addition to
`LoginForm.jsx` — a file that belongs to AUTH-01's PLAN.md file table, not AUTH-07's. That
cross-story touch is fully accounted for: AUTH-01's PLAN.md carries a dated Addendum describing
the change and its owning test file, and AUTH-07's PLAN.md § 6 Cross-Feature Dependency Notes
cross-references it — the same amendment pattern the repo already established for AUTH-01's own
earlier TC-05 fix-loop. Working tree also contains AUTH-06 and AUTH-05-adjacent changes
(`App.jsx`, `Settings.jsx`, `getCurrentUser()` in `userApi.js`) layered in per the stated build
order; those are AUTH-06's file-table responsibility (`docs/features/AUTH-06/PLAN.md` F-01/F-03)
and are out of scope for this AUTH-07-specific review — noted for completeness, not assessed here.

No CRITICAL or HIGH findings. No ADR violations, no scope-creep within AUTH-07's own review
scope once the PLAN-amendment path is accounted for.

🟢 strengths: exact contract match for `logout()` (signature, call order, payload shape), no PII in
the observability log, a genuinely end-to-end TC-11 test (not a mock-of-a-mock), adequate
cross-PLAN traceability for the one out-of-file-table touch.
⚠️ warnings: none blocking.
🛑 blockers: none.

## Findings summary

| Severity | Count | Category distribution |
|----------|-------|------------------------|
| CRITICAL |   0   | — |
| HIGH     |   0   | — |
| MEDIUM   |   0   | — |
| LOW      |   1   | testability (1) |

## Detailed findings

### LOW

#### F-1 — testability: TC-09's "handler not called" assertion relies on unreviewed AUTH-04 internals
- Category: testability
- Path: `frontend/src/services/__tests__/userApi.logout.test.js:182,197`
- Source: `PLAN.md` T-03 (race-condition coverage), `fastapi/react-patterns` n/a (frontend-only)
- Description: TC-09 asserts `registerUnauthorizedHandler`'s callback is *not* invoked when a delayed 401 arrives after `logout()` already cleared the token, relying on a "dedup guard" (`hadToken` check) inside AUTH-04's response interceptor in `userApi.js`. That guard's implementation is outside this diff (pre-existing AUTH-04 code, out of AUTH-07's file-table scope) and outside this review's own diff boundary, so the assertion's correctness depends on an assumption about sibling-story code this review did not re-verify line-by-line.
- Suggested fix: no action required for AUTH-07 sign-off (the behavior is AUTH-04's already-shipped, already-tested contract, and the test's inline comment documents the reliance clearly) — flag as a note for any future AUTH-04 regression review to confirm the guard's continued presence.

## What went well

- `logout()` matches its locked contract exactly: synchronous, no args, no Promise, no HTTP call, `clearAuthToken()` called exactly once, `console.log("auth:logout", { timestamp })` with no other keys — verified directly against `userApi.js:58-69` and `userApi.logout.test.js` TC-02/TC-03/TC-06.
- `LoginForm.jsx`'s focus-on-mount addition is minimal and safe: one `useRef`, one `useEffect` with an empty dependency array, no prop/state contract change, and no interaction with the existing `handleBlur`/`validate` logic.
- `App.logoutFocus.test.jsx` is a genuine test: it mounts the real `App`, `LoginScreen`, `LoginForm`, and `Settings` (AUTH-06's real component, not a mock) and only mocks the `userApi.js` service boundary — consistent with `react-patterns`' "components never call the service layer directly, tests mock the boundary" idiom. It is not asserting against its own mocks; the focus assertion (`document.activeElement === emailInput`) is measured against real, rendered DOM.
- The cross-story `LoginForm.jsx` touch is properly PLAN-amended on both sides (AUTH-01's Addendum + AUTH-07's Cross-Feature Dependency Notes cross-reference), matching this repo's established precedent from AUTH-01's own TC-05 fix-loop — adequate for wiring/traceability sign-off.
- README §11 addition is a one-line, accurately-scoped documentation update matching REQUIREMENTS.md's Documentation requirements.
- No PII/token values appear anywhere in the diff's logging statements (grep against `.claude/skills/security-review-checklist` SAST patterns found zero hits).

## Recommendation

PASS. No findings block merge. The one LOW finding is informational only. The out-of-file-table
`LoginForm.jsx` edit is legitimate cross-story scope (validation-driven, PLAN-amended on both the
donor and receiving PLAN.md, consistent with established repo precedent) and is adequate for
review sign-off on the wiring/traceability dimension. `App.jsx`/`Settings.jsx`/`getCurrentUser()`
changes present in the working tree belong to AUTH-06's own file table and were not assessed as
part of this AUTH-07-scoped review — recommend a separate `/arh-review` pass for AUTH-06 if not
already done.
