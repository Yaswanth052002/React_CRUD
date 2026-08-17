# Story: AUTH-01 — Login screen UI and entry point

**Epic**: AUTH
**Source**: intake:raw-input
**Status**: Validated
**Priority**: P1
**Independent test**: true
**Owner**: Full-stack (brownfield intake — no named owner in source system)
**Updated**: 2026-08-17

## User story

As an unauthenticated visitor to the dashboard, I want a dedicated email/password login screen
so that I have a single, obvious entry point to authenticate before reaching any admin
functionality.

## Acceptance criteria

1. Given an unauthenticated visitor loads the app, when the login screen renders, then it shows
   a form with an `email` input (`type="email"`), a `password` input (`type="password"`), and a
   submit ("Log in") button, styled with the existing `form-group` / `form-label` / `form-input`
   / `btn btn-primary` classes from `frontend/src/styles/index.css` (same conventions as
   `frontend/src/components/UserForm.jsx`) — no new design system or component library is
   introduced.
2. Given the visitor fills in email and password and clicks "Log in", when the submit handler
   fires, then the submit button immediately shows a disabled state with the existing `.spinner`
   element (same pattern as `UserForm.jsx:166`) for the duration of the (mocked, in this story)
   auth call, and the button re-enables the instant the call resolves or rejects — there is no
   artificial minimum spinner duration.
3. Given the mocked auth service call rejects (simulating invalid credentials or a network/server
   error), when the rejection is caught, then the screen displays a single generic, non-leaking
   message ("Invalid email or password. Please try again.") in a dedicated error-display area
   using the existing `.form-server-error` convention (`UserForm.jsx:69-77`) — the UI never
   distinguishes "wrong email" from "wrong password" and never renders a raw exception message or
   stack trace, per the project's error-handling convention and
   `.claude/rules/security-baseline.md` (never reveal whether the email exists).
4. Given the visitor resizes the viewport down to 320px width, when the login screen reflows,
   then the form remains fully usable with no horizontal scrolling (per
   `.claude/rules/accessibility-baseline.md` reflow requirement), consistent with the existing
   `.stats-grid` responsive breakpoints (1100px, 640px) used elsewhere in the app.
5. Given the visitor submits the form with an empty email or password field, when client-side
   validation runs (mirroring the `validate()` pattern in `UserForm.jsx:14-39`), then the
   submit is blocked and a field-level `.form-error` message appears under the offending
   field(s) without calling the (mocked) auth service.

## Non-functional requirements

- Performance: the loading state (disabled button + spinner) must appear within one render frame
  (<16ms) of the click event — no debounce/delay is applied to the submit action itself (contrast
  with the 300ms search debounce in SRF-01, which does not apply here).
- Security: Per `.claude/rules/security-baseline.md`: this story renders no credentials to logs
  or the DOM outside the controlled password input; the input uses `type="password"` (browser
  masks it) and `autoComplete="current-password"` / `autoComplete="username"` on the respective
  fields. No password value is ever included in error messages, console output, or component
  state that outlives the form. Actual credential validation, hashing, rate-limiting, and
  token issuance are explicitly out of scope for this story (see AUTH-02, AUTH-03) — this story
  only renders the request/response *states* (idle, loading, error) against a mocked auth
  service.
- Accessibility: Per `.claude/rules/accessibility-baseline.md`: applies to this new login screen.
  Email and password inputs each have an associated `<label>` with `htmlFor`/`id` linkage and
  `aria-required="true"`; the error-display area uses `aria-live="assertive"` so screen readers
  announce login failures immediately; the submit button has a visible focus state; touch targets
  are at least 44x44px.
- Observability: no client-side logging of login attempts, emails, or passwords is added in this
  story (per security-baseline: never log PII or credentials). Downstream stories (AUTH-02)
  own any server-side auth audit logging.

## Dependencies

- Upstream: none blocking — this story is buildable and independently testable today against a
  mocked auth service (no backend auth endpoint required to complete this story).
- Downstream: AUTH-02 (existing-user authentication and credential validation) supplies the real
  auth service this screen's submit handler will call in place of the mock; AUTH-04
  (authentication state management/persistence) consumes this screen's successful-login callback
  to set session state; AUTH-05 (navigation/routing for authenticated vs. unauthenticated views)
  owns deciding *when* this screen is mounted/unmounted within `App.jsx`'s `activeView` state
  machine — this story delivers only the standalone `LoginForm`/`LoginScreen` component, with no
  `App.jsx` wiring included.

## Test mapping

- E2E: NA (no frontend E2E suite present in repo, per `docs/config/project-commands.yaml`).
- Unit: `frontend/src/components/__tests__/LoginForm.test.jsx` (new) — covers empty-field
  validation blocking submit, loading-state toggling around a mocked auth service call, and the
  generic error message rendering on a rejected mock call, run via `npm run test` (Vitest).
- Manual: verify login screen renders correctly and remains usable at 320px, 640px, 1100px+
  viewport widths in both local dev (`npm run dev`) and the existing docker-compose setup
  (per AUTH-08 environment scope).

## Clarifications

(none — no unresolved markers remain in this story)

## Decision log

- 2026-08-17 Show/hide password toggle: omitted from this story's scope — the existing app has
  no precedent for this UI pattern and CLAUDE.md/README specify no such requirement; resolved via
  best judgment to keep the form minimal and consistent with existing `UserForm.jsx` conventions.
  If needed, it can be added as a small follow-up without changing this story's ACs.
- 2026-08-17 Generic error copy: "Invalid email or password. Please try again." chosen as the
  single failure message (never distinguishing which field is wrong) per
  `.claude/rules/security-baseline.md` (never reveal whether the email exists) — resolved via
  best judgment rather than escalated, since the baseline rule is unambiguous on this point.
- 2026-08-17 AUTH-01 scope boundary: delivers only the standalone Login component
  (`LoginForm`/`LoginScreen`), testable in isolation via a mocked auth service; wiring it into
  `App.jsx`'s `activeView` gate (mounting/unmounting based on auth state) is owned entirely by
  AUTH-05, which is already scoped as "Navigation and routing for authenticated/unauthenticated
  views" and whose ACs cover this exact mount/unmount behavior — resolved during story validation
  round 2 (confirmed no conflict with AUTH-05's existing scope).

## Validation log

- 2026-08-17T11:40:00Z v1 total=92 Clarity-Unresolved=0 (FAIL)
- 2026-08-17T12:00:00Z v2 total=100 PASS
