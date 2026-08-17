# Feature: AUTH-01 — Login screen UI and entry point

## Problem

Unauthenticated visitors to the dashboard have no dedicated entry point to authenticate. There
is no `LoginForm`/`LoginScreen` component today — the app currently renders Dashboard/Users/
Settings unconditionally, with no gate and no way to present a login form ahead of any admin
functionality.

## Outcome

A standalone, independently testable `LoginScreen` component exists (wrapping `LoginForm`) that
renders an email/password form styled per existing app conventions, shows a loading state during
a (mocked, in this story) auth call, surfaces a single generic non-leaking error on failure,
blocks submit on empty fields, and remains fully usable down to 320px width — all verifiable via
a mocked auth service, with zero `App.jsx` wiring (that integration is AUTH-05's scope).

## Constraints

- No new design system or component library — must reuse `frontend/src/styles/index.css`
  `.form-group` / `.form-label` / `.form-input` / `.form-error` / `.form-server-error` /
  `.spinner` / `.btn` / `.btn-primary` classes exactly as used in `UserForm.jsx`.
- Real credential validation, hashing, rate-limiting, and token issuance are out of scope (owned
  by AUTH-02/AUTH-03); this story only renders request/response *states* against a mocked auth
  service.
- `App.jsx` is not modified by this story — mount/unmount of `LoginScreen` is AUTH-05's scope.
- The `LoginScreen` props contract is locked by the AUTH-05 cross-story research decision
  (`docs/research/AUTH-05.md` § Risk register, item 2) and MUST be implemented verbatim: a single
  prop `onLoginSuccess={(token) => void}`; no `authError` prop is accepted or required.
- Per `.claude/rules/security-baseline.md`: never reveal whether an email exists; never log or
  persist password values.

## Solution sketch

Build two new components, `LoginForm.jsx` (presentational: fields, validation, loading/error
UI) and `LoginScreen.jsx` (container: owns its own loading/error state, calls a new
`userAuthService.login(email, password)`, and on success calls `userApi.setAuthToken(token)`
then `props.onLoginSuccess(token)`), following the validation/loading-state/error-display
patterns already established in `UserForm.jsx`, with no new CSS.

## Scope

- In: `LoginForm.jsx` (fields, client-side validation, loading state, error display, responsive
  layout), `LoginScreen.jsx` (container managing auth-call lifecycle and the locked
  `onLoginSuccess` contract), `userAuthService.js` (mockable `login(email, password)` async
  function), unit tests for validation blocking, loading-state toggling, and generic error
  rendering.
- Out: `App.jsx` wiring / mount-unmount gating (AUTH-05); real credential validation, hashing,
  rate-limiting, token issuance (AUTH-02/AUTH-03); auth-state persistence/`isAuthenticated`
  management (AUTH-04); server-side auth audit logging (AUTH-02); show/hide password toggle
  (explicitly deferred per story Decision log); any E2E suite (none exists in this repo).

## Functional requirements

FRs trace 1:1 to story ACs; see `docs/stories/AUTH-01.md` for canonical wording.
New impl constraints introduced below (when any):

**AUTH-01-FR-1** — LoginScreen container contract *(extends AC #2 and AC #3 with: the locked
cross-story prop/call-sequence contract from `docs/research/AUTH-05.md`, amended 2026-08-17 to
add the `sessionExpiredMessage` prop per AUTH-04's requirement)*

`LoginScreen` accepts two props: `onLoginSuccess={(token) => void}` and an optional
`sessionExpiredMessage={string | null}`. It does not accept or render an `authError` prop — all
submit-attempt loading/error state (e.g. "Invalid email or password.") is owned internally by
`LoginScreen`/`LoginForm`; `sessionExpiredMessage` is a distinct, narrower concern (why the user
landed back on Login — e.g. "Your session has expired. Please log in again." — set by AUTH-04 on
a 401/expiry redirect), rendered once above the form when non-null, and is unrelated to any
submit-attempt error. On submit, `LoginScreen` calls `userAuthService.login(email, password)`
(mocked in this story); on resolution it calls `userApi.setAuthToken(token)` and then
`props.onLoginSuccess(token)`, in that order. On rejection, no `setAuthToken`/`onLoginSuccess`
call is made and the generic error message is shown instead.

**AUTH-01-FR-2** — Auth service module boundary *(extends AC #2/#3 with: module shape so AUTH-02
can swap the implementation without touching component code)*

`frontend/src/services/userAuthService.js` exports a single async `login(email, password)`
function returning a token payload on success and rejecting on failure. `LoginForm` never calls
this module directly — only `LoginScreen` does, and `LoginForm` receives `onSubmit`/`isSubmitting`
via props (mirrors the callback-only convention already used by `UserForm.jsx`).

## Non-functional requirements

- Performance: the loading state (disabled button + spinner) must appear within one render frame
  (<16ms) of the click event — no debounce/delay is applied to the submit action; per
  `.claude/rules/performance-baseline.md`, no artificial waits are introduced.
- Security: Per `.claude/rules/security-baseline.md`: applies to all new UI surfaces in scope.
  No password value is rendered outside the controlled `type="password"` input, logged to the
  console, included in error messages, or retained in component state beyond the form's
  lifecycle; email/password inputs use `autoComplete="username"` / `autoComplete="current-
  password"` respectively; the single generic failure message ("Invalid email or password.
  Please try again.") never distinguishes invalid-email from invalid-password.
- Accessibility: Per `.claude/rules/accessibility-baseline.md`: applies to this new login screen.
  Email and password inputs each have an associated `<label>` with `htmlFor`/`id` linkage and
  `aria-required="true"`; the error-display area uses `aria-live="assertive"`; the submit button
  has a visible `:focus-visible` state and a touch target ≥ 44×44px; the form reflows with no
  horizontal scroll at 320px width.
- Observability: no client-side logging of login attempts, emails, or passwords is added in this
  story, per `.claude/rules/security-baseline.md` (never log PII or credentials).

## Rollout plan

- **Strategy**: bang-bang — new, additive, unmounted components with no existing call sites; zero
  blast radius until AUTH-05 wires them into `App.jsx`.
- **Feature flag**: none — the component is not reachable by any user until a later story mounts
  it.
- **Backout plan**: delete the three new files (`LoginForm.jsx`, `LoginScreen.jsx`,
  `userAuthService.js`) and their test file; no other code references them in this story's scope.
- **Success signal**: `frontend/src/components/__tests__/LoginForm.test.jsx` passes in CI
  (`npm run test`), covering empty-field validation, loading-state toggling, and generic error
  rendering.

## Documentation requirements

- **README updates**: none required by this story — `README.md` § 11 (CRUD Usage) is unaffected
  since this story delivers no reachable app entry point yet; AUTH-05 will update README when it
  wires the login gate into `App.jsx`.
- **Runbook**: none.
- **API reference**: none — `userAuthService.login()` is a mocked, client-only stub in this
  story; no backend endpoint is introduced (AUTH-02 owns the real endpoint and its docs).
- **Inline code comments**: `userAuthService.js` should carry a one-line comment noting it is a
  mock to be replaced by AUTH-02's real implementation, and must never log credentials.
- **Examples / how-to**: none.

## Open questions

Decisions logged in `docs/stories/AUTH-01.md` § Decision log.

## Approvals

**APPROVED** — 2026-08-17, reviewer: yaswanth.panthangi@apexon.com
  - Feature Summary, FRs, User Flows reviewed
  - UI specs: N/A (`design = n/a`, no design integration configured)
  - Edge Cases, Open Questions, test-case completeness reviewed
  - No-placeholder check done · `[NEEDS CLARIFICATION]` count=0
  - Research verdict GO (no conditions to address)
  - Tracker subtask: n/a (issue tracker = none)

## Addendum — 2026-08-17

`AUTH-01-FR-1` amended to add an optional `sessionExpiredMessage` prop to `LoginScreen`, needed
by AUTH-04's session-expiry redirect (AC3) which has no other way to surface "Your session has
expired. Please log in again." given the locked contract's absence of an `authError` prop. This
is additive only (no existing prop/behavior changed) — re-approval not required; noted here for
traceability.
