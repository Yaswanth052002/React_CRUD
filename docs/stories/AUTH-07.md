# Story: AUTH-07 — Logout and session/token invalidation

**Epic**: AUTH
**Status**: Validated
**Priority**: P1
**Independent test**: true
**Owner**: Frontend lead
**Updated**: 2026-08-17

**Source**: intake:raw-input

## User story

As an Admin (authenticated dashboard user), I want to log out of the dashboard so that my session and credentials are fully invalidated and no one else can access protected pages from my browser afterward.

## Acceptance criteria

1. Given I am authenticated and on any page of the dashboard, when I trigger logout (from the Settings screen action defined in AUTH-06), then all client-side auth state is cleared (no auth token, session id, or cookie remains in browser storage) and I am redirected to the Login screen.
2. Given an authenticated user clicks Logout, when the action completes, then the client-side JWT access token is removed from localStorage and the axios `Authorization` header default is cleared, with no server-side call required (the stateless JWT mechanism has no server-side session to invalidate).
3. Given I have logged out, when I attempt to navigate directly (e.g. via URL or browser back button) to a protected route, then the app rejects the attempt and redirects me to the Login screen without exposing any protected data.
4. Given I have logged out, when I inspect browser storage (localStorage/sessionStorage/cookies), then no leftover auth artifacts (tokens, session ids, cookies) from the prior session remain.

## Non-functional requirements

- Performance: logout action (client-side state clear only) completes and redirects to Login within 500ms p95 under normal network conditions.
- Security: logout MUST leave zero residual auth artifacts (tokens/cookies/session ids) in browser storage. Per AUTH-04's finalized stateless-JWT mechanism, there is no server-side session to revoke; the token remains cryptographically valid until its 60-minute TTL naturally expires even after client-side logout. This is an accepted tradeoff of the stateless-JWT mechanism (already documented in AUTH-04) — no token-blacklisting is implemented.
- Accessibility: logout control and the resulting redirect follow WCAG 2.1 AA (keyboard-operable trigger, focus moves to the Login screen's primary field after redirect).
- Observability: log a `logout` event (event name and timestamp only — no user id, per AUTH-04's locked contract which stores no user identifier client-side; `GET /api/auth/me` excludes `id` and the JWT is only decoded for its `exp` claim) client-side/analytics only; no server-side invalidation call exists to log against. Do not log token values.

## Dependencies

- Upstream: AUTH-04 (Authentication state management and persistence) — finalized on a stateless JWT bearer-token mechanism (access token issued at login, stored in localStorage, sent via axios `Authorization: Bearer` interceptor, 60-minute TTL, no server-side session store). This makes AUTH-07 a pure client-side operation with no dependency on any undelivered backend endpoint. Also depends on AUTH-06 (Settings screen) for the logout trigger UI, and AUTH-05 (routing for authenticated/unauthenticated views) for protected-route rejection behavior.
- Downstream: none.

## Test mapping

- E2E: `frontend` logout flow — trigger logout from Settings, assert redirect to Login, assert protected route access is rejected post-logout (file TBD once AUTH-06 lands).
- Unit: `frontend/src/services/userApi.js` (or equivalent auth service) — trigger logout, assert localStorage token is cleared, assert axios default `Authorization` header is unset, assert redirect to Login fires. Fully testable in isolation today (no backend dependency).
- Manual: inspect browser storage/cookies post-logout to confirm no leftover auth artifacts (until automated storage-inspection coverage exists).

## Clarifications

(none)

## Decision log

- 2026-08-17 Story owner: Frontend lead (logout is now a client-side-only concern) — resolved during story validation round 2, consistent with AUTH-04's finalized JWT-bearer mechanism.
- 2026-08-17 Logout mechanism: stateless JWT, client-side-only clear (remove token from localStorage, clear axios `Authorization` default header, no server-side call) — resolved during story validation round 2, consistent with AUTH-04's finalized JWT-bearer mechanism.
- 2026-08-17 Feasibility: logout no longer depends on any undelivered AUTH-04 backend endpoint; fully feasible today as a pure client-side operation — resolved during story validation round 2, consistent with AUTH-04's finalized JWT-bearer mechanism.
- 2026-08-17 Testability: logout is independently testable via unit test (localStorage clear, axios header clear, redirect assertion); `Independent test` set to `true` — resolved during story validation round 2, consistent with AUTH-04's finalized JWT-bearer mechanism.
- 2026-08-17 Security NFR: no server-side token revocation is possible before natural 60-minute TTL expiry under the stateless-JWT mechanism; accepted as a documented tradeoff already recorded in AUTH-04 — resolved during story validation round 2, consistent with AUTH-04's finalized JWT-bearer mechanism.
- 2026-08-17 post-plan-requirements correction: Observability NFR narrowed to drop `user id` from the logout log event — no user identifier is available client-side under AUTH-04's locked contract (`GET /api/auth/me` excludes `id`; the JWT is decoded only for its `exp` claim). The logout event now logs event name + timestamp only, mirroring AUTH-04's own `auth_session_expired` event precedent. This is a narrowing correction, not a scope change — no re-validation round required.

## Validation log

- 2026-08-17T11:36:00Z v1 total=61 Testability=10 Feasibility=7.5 Clarity=6 Clarity-Unresolved=0 (FAIL)
- 2026-08-17T12:00:00Z v2 total=100 PASS
