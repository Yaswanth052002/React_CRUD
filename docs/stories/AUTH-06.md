# Story: AUTH-06 — Settings screen with user info and logout action

**Epic**: AUTH
**Status**: Validated
**Priority**: P2
**Independent test**: false
**Owner**: unassigned
**Updated**: 2026-08-17

**Source**: [RTM](../requirements/RTM.md) · intake:raw-input
**Parent epic**: AUTH (User Login and Settings) — greenfield, not yet built

## Background / current-state grounding

- `frontend/src/App.jsx` currently renders a `SettingsPlaceholder` for the `"settings"`
  `activeView` key (same conditional-branch pattern noted in `docs/stories/USR-01.md` Decision
  log for `"users"`). This story replaces that placeholder with a real Settings screen.
- There is no authentication today anywhere in this repo (no login screen, no session/token
  state, no protected routes) — AUTH-01 (login UI), AUTH-02 (credential validation), AUTH-03
  (password hashing), AUTH-04 (auth state management/persistence), and AUTH-05 (authenticated/
  unauthenticated routing) are sibling stories in this same intake batch and are prerequisites
  for this screen to function; this story only defines the Settings screen itself.
- No backend endpoint exists today that returns "the current authenticated user". A new backend
  endpoint (e.g. `GET /api/auth/me` or equivalent) is a dependency of this story but its design
  is out of scope here — it belongs to AUTH-04/backend auth planning.
- Existing detail-view styling convention: `frontend/src/components/UserDetails.jsx` renders a
  read-only avatar + name/email header (`details-header`) and a `details-grid` of label/value
  pairs (`details-item`, `details-item__label`, `details-item__value`), backed by `Modal.jsx`.
  This story's Settings screen should reuse the same `details-header`/`details-grid` visual
  pattern for consistency, but as a page (not a modal).
- All HTTP calls continue to route exclusively through `frontend/src/services/userApi.js`; a
  new client function (e.g. `getCurrentUser()`) will need to be added there when the backend
  endpoint exists, but adding it is implementation work, not part of this story's scope.

## User story

As an authenticated user, I want a Settings screen that shows my own name and email and lets me
log out, so that I can confirm which account I'm signed in as and end my session without any
other account-management clutter on this screen.

## Acceptance criteria

1. Given a user is authenticated and navigates to the Settings screen (via the sidebar
   "Settings" nav item), when the screen loads, then it displays the current authenticated
   user's name and email as read-only fields (no inputs, no edit affordance), sourced from the
   current-user identity established by AUTH-04's auth state (backed by the
   `GET /api/auth/me` endpoint, which returns the authenticated user's `name` and `email` —
   never the password hash — authenticated via the same Bearer-token mechanism as all other
   protected endpoints), and a single "Logout" button.
2. Given the Settings screen has loaded, when it renders, then it contains no password-change
   form, no fields for editing name/email/phone/role/status, and no other account-management
   action beyond "Logout" — any future account-editing capability is an explicit non-goal for
   this screen per the parent AUTH feature.
3. Given a user is NOT authenticated, when they attempt to navigate directly to the Settings
   screen (e.g. via URL or stale nav state), then they are redirected to the login screen and
   the Settings screen's user info and Logout button are never rendered (enforced by the
   authenticated/unauthenticated routing guard defined in AUTH-05).
4. Given the authenticated user clicks "Logout" on the Settings screen, when the action is
   triggered, then the app-level logout flow defined in AUTH-07 is invoked (session/token
   invalidated) and the user is navigated away from the Settings screen to the login screen;
   this story owns only the button and its click-triggers-logout-flow wiring, not the
   invalidation logic itself (see AUTH-07).
5. Given the current-user fetch fails (e.g. network error or session expired mid-load), when the
   error is caught, then a readable inline error message is shown on the Settings screen (never
   a raw stack trace), consistent with the app's existing error-surfacing convention.

## Non-functional requirements

- Performance: Per `.claude/rules/performance-baseline.md`: the current-user fetch is a single
  bounded request (no polling, no unbounded retries) issued once on Settings screen mount; any
  retry on transient failure is capped and uses backoff with jitter.
- Security: Per `.claude/rules/security-baseline.md`: the Settings screen displays only the
  current authenticated user's own name/email; the current-user endpoint must derive identity
  from the caller's own session/token server-side rather than trusting a client-supplied user
  id. Logout must invalidate the session/token server-side per AUTH-07's contract.
- Accessibility: Per `.claude/rules/accessibility-baseline.md`: applies to the new Settings page
  and its Logout button; the read-only name/email fields are presented as labelled text per the
  `details-item`/`details-item__label` pattern already used in `UserDetails.jsx`.
- Observability: Errors on the current-user fetch are surfaced via the existing inline-banner/
  toast convention; no PII (name/email) is ever written to logs.

## Dependencies

- Upstream: AUTH-01, AUTH-02/AUTH-03, AUTH-04 (auth state + current-user endpoint), AUTH-05
  (route guard enforcing AC 3).
- Downstream: AUTH-07 (logout/session invalidation) invoked by this screen's Logout button;
  AUTH-08 may need to account for any new backend endpoint this story depends on.

## Test mapping

- E2E: NA (no e2e suite configured per `docs/config/project-commands.yaml`).
- Unit (Vitest): `frontend/src/pages/__tests__/Settings.jsx` — read-only name/email, absence of
  edit/password UI, Logout wiring, loading state, inline error state.
- Manual: Log in, navigate to Settings, confirm info + no edit controls; click Logout and
  confirm redirect; attempt Settings while logged out and confirm redirect.

## Clarifications

## Decision log

- 2026-08-17 Priority: P2 — important but not part of the P1 login backbone (AUTH-01/02/03/04/05/07).
- 2026-08-17 Independent test: false — depends on AUTH-04 auth state/endpoint and AUTH-05 route guard.
- 2026-08-17 Scope boundary: password change/account editing explicitly out of scope per raw intake non-goal.
- 2026-08-17 Current-user endpoint: resolved during story validation round 2, consistent with
  AUTH-04's JWT-bearer mechanism — `GET /api/auth/me`, returning `name` and `email` only,
  authenticated via `Authorization: Bearer` header (same interceptor in
  `frontend/src/services/userApi.js` used by other protected endpoints).

## Validation log

- 2026-08-17T11:36:00Z v1 total=87 Clarity-Unresolved=0 (FAIL)
- 2026-08-17T12:00:00Z v2 total=97 PASS
