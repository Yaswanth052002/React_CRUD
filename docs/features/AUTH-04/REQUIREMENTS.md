# Feature: AUTH-04 — Authentication state management and persistence across page refresh

## Problem

Today `frontend/src/App.jsx` has no authentication concept at all: it renders Dashboard/Users/
Settings unconditionally from a bare `activeView` state, with no router, no auth check on mount,
and no gate against unauthenticated access. Admins who refresh the browser have no way to remain
signed in, and there is no mechanism to reject stale or invalidated credentials — any visitor can
see Dashboard, Users, or Settings content regardless of login state.

## Outcome

A signed-in Admin's session survives a page refresh (restored from a stored JWT without
re-entering credentials), an Admin with no valid token is shown the Login screen instead of any
protected view within 100ms of app mount with zero protected data-fetch calls issued first, and
any `401 Unauthorized` response (expired or invalidated token) at any point in the session clears
the stored token and returns the Admin to Login with a readable, non-stack-trace message.

## Constraints

- Access-token TTL is fixed at 60 minutes (story Decision log, finalized during story validation).
- No CSRF token header is required — bearer token in an explicit header is not automatically
  attached by the browser, so it is not exploitable via the same vector cookie-based sessions are.
- Auth mechanism is already locked in the story: JWT bearer token in `localStorage`, attached via
  an axios request interceptor in `frontend/src/services/userApi.js` — the sole HTTP layer per
  project convention (components never call Axios directly).
- No signature verification on the client — the client checks only the token's `exp` claim
  (expiry), trusting the server to reject invalid/tampered tokens on every API call; this is a
  UX optimization, not a security boundary.
- This story does not introduce CSP hardening, does not modify AUTH-08's CORS configuration, and
  does not alter AUTH-02's login response shape — it consumes `{ token: string }` as already
  finalized in AUTH-02's Decision log.
- `LoginScreen`'s props contract is locked by `docs/features/AUTH-01/REQUIREMENTS.md` (as amended
  2026-08-17): `onLoginSuccess={(token) => void}` and an optional
  `sessionExpiredMessage={string | null}`. There is no `authError` prop on `LoginScreen` — any
  older wording referring to `authError`/`setAuthError` in prior research drafts is superseded by
  this locked `sessionExpiredMessage` contract and MUST NOT be used in this story's
  implementation.

## Solution sketch

Add a request/response interceptor pair to `userApi.js` that attaches the stored bearer token to
every outgoing call and, on any `401`, clears the token and notifies the app via a registered
callback; add a plain `isAuthenticated` boolean (`useState`) and a `sessionExpiredMessage` string
state to `App.jsx`, both initialized synchronously from `localStorage` on mount, so that the
Login-vs-protected-view decision never issues a network call and never flashes protected content.

## Addressing Research Conditions

- C-1 (401 infinite redirect prevention, Integration, HIGH): FR-1 and FR-4 below specify that (a)
  the AUTH-01 `LoginScreen`/`LoginForm` never call protected endpoints on mount (only on-submit,
  per AUTH-01's locked scope), (b) `setAuthToken(token)` is called before `onLoginSuccess` fires,
  guaranteeing the token is set before any protected call, and (c) the response interceptor's
  `registerUnauthorizedHandler` callback checks `getStoredToken()` is non-null before invoking the
  handler, so a second concurrent 401 after the token is already cleared does not re-trigger a
  redirect.
- C-2 (CORS Authorization header allowance, Integration, HIGH): out of scope for this story per
  AUTH-04's own Dependencies section (AUTH-08 owns CORS/env config); documented in `## Scope →
  Out` below as an explicit dependency, not silently assumed resolved.
- C-3 (token expiry check benchmark, Performance): NFR section below states the concrete budget
  (mount-to-`isAuthenticated`-set p95 < 100ms over 100 iterations) and FR-1 ties it to a specific,
  automatable performance test case.
- C-4 (AUTH-02 login response shape alignment, Integration): Constraints section above states the
  `{ token: string }` shape is consumed as-is, not redefined; FR-2 specifies extraction from this
  exact shape.
- C-5 (XSS risk acknowledgment, Security): NFR section below cites
  `.claude/rules/security-baseline.md` and documents the accepted localStorage/XSS tradeoff
  verbatim per the story's Mechanism section — no additional mitigation code is introduced in this
  story; CSP hardening is explicitly deferred.
- C-6 (Login component scope and accessibility, Domain/Accessibility): out of scope for this
  story's own file ownership — `LoginForm`/`LoginScreen` are AUTH-01's components (see `## Scope →
  Out`); this story's accessibility obligation is limited to the `sessionExpiredMessage` prop
  threading covered by FR-3, with rendering/aria-live ownership remaining in AUTH-01.
- C-7 (localStorage error handling, Compatibility/Robustness): FR-2 specifies that
  `getStoredToken`/`setAuthToken`/`clearAuthToken` in `userApi.js` wrap all `localStorage` calls in
  try/catch, treating a thrown `getItem` as "no token" and a thrown `setItem` as a caught error
  surfaced as a readable message (never a raw stack trace, per project convention).
- C-8 (jwt-decode library decision, Integration): NFR section below states the decision —
  `jwt-decode` is added as a dependency (not manual parsing) for reliability; FR-1 specifies the
  malformed-token fallback (treat as "no token").
- C-9 (App.jsx auth state initialization and clearance, Domain): FR-3 below specifies the
  corrected, locked contract — `isAuthenticated` is a plain `useState` boolean
  (`useState(() => Boolean(userApi.getStoredToken()))`, not `null`/loading, consistent with the
  cross-story contract in `docs/research/AUTH-05.md` risk register #1) and a separate
  `sessionExpiredMessage` (`string | null`) state, set on 401/expiry to "Your session has expired.
  Please log in again." and passed to `LoginScreen` as the `sessionExpiredMessage` prop (NOT
  `authError` — that naming from earlier research drafts is stale and superseded per
  `docs/research/AUTH-05.md` risk register rows #2 and #4).
- C-10 (Observability: session-expiry logging, Observability): NFR section below specifies the
  exact event name and PII-free payload, cited against
  `.claude/rules/security-baseline.md`'s no-PII-in-logs rule.

## Scope

- In: request/response interceptor pair in `userApi.js` (bearer-token attachment,
  `401` detection); `getStoredToken`/`setAuthToken`/`clearAuthToken`/`registerUnauthorizedHandler`
  exports in `userApi.js`; `isAuthenticated` and `sessionExpiredMessage` state and mount-time
  restoration logic in `App.jsx`; `jwt-decode`-based expiry check; client-side
  `auth_session_expired` observability event.
- Out: AUTH-08's CORS/env configuration for the `Authorization` header (this story assumes it is
  configured correctly and does not implement or verify it end-to-end); AUTH-02's login endpoint
  and its `{ token: string }` response shape (consumed as a fixed upstream contract, not owned or
  redefined here); AUTH-01's `LoginForm`/`LoginScreen` component implementation and internal
  submit-error UI (this story only supplies the `sessionExpiredMessage` prop value, per the locked
  contract in `docs/features/AUTH-01/REQUIREMENTS.md`); AUTH-05's Sidebar/Header
  conditional-rendering wiring (this story exposes `isAuthenticated` as a plain state value;
  AUTH-05 consumes it); AUTH-07's logout button/action (this story only guarantees
  `clearAuthToken` + the unauthorized-handler callback exist for AUTH-07 to reuse); CSP hardening
  (explicitly deferred to a future security-hardening story).

## Functional requirements

FRs trace 1:1 to story ACs; see `docs/stories/AUTH-04.md` for canonical wording.
New impl constraints introduced below (when any):

**AUTH-04-FR-1** — Token expiry check and malformed-token fallback *(extends AC #1/#2/#3 with:
the exact library and fallback behavior for the client-side expiry check)*

Token expiry is checked via `jwt-decode` extracting the `exp` claim and comparing to
`Date.now() / 1000`; no signature verification is performed on the client. If `jwt-decode` throws
(malformed token) or `localStorage.getItem` throws, the app treats this identically to "no token"
(`isAuthenticated = false`), never surfacing a stack trace. This check runs synchronously in a
`useEffect` (or inline during `useState` initializer) before any protected-view render.

**AUTH-04-FR-2** — `userApi.js` auth-token API surface *(extends AC #2/#3/#4 with: the exact
exported function names and their `localStorage` error-handling contract)*

`userApi.js` exports: `getStoredToken()` (returns the token string or `null`; returns `null` if
`localStorage.getItem` throws, never propagating the throw), `setAuthToken(token)` (writes to
`localStorage`; if `localStorage.setItem` throws — e.g. quota exceeded or storage disabled —
returns/throws a caught, readable error rather than an uncaught exception), `clearAuthToken()`
(removes the token key), and `registerUnauthorizedHandler(callback)` (registers a callback that
the response interceptor invokes on any `401`, but only if `getStoredToken()` is still non-null at
that moment, preventing a duplicate redirect once the token has already been cleared). The request
interceptor reads `getStoredToken()` on every outgoing call and attaches
`Authorization: Bearer <token>` when present; it attaches nothing when absent (no empty header).

**AUTH-04-FR-3** — `App.jsx` auth-state shape and `sessionExpiredMessage` contract *(extends AC
#1/#3/#4 with: the corrected, locked state shape — supersedes any `authError`/`setAuthError`
wording in prior drafts)*

`App.jsx` holds `const [isAuthenticated, setIsAuthenticated] = useState(() =>
Boolean(userApi.getStoredToken()))` — a plain boolean, never `null`/loading — and a separate
`const [sessionExpiredMessage, setSessionExpiredMessage] = useState(null)` (`string | null`). On
mount, if a token exists but is expired per FR-1, `setIsAuthenticated(false)` and
`setSessionExpiredMessage("Your session has expired. Please log in again.")` are both called
before first render of any protected view. `registerUnauthorizedHandler` is wired on mount to the
same two setters. `sessionExpiredMessage` is passed to `LoginScreen` as the `sessionExpiredMessage`
prop, per `docs/features/AUTH-01/REQUIREMENTS.md`'s locked contract — `App.jsx` never passes an
`authError` prop, and never conflates `sessionExpiredMessage` with `LoginScreen`'s own internal
submit-error state. On successful login (`LoginScreen`'s `onLoginSuccess(token)` callback),
`App.jsx` calls `setIsAuthenticated(true)` and `setSessionExpiredMessage(null)`.

**AUTH-04-FR-4** — 401 handling does not double-trigger *(extends AC #4 with: the exact
de-duplication mechanism for condition C-1)*

The response interceptor's `401` branch calls `clearAuthToken()` then invokes the registered
unauthorized handler exactly once per distinct session-expiry event; if `getStoredToken()` is
already `null` when a `401` arrives (e.g. two in-flight requests both 401 after the first already
cleared the token), the handler is not invoked a second time.

## Non-functional requirements

- Performance: Auth-state check on `App.jsx` mount (token presence + `jwt-decode` expiry check,
  no network round-trip) completes with **p95 < 100ms measured over 100 iterations** in an
  automated micro-benchmark, and runs before the first protected-view data-fetch request
  (`GET /api/dashboard/stats`, `GET /api/users`, etc.) is issued.
- Security: Per `.claude/rules/security-baseline.md`: no password or password hash is persisted
  client-side by this story (AUTH-03 remains sole owner of credential hashing); the JWT is stored
  in `localStorage` and is readable by any script running on the page (XSS exposure) — this is a
  documented, accepted tradeoff for a desktop-only internal admin tool with no regulated data and
  no CSP hardening in place today; CSP hardening is out of scope and deferred to a future
  security-hardening story. `jwt-decode` (~2KB, no dependencies) is added to `package.json`;
  client-side decode performs no signature verification (server re-validates every call).
- Accessibility: Per `.claude/rules/accessibility-baseline.md`: this story does not own new UI
  surfaces (Login rendering belongs to AUTH-01); its sole accessibility obligation is supplying a
  correct `sessionExpiredMessage` string value so that AUTH-01's `LoginScreen` can render it in an
  `aria-live` region as already specified in `docs/features/AUTH-01/REQUIREMENTS.md`.
- Observability: On 401 detection or on-mount expiry detection, a client-side event
  `auth_session_expired` is logged (e.g. `console.log("auth_session_expired")`) with no token
  value, no email, and no other PII, per `.claude/rules/security-baseline.md`'s no-PII-in-logs
  rule.

## Rollout plan

- **Strategy**: bang-bang — the interceptor and state changes are additive to `userApi.js` and
  `App.jsx`; there is no existing auth gate to migrate away from, and the change is trivial to
  disable.
- **Feature flag**: none — auth-state gating is a correctness requirement (AC2), not a
  progressively-rolled-out behavior change.
- **Backout plan**: revert the `userApi.js` interceptor additions and the `App.jsx`
  `isAuthenticated`/`sessionExpiredMessage` state changes; no data migration or schema change is
  involved (`localStorage` key is additive, non-destructive to remove).
- **Success signal**: all AUTH-04 test cases pass in CI (`npm run test`), and the mount-to-auth-
  state-set micro-benchmark reports p95 < 100ms.

## Documentation requirements

- **README updates**: `README.md` § 11 (CRUD Usage) should note that the dashboard now requires
  authentication and that sessions persist for 60 minutes across refresh (deferred to AUTH-05,
  which wires the full gate into the UI — this story alone has no user-visible entry point yet).
- **Runbook**: none.
- **API reference**: none — this story introduces no new backend endpoint; it consumes AUTH-02's
  existing `/api/auth/login` response shape.
- **Inline code comments**: `userApi.js` interceptor block should carry a one-line comment noting
  the de-duplication guard (`registerUnauthorizedHandler` only fires when a token was present) and
  why (prevents double-redirect per condition C-1).
- **Examples / how-to**: none.

## Open questions

(none — story Clarifications section is empty, and research's Clarifications section is empty;
zero unresolved markers.)

Decisions logged in `docs/stories/AUTH-04.md` § Decision log.

## Approvals

**APPROVED** — 2026-08-17, reviewer: yaswanth.panthangi@apexon.com
  - Feature Summary, FRs, User Flows reviewed
  - UI specs reviewed in `DESIGN.md`: N/A (`design = n/a`, `integrations.design = none`)
  - Edge Cases, Open Questions, test-case completeness reviewed
  - No-placeholder check done · `[NEEDS CLARIFICATION]` count=0
  - Research verdict GO-WITH-CONDITIONS (all 10 conditions addressed above)
  - Tracker subtask: n/a (issue tracker = none)
