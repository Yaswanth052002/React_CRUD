# Feature: AUTH-07 — Logout and session/token invalidation

## Problem

An authenticated dashboard user (Admin) currently has no way to end their session on demand. Once the JWT bearer token from AUTH-04 is issued, it lives in `localStorage` for its full 60-minute TTL with no client-side control to clear it — so a user stepping away from a shared machine, or wanting to switch accounts, cannot guarantee the browser stops presenting protected views or holding auth artifacts.

## Outcome

Clicking Logout (from the Settings screen, per AUTH-06) synchronously clears all client-side auth state — the JWT in `localStorage`, the axios `Authorization` default header, and the app's `isAuthenticated` flag — and the user is redirected to the Login screen. Any subsequent attempt to reach a protected route or browser storage inspection confirms zero residual auth artifacts.

## Constraints

- Stateless JWT mechanism (AUTH-04, finalized): no server-side session store exists, so logout cannot be a backend call — it is client-side-only.
- No token blacklist/revocation exists or is being added in this story; a logged-out token remains cryptographically valid until its 60-minute TTL naturally expires (accepted tradeoff, documented in AUTH-04 and restated here — see NFR-Security).
- No user identifier is available client-side under AUTH-04's locked contract (`GET /api/auth/me` excludes `id`); the logout observability event cannot include a user id.
- Desktop web browsers only (per CLAUDE.md target platforms) — `localStorage` availability is assumed, no mobile/legacy fallback required.

## Solution sketch

`userApi.js` exports a synchronous, no-argument `logout()` function that calls AUTH-04's `clearAuthToken()` to remove the token from `localStorage` (key `auth_token`) and reset the axios `Authorization` default header. App.jsx registers `userApi.registerUnauthorizedHandler(() => setIsAuthenticated(false))` on mount (the same handler AUTH-04 uses for 401s), and Settings' Logout button (AUTH-06) calls `userApi.logout()` then `props.onLogout()` directly — flipping `isAuthenticated` to `false` and letting AUTH-05's conditional render show the Login screen. No loading state, no error state: the operation cannot fail and completes in single-digit milliseconds.

## Addressing Research Conditions

- C-1 (RESOLVED, locked contract): `logout()` is exported from `frontend/src/services/userApi.js`, synchronous, no arguments, calls `clearAuthToken()` only, no backend call — PLAN.md restates this for implementer reference.
- C-2 (RESOLVED, locked contract): App.jsx wires `userApi.registerUnauthorizedHandler(() => setIsAuthenticated(false))` on mount (AUTH-04's exact export name); Settings' `onLogout` prop calls the same `setIsAuthenticated(false)` directly — no separate logout-specific callback mechanism — PLAN.md restates this for implementer reference.
- C-3 (RESOLVED, locked contract): Settings' Logout button calls `userApi.logout()` then `props.onLogout()`, in that order, with no loading state and no error handling (logout cannot fail) — PLAN.md restates this for implementer reference.
- C-4 (documented decision, PLAN.md work item): race-condition acceptance — an in-flight API request when logout fires will arrive at the backend without a valid `Authorization` header and receive a `401`, which routes through the same unauthorized handler (idempotent). Logout does not wait for or cancel in-flight requests; the redirect to Login is immediate.
- C-5 (documented decision, PLAN.md work item): stateless-JWT-validity-after-logout tradeoff — the cleared token remains cryptographically valid until its 60-minute TTL expires; no server-side revocation/blacklist exists in this story. This is an accepted tradeoff of AUTH-04's stateless JWT mechanism, appropriate for this internal, non-regulated admin tool.
- C-6 (documented decision, PLAN.md work item): performance benchmark — `logout()` is measured over 100+ iterations in a micro-benchmark test; p95 latency must be under 10ms (see NFR-Performance).
- C-7 (documented decision, PLAN.md work item): `localStorage.removeItem` error handling — `clearAuthToken()` (AUTH-04) wraps the removal in try/catch; on failure it logs a console warning containing no PII and proceeds so the auth-state clear and redirect still occur.
- C-8 (documented decision, PLAN.md work item): idempotency — calling `logout()` twice in rapid succession (e.g., double-click) produces no errors; `localStorage.removeItem` on an absent key is a no-op and repeated `setIsAuthenticated(false)` calls are idempotent.
- C-9 (RESOLVED, locked contract): the logout observability event logs `{ timestamp }` only — no user id, no token value — matching AUTH-04's `auth_session_expired` event precedent, since no user identifier is available client-side.
- C-10 (RESOLVED, locked contract): the `localStorage` key cleared by logout is exactly `auth_token` (AUTH-04's key); tests verify this exact key is removed.

## Scope

- In: the `logout()` export in `userApi.js` and its behavior (clear token, clear axios header default, log the observability event); App.jsx's registration of the unauthorized/logout handler that flips `isAuthenticated`; wiring of the Settings Logout button's `onClick` to call `userApi.logout()` then `props.onLogout()` (the wiring contract only — the button's markup and component are AUTH-06's).
- Out: AUTH-04's internal token-storage implementation (how `clearAuthToken()`, `setAuthToken()`, and the axios interceptors are built) — AUTH-07 only calls the existing export. AUTH-06's Settings screen UI (layout, button markup, styling) — AUTH-07 only defines the contract AUTH-06's button must call. AUTH-05's protected-route conditional-rendering logic — AUTH-07 only triggers the state flip that AUTH-05 renders against. Server-side token revocation/blacklisting — explicitly not implemented (accepted tradeoff, see Constraints).

## Functional requirements

FRs trace 1:1 to story ACs; see `docs/stories/AUTH-07.md` for canonical wording.
New impl constraints introduced below:

**AUTH-07-FR-1** — `logout()` export contract *(extends AC #2 with: exact signature, call sequence, and no-op return)*

`logout()` is exported from `frontend/src/services/userApi.js` as a synchronous, no-argument function. Its body: (1) call `clearAuthToken()` exactly once; (2) log the observability event `{ timestamp }` (see FR-3); (3) return `undefined` (no Promise, no async work). It performs no HTTP call.

**AUTH-07-FR-2** — Auth-state flip wiring *(extends AC #1 and AC #3 with: exact callback identity, no duplicate mechanism)*

App.jsx registers `userApi.registerUnauthorizedHandler(() => setIsAuthenticated(false))` on mount. Settings' Logout button calls `userApi.logout()` then `props.onLogout()` (which itself calls `setIsAuthenticated(false)`), in that order. No second, logout-specific callback registration is introduced — the 401 handler and the logout `onLogout` prop both flip the same boolean.

**AUTH-07-FR-3** — Observability event shape *(extends the story's Observability NFR with: exact payload)*

On every `logout()` call, emit `console.log("auth:logout", { timestamp: new Date().toISOString() })`. The payload contains exactly `timestamp` — no user id, no token value, no session id.

**AUTH-07-FR-4** — Idempotent, error-tolerant clear *(extends AC #4 with: double-invocation and storage-failure behavior)*

Calling `logout()` multiple times in succession produces no thrown errors and no duplicate side effects beyond redundant (harmless) callback invocations. If the underlying `localStorage.removeItem` call inside `clearAuthToken()` throws, `logout()` still completes (event still logs, state-flip callback still available to fire) rather than propagating the exception.

## Non-functional requirements

- Performance: `logout()` completes with p95 latency < 10ms, measured via a 100+ iteration micro-benchmark (no network I/O; localStorage clear + header reset + console log only).
- Security: Per `.claude/rules/security-baseline.md`: no PII or token values appear in the logout console log (event payload is `{ timestamp }` only, per FR-3). Accepted tradeoff (per AUTH-04, restated here): the cleared JWT remains cryptographically valid until its 60-minute TTL naturally expires; no server-side revocation/blacklist exists in this story.
- Accessibility: Per `.claude/rules/accessibility-baseline.md`: the Logout trigger (owned by AUTH-06) must remain keyboard-operable, and focus moves to the Login screen's primary field after the post-logout redirect (WCAG 2.1 AA).
- Observability: the `auth:logout` event (`{ timestamp }` only, no user id, no token value) is the sole logout-time signal; there is no server-side invalidation call to log against.

## Rollout plan

- **Strategy**: bang-bang
- **Feature flag**: none — logout is a backward-compatible addition to `userApi.js` and App.jsx; no existing behavior changes for users who don't click Logout.
- **Backout plan**: revert the `logout()` export, the App.jsx handler registration, and the Settings button wiring in a single commit; no data migration or persisted state to unwind.
- **Success signal**: zero residual auth artifacts detected in manual browser-storage inspection post-logout across the first week of internal use; no logout-related error reports.

## Documentation requirements

- **README updates**: `README.md` § CRUD Usage / auth — add a one-line note that Logout (Settings screen) clears the client-side session and redirects to Login, with no server-side call.
- **Runbook**: none.
- **API reference**: none — no new endpoint is introduced.
- **Inline code comments**: `userApi.js` `logout()` — a short comment noting the stateless-JWT tradeoff (token remains valid until TTL) so future maintainers don't assume server-side revocation exists.
- **Examples / how-to**: none.

## Open questions

(none — story's Clarifications section is empty and no new ambiguities were introduced in this PRD.)

Decisions logged in `docs/stories/AUTH-07.md` § Decision log.

## Approvals

**APPROVED** — 2026-08-17, reviewer: yaswanth.panthangi@apexon.com
  - Feature Summary, FRs, User Flows reviewed
  - UI specs: N/A, `integrations.design = none`
  - Edge Cases, Open Questions, test-case completeness reviewed
  - No-placeholder check ✓ · `[NEEDS CLARIFICATION]` count=0
  - Research verdict GO-WITH-CONDITIONS (all 10 conditions addressed above)
  - Tracker subtask: n/a (issue tracker = none)
