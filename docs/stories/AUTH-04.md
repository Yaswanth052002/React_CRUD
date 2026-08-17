# Story: AUTH-04 — Authentication state management and persistence across page refresh

**Epic**: AUTH
**Status**: Validated
**Priority**: P1
**Independent test**: true
**Owner**: Backend lead
**Updated**: 2026-08-17
**Source**: intake:raw-input

## User story

As an Admin using the dashboard, I want my authenticated session to survive a page refresh and
to be automatically redirected to Login whenever I'm not authenticated, so that I don't have to
re-enter credentials on every reload and unauthenticated users can never see Dashboard, Users,
or Settings content.

## Mechanism recommendation (grounded in this repo's actual code)

**Recommended mechanism: JWT access token issued by AUTH-02's login endpoint, persisted client-side in
`localStorage`, attached as an `Authorization: Bearer <token>` header via an axios request
interceptor added to `frontend/src/services/userApi.js`** (the sole HTTP layer per this repo's
conventions — no component calls axios directly).

Rationale, grounded in the actual stack:

- `frontend/src/App.jsx` has no router library at all — it's a single component holding
  `activeView` state (`"dashboard" | "users" | "settings"`) with no route table, no route guards,
  and no history-based redirect primitive. A cookie-based session tied to browser navigation
  buys nothing here; the "redirect" is just conditionally rendering a `<Login />` component
  instead of the current view, which works identically regardless of storage mechanism.
- The deployment topology (docker-compose, **separate** backend and frontend containers, per
  AUTH-08's scope) means the frontend and backend are served from different origins/ports
  (mirrored today even in local dev: `localhost:5173` vs `localhost:8000`, per
  `frontend/.env.example`'s `VITE_API_URL`). A cookie-based session requires `SameSite=None;
  Secure` for the cross-origin case, which in turn requires HTTPS everywhere (including local
  dev and docker-compose bridge networking) plus `withCredentials: true` on every axios call and
  an explicit `Access-Control-Allow-Credentials` + non-wildcard `Access-Control-Allow-Origin` on
  the FastAPI CORS config. That is materially more moving parts than this admin tool's current
  CORS setup supports without further environment work already tracked separately in AUTH-08.
- A bearer token in an `Authorization` header sidesteps SameSite/cross-origin-cookie complexity
  entirely (it's just JSON over HTTPS-or-HTTP like every other axios call `userApi.js` already
  makes) and is trivial to persist across refresh via `localStorage.getItem`/`setItem`, funneled
  through one interceptor in the one file that owns all HTTP calls.
- Storing the JWT in memory only (React state, no persistence) would NOT survive a page refresh,
  which directly contradicts this story's core acceptance criterion — ruled out.
- `sessionStorage` was considered instead of `localStorage` (scopes the token to a single tab,
  slightly reducing exposure window) but was rejected as default because it would silently log
  the user out when they open the dashboard in a new tab, which is a plausible admin workflow;
  `localStorage` is recommended, with the tradeoff documented below.

This mechanism does **not** store the password or its hash client-side (that remains
server-only, per AUTH-03) — only an opaque, server-issued, time-bounded JWT is persisted.

**Accepted tradeoff / residual risk**: a token in `localStorage` is readable by any script running
in the page (XSS exposure), same as most SPA bearer-token setups without a BFF layer. This repo
has no CSP hardening today (README/ADR do not mention one). This is a known, accepted risk for a
desktop-only internal admin tool with no PII beyond name/email/phone; it is called out here for
visibility, not silently assumed.

## Acceptance criteria

1. Given an Admin has successfully logged in and a valid, unexpired token is stored, when the
   Admin refreshes the browser (or reopens the app) while on the Dashboard, Users, or Settings
   view, then the app restores the authenticated session from stored state without showing the
   Login screen and without requiring re-entry of credentials, and re-renders the view that was
   active before the refresh.
2. Given no valid token exists in client storage (first visit, token was never issued, or the
   token was cleared), when the app mounts and would otherwise render Dashboard, Users, or
   Settings, then the app renders the Login screen instead, within 100ms of app mount, and does
   NOT issue any Dashboard/Users/Settings data-fetching request (`GET /api/dashboard/stats`,
   `GET /api/users`, etc.) before authentication succeeds.
3. Given a stored token exists but is expired (past its expiry timestamp) or a subsequent API
   call is rejected by the backend with `401 Unauthorized`, when the app detects this (on mount,
   or on receipt of the `401` via the shared axios error handling in `userApi.js`), then the app
   clears the stored token, redirects to the Login screen, and shows a readable message
   indicating the session expired (never a raw stack trace, per project convention).
4. Given the Admin is on the Users view mid-session and the token expires or is invalidated
   server-side (e.g. after logout in another tab, see AUTH-07), when the Admin performs any
   action that calls the backend (e.g. `updateUser`), then the resulting `401` triggers the same
   redirect-to-Login behavior as AC3 rather than a generic/opaque error toast.

## Non-functional requirements

- Performance: Auth-state check on app mount is synchronous (local token presence/expiry check,
  no network round-trip) and completes in **< 100ms**, so the Login-vs-protected-view decision
  never causes a visible flash of protected content ("flash of authenticated content" is out of
  scope to eliminate via SSR since this is a client-rendered SPA, but the check must run before
  the protected view's first data fetch is issued, per AC2).
- Security: Per `.claude/rules/security-baseline.md`: token stored in `localStorage`, never the
  password or password hash (AUTH-03 remains the sole owner of credential hashing; this story
  must not introduce any client-persistent storage of raw credentials, including under a
  "remember me" feature). Access-token TTL: 60 minutes. No CSRF token header is required for this mechanism (CSRF mitigations
  in the security baseline target cookie-based auth; a bearer token in an explicit header is not
  automatically attached by the browser, so it is not CSRF-exploitable the same way).
- Accessibility: Per `.claude/rules/accessibility-baseline.md`: applies to the Login screen
  rendered on redirect (new UI surface reached from this story's gating logic) — on redirect,
  focus moves to the first focusable element of the Login form (matching the "default focus on
  open" pattern for modal-like transitions), and the transition respects
  `prefers-reduced-motion` if any transition animation is added.
- Observability: Session-expiry-triggered redirects are logged client-side only as an opaque
  event (e.g. `auth_session_expired`) with no token value, no email, and no other PII, per
  security-baseline's no-PII-in-logs rule.

## Dependencies

- Upstream: AUTH-02 (existing-user authentication and credential validation — issues the token
  this story persists), AUTH-03 (password security/hashing — this story must not contradict its
  server-side-only credential storage).
- Informational (not a gating dependency — AUTH-08 itself depends on AUTH-04, so this is
  intentionally one-directional to avoid a cycle): AUTH-08 (docker/deployment CORS
  configuration) implements env/CORS config *for* this story's already-finalized JWT-bearer
  mechanism. This story's cross-origin analysis assumes docker-compose's current
  separate-container topology (per the README/docker-compose.yml as they exist today) — AUTH-04
  does not wait on AUTH-08 to ship. If the deployment topology later changes to a same-origin
  reverse-proxy setup, the cookie-vs-token tradeoff in this story's mechanism recommendation
  should be re-evaluated, but that is a future revisit, not a blocker on this story's research
  or implementation.
- Downstream: AUTH-05 (navigation/routing must consult this story's auth state to decide which
  nav items/views are reachable), AUTH-06 (Settings screen displays user info sourced from this
  story's persisted auth state), AUTH-07 (logout must clear the exact storage key this story
  defines).

## Test mapping

- E2E: N/A — no e2e tooling configured in this repo (`docs/config/project-commands.yaml`:
  `test_e2e: (n/a)`). Covered instead by a manual test script: log in, refresh on each of
  Dashboard/Users/Settings, confirm no redirect; clear storage, reload each view, confirm
  redirect to Login; force a `401` (e.g. via expired/tampered token), confirm redirect + message.
- Unit: `frontend/src/services/userApi.js` interceptor (attaches/clears `Authorization` header,
  normalizes `401` into the redirect-triggering error path) and the auth-state hook/context that
  `App.jsx` will consult (token presence/expiry check, restore-on-mount behavior) — via Vitest,
  injecting a token directly into `localStorage` so this story is testable without a live
  AUTH-02 login flow. Backend: pytest coverage for token validation middleware returning `401`
  on missing/expired/invalid tokens (introduced by AUTH-02/AUTH-03; this story only consumes the
  `401` contract, does not redefine it).
- Manual: browser-refresh verification per the E2E script above (only case tooling can't cover,
  since there's no e2e runner in this repo).

## Clarifications

(none — all markers resolved)

## Decision log

- 2026-08-17 Auth mechanism: JWT bearer token in `localStorage` + axios `Authorization` header
  interceptor in `userApi.js` (per mechanism-recommendation section above) — chosen over
  session cookies to avoid cross-origin `SameSite`/CORS-credentials complexity from the
  docker-compose split-container topology, and over in-memory-only JWT because it would not
  survive a page refresh, contradicting this story's core requirement.
- 2026-08-17 Owner: Backend lead (resolved during story validation round 2) — this is primarily
  a backend auth-mechanism story, consistent with AUTH-03's owner resolution.
- 2026-08-17 Access-token TTL: 60 minutes, finalized not just recommended (resolved during story
  validation round 2) — reasonable default for an internal admin tool with no regulated-data
  scope, balancing admin-session convenience against exposure window.

## Validation log

- 2026-08-17T11:36:00Z v1 total=81.75 Completeness=70 Clarity-Unresolved=0 (FAIL)
- 2026-08-17T12:00:00Z v2 total=100 PASS
