# Feature: AUTH-06 — Settings screen with user info and logout action

## Problem

Authenticated users have no way to confirm which account they are signed in as, or to end
their session from the dashboard. `App.jsx` currently renders a `SettingsPlaceholder` for the
`"settings"` nav item with no real content, so a signed-in user cannot see their own name/email
or log out without leaving the app.

## Outcome

A signed-in user who navigates to Settings sees their own name and email (sourced from
`GET /api/auth/me`) and can click Logout to end their session and land back on the Login screen.
No account-editing surface is added — the screen is read-only aside from the Logout action.

## Constraints

- No password-change/account-editing UI on this screen (explicit non-goal, story AC 2).
- Depends on AUTH-04 (auth state + `GET /api/auth/me`), AUTH-05 (route guard), and AUTH-07
  (logout/session-invalidation) shipping their locked contracts; this story only consumes them.
- `story_independent_test = false` — cannot be validated end-to-end in isolation from AUTH-04/
  AUTH-05.
- Desktop web only, per project target platforms.

## Solution sketch

Replace the `SettingsPlaceholder` branch in `App.jsx` with a new `Settings.jsx` page that fetches
the current user once on mount via a new `getCurrentUser()` function in `userApi.js`, renders the
result using the existing `details-header`/`details-grid` read-only pattern from
`UserDetails.jsx` (name + email only, no avatar), and wires a Logout button that calls
`userApi.logout()` followed by the `onLogout` prop passed down from `App.jsx`.

## Addressing Research Conditions

- C-1: AUTH-04 `GET /api/auth/me` response schema is `{name: string, email: string}` exactly —
  already locked, PLAN.md restates for implementer reference.
- C-2: AUTH-07 logout export — `logout()` is a plain, stateless function exported from
  `userApi.js`; Settings' handler calls `userApi.logout()` then `props.onLogout()` — already
  locked, PLAN.md restates for implementer reference.
- C-3: AUTH-05 route guard lives in `App.jsx` before the `activeView` switch, not in
  `Settings.jsx`; Settings.jsx never receives or needs an `isAuthenticated` prop — already
  locked, PLAN.md restates for implementer reference.
- C-4: Loading/error UX — loading is a spinner next to the name/email fields (reusing the
  existing `.spinner` class); error is an inline, persistent banner (not a toast) — already
  locked, PLAN.md restates for implementer reference.
- C-5: `getCurrentUser()` function signature and export in `userApi.js` — open PLAN.md work
  item: PLAN.md must specify the exact export (`export async function getCurrentUser()`),
  its `client.get("/api/auth/me")` call, return shape, and `normalizeError` usage.
- C-6: `Settings.jsx` component structure (props, state, render tree, Logout handler wiring) —
  open PLAN.md work item: PLAN.md must specify the full component contract per the story AC set.
- C-7: No avatar shown in the details-header — already locked, PLAN.md restates for implementer
  reference.
- C-8: Logout button needs no loading state (logout is synchronous, no backend call) — already
  locked, PLAN.md restates for implementer reference.
- C-9: Current-user identity is derived server-side from the caller's Bearer token, never from a
  client-supplied id — open PLAN.md work item: PLAN.md must confirm this is enforced on the
  `GET /api/auth/me` endpoint (AUTH-04/AUTH-02 scope) and that Settings.jsx performs no
  client-side identity check.
- C-10: Test isolation — open PLAN.md work item: PLAN.md must specify that `Settings.jsx` unit
  tests mock `getCurrentUser()` and `logout()` directly, without depending on AUTH-04/AUTH-05's
  session-state implementation, and do not need to cover the unauthenticated case.

## Scope

- In: `Settings.jsx` page component; `getCurrentUser()` addition to `userApi.js`; wiring the
  Logout button to `userApi.logout()` + `props.onLogout()`; loading spinner and inline error
  banner states; replacing the `SettingsPlaceholder` branch in `App.jsx` with `Settings.jsx`.
- Out: the `GET /api/auth/me` backend endpoint itself (AUTH-04/AUTH-02's implementation, this
  story only consumes its locked response contract); the authenticated/unauthenticated route
  guard logic (AUTH-05's implementation, this story only assumes it gates rendering); the actual
  session/token invalidation logic behind logout (AUTH-07's implementation, this story only
  invokes it); any password-change or account-editing UI (explicit non-goal).

## Functional requirements

FRs trace 1:1 to story ACs; see `docs/stories/AUTH-06.md` for canonical wording.
New impl constraints introduced below (when any):

**AUTH-06-FR-1** — `getCurrentUser()` contract *(extends AC #1 with: exact request/response shape)*

`userApi.js` exports `async function getCurrentUser()` that issues a single `GET /api/auth/me`
request and returns exactly `{name: string, email: string}`; on failure it throws the same
`normalizeError`-wrapped error used by all other `userApi.js` functions. No other fields
(`role`, `id`, avatar) are read or rendered.

**AUTH-06-FR-2** — Logout wiring *(extends AC #4 with: call order and prop contract)*

The Logout button's click handler calls `userApi.logout()` (a plain, synchronous, stateless
function — no backend request) first, then `props.onLogout()`. `Settings.jsx` performs no
navigation or redirect itself; the transition to the Login screen happens because `onLogout`
flips `isAuthenticated` to false in `App.jsx`, and AUTH-05's guard re-renders accordingly.

**AUTH-06-FR-3** — No `isAuthenticated` prop *(extends AC #3 with: component contract)*

`Settings.jsx` does not accept, read, or branch on an `isAuthenticated` prop; it assumes it is
only ever rendered when authenticated (enforced upstream by AUTH-05's guard in `App.jsx`).

**AUTH-06-FR-4** — Loading and error presentation *(extends AC #5 with: exact UI treatment)*

While the current-user fetch is in flight, the page renders a spinner (reusing the existing
`.spinner` class) next to the name/email fields — not a full-page skeleton. On fetch failure,
the page renders a readable inline, persistent banner in place of the fields — not a toast, and
not a raw stack trace. The fetch is issued exactly once on mount (empty-dependency `useEffect`)
with no automatic retry and no polling.

## Non-functional requirements

- Performance: Per `.claude/rules/performance-baseline.md`: the current-user fetch is a single
  bounded request issued once on Settings mount; no polling; any retry is capped with
  exponential backoff and jitter. Expected latency <100ms on a healthy network, inherited from
  `userApi.js`'s existing 10s timeout.
- Security: Per `.claude/rules/security-baseline.md`: applies to the `GET /api/auth/me`
  consumption and Logout flow in scope here. `Settings.jsx` never receives or transmits a
  client-supplied user id — identity is derived server-side from the caller's Bearer token
  (AUTH-04/AUTH-02 scope, this story only relies on that contract). No PII (name/email) is ever
  written to logs or included in error messages shown or logged on fetch failure.
- Accessibility: Per `.claude/rules/accessibility-baseline.md`: applies to the new Settings page
  and its Logout button. The read-only name/email fields use the `details-item`/
  `details-item__label`/`details-item__value` pattern already established in `UserDetails.jsx`
  for consistent labelling and structure.
- Observability: Fetch errors are surfaced via the inline persistent banner (see AUTH-06-FR-4),
  never a raw stack trace; no name/email/PII is written to application logs on success or
  failure.

## Rollout plan

- **Strategy**: bang-bang — low blast-radius, additive page replacing an inert placeholder;
  gated entirely behind AUTH-04/AUTH-05 shipping first (Settings is unreachable until then).
- **Feature flag**: none.
- **Backout plan**: revert the `App.jsx` branch to render `SettingsPlaceholder` again; no data
  migration or persisted state to unwind.
- **Success signal**: manual smoke test confirms name/email render correctly and Logout returns
  the user to Login with no console errors; zero regressions in existing `userApi.js` test suite.

## Documentation requirements

- **README updates**: `README.md` § 11 (CRUD Usage) — add a short note that Settings is a
  read-only profile + Logout screen, no editing.
- **Runbook**: none.
- **API reference**: none (this story only consumes `GET /api/auth/me`, documented under
  AUTH-04's scope).
- **Inline code comments**: none required beyond standard JSDoc-style comment on
  `getCurrentUser()` describing its return shape, matching the style of existing `userApi.js`
  functions.
- **Examples / how-to**: none.

## Open questions

Decisions logged in `docs/stories/AUTH-06.md` § Decision log.

## Approvals

**APPROVED** — 2026-08-17, reviewer: yaswanth.panthangi@apexon.com
  - Feature Summary, FRs, User Flows reviewed
  - UI specs: N/A, `integrations.design = none`
  - Edge Cases, Open Questions, test-case completeness reviewed
  - No-placeholder check done · `[NEEDS CLARIFICATION]` count=0
  - Research verdict GO-WITH-CONDITIONS (all 10 conditions addressed above)
  - Tracker subtask: n/a (issue tracker = none)
