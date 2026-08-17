# Story: AUTH-05 — Navigation and routing for authenticated/unauthenticated views

**Source**: intake:raw-input
**Epic**: AUTH
**Status**: Validated
**Priority**: P1
**Independent test**: true
**Owner**: Frontend lead
**Updated**: 2026-08-17

## User story

As a dashboard user (authenticated or not), I want the navigation chrome to show only the
views appropriate to my authentication state so that I cannot see or reach Dashboard, Users, or
Settings before logging in, and I land on a sensible screen immediately after logging in.

## Acceptance criteria

1. Given an unauthenticated visitor (no valid auth state per AUTH-04) loads the app, when the
   app renders, then only the Login view is shown — the `Sidebar` (and its Dashboard/Users/
   Settings nav items) and `Header` are not rendered, and `activeView` cannot be set to
   `dashboard`, `users`, or `settings` via any exposed control.
2. Given an authenticated user (valid auth state per AUTH-04) loads or refreshes the app, when
   the app renders, then the `Sidebar` shows exactly three nav entries — Dashboard, Users,
   Settings — matching the existing `NAV_ITEMS` set in `frontend/src/components/Sidebar.jsx`,
   and each remains clickable and switches `activeView` exactly as it does today (no regression
   to existing Dashboard/Users behavior).
3. Given an unauthenticated user on the Login view, when they submit valid credentials and
   authentication succeeds (per AUTH-02/AUTH-04), then the app transitions directly to the
   Dashboard view (`activeView === "dashboard"`) with the Sidebar/Header now visible, without
   requiring a manual navigation click or a page reload.
4. Given an authenticated user whose auth state becomes invalid (e.g. token expired or cleared,
   per AUTH-04/AUTH-07), when the app re-renders, then it falls back to the Login-only view
   (Sidebar/Header removed) rather than leaving a stale Dashboard/Users/Settings view mounted.

## Non-functional requirements

- Performance: Nav-chrome visibility must resolve from the same auth-state check AUTH-04
  performs on load/refresh, adding no additional network round trip; the Login-vs-authenticated
  branch decision renders within the same paint as today's initial `App` render (no added
  loading spinner state beyond what AUTH-04 already introduces for auth-state resolution).
- Security: Per `.claude/rules/security-baseline.md`: this story is presentation-only routing —
  it does not grant or check resource authorization itself, but the Sidebar/Header/route
  components for Dashboard, Users, and Settings MUST NOT mount (not just be visually hidden via
  CSS) when auth state is invalid, since mounted-but-hidden components would still fire their
  data-fetching calls against protected endpoints.
- Accessibility: Per `.claude/rules/accessibility-baseline.md`: applies to the Login view and
  the Sidebar nav in both states — the Sidebar nav's `nav-item` buttons keep their existing
  keyboard reachability and visible focus states; the Login view (built in AUTH-01) is not
  duplicated or altered by this story beyond mounting/unmounting it based on auth state.
- Observability: Nav-state transitions (unauthenticated-to-authenticated, and the reverse on
  logout/expiry) are not separately logged per user per `.claude/rules/security-baseline.md`
  (no PII/token logging); covered by AUTH-04's own auth-state instrumentation — AUTH-05 does not
  add a separate log event for nav transitions themselves.

## Dependencies

- Upstream: AUTH-04 (authentication state management and persistence) supplies the boolean/
  derived auth-state signal this story branches on; AUTH-01 (Login screen) supplies the Login
  view component this story mounts when unauthenticated.
- Downstream: AUTH-06 (Settings screen with user info and logout) depends on the Settings nav
  entry and route this story keeps/exposes only to authenticated users; AUTH-07 (logout/session
  invalidation) depends on this story's fallback-to-Login behavior (AC 4).

## Test mapping

- E2E: NA (no e2e suite configured per `docs/config/project-commands.yaml`); manual verification
  substitutes until an e2e harness exists.
- Unit: `frontend/src/App.jsx` (auth-state-gated render branch replacing/wrapping the current
  unconditional `Sidebar` + view-switch block), `frontend/src/components/Sidebar.jsx` (no
  functional change expected, but its render is now conditional on the parent's auth gate —
  covered by an `App.test.jsx`-style test asserting Sidebar is absent when unauthenticated and
  present with all three `NAV_ITEMS` when authenticated).
- Manual: Verify no flash of Sidebar/Header before redirecting to Login on a hard refresh with
  an expired/absent auth token, and verify direct landing on Dashboard immediately post-login.
- Test isolation: this story's nav-rendering behavior is unit-testable in isolation from AUTH-04's
  real session-persistence implementation. Tests inject a stubbed/mocked `isAuthenticated`
  prop/context value into `App.jsx` (or a wrapper around the render branch) rather than relying
  on AUTH-04's actual auth-state signal landing first — one test render with the stub set to
  `false` asserts Login-only (AC 1), one with it set to `true` asserts full Sidebar/Header (AC 2),
  and toggling the stub between renders exercises the transition assertions in AC 3/AC 4. This
  keeps AUTH-05 independently testable regardless of AUTH-04's implementation timeline or state.

## Clarifications

## Decision log

- 2026-08-17 Priority: set to P1 — nav gating is a ship-blocker for the AUTH epic since without
  it, unauthenticated users retain full Dashboard/Users/Settings access (security regression).
- 2026-08-17 Independent test: set to true — re-scoped during story validation round 2 so tests
  inject a stubbed/mocked `isAuthenticated` signal into `App.jsx` instead of requiring AUTH-04's
  real session-persistence implementation to exist first; nav-rendering behavior is thus
  independently verifiable while remaining a P1 story.
- 2026-08-17 Owner: resolved to Frontend lead (per story validation round 2) — this is primarily
  a navigation/UI story, distinct from AUTH-04's Backend lead designation.
- 2026-08-17 Observability for nav transitions: resolved during story validation round 2 —
  covered by AUTH-04's own auth-state instrumentation; AUTH-05 does not add a separate log event
  for nav transitions themselves.

## Validation log

- 2026-08-17T11:36:00Z v1 total=67.5 Testability=40 Clarity-Unresolved=0 (FAIL)
- 2026-08-17T12:00:00Z v2 total=100 PASS
