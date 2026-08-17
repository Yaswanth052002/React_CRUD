# Research Assessment: AUTH-07 — Logout and session/token invalidation

**Story**: AUTH-07  
**Epic**: AUTH  
**Phase**: Research  
**Assessment date**: 2026-08-17  
**Assessor**: Claude Research Agent

---

## Upstream dependencies

Per story Dependencies section (refreshed):
- **Upstream**: AUTH-04 (authentication state management and persistence; defines the JWT token storage key, axios interceptor pattern, and 401 redirect mechanism this story will reuse to clear state and trigger redirect). AUTH-06 (Settings screen; owns the Logout button UI that invokes AUTH-07's logout flow). AUTH-05 (routing for authenticated/unauthenticated views; the logout redirect to Login is enforced by AUTH-05's auth-state-gated rendering).
- **Downstream**: None (logout is a leaf operation in the AUTH epic).

Prior research state (from `docs/state/features.json`):
- AUTH-07 is story-validated, P1, independent_test=true, needs_clarification_count=0. Gate is clear to proceed to research.
- AUTH-04 research is complete, verdict GO-WITH-CONDITIONS (87/100). Key deliverables: (1) axios interceptor pattern in userApi.js (request interceptor attaches Authorization header if token exists; response interceptor handles 401 and triggers redirect callback); (2) setAuthToken(token), clearAuthToken(), getAuthToken() functions exported; (3) Login component redirects on auth failure; (4) App.jsx manages isAuthenticated state with callback from interceptor.
- AUTH-05 and AUTH-06 research pending (AUTH-07 is in this research batch), but story dependencies are clear: AUTH-05 owns the conditional rendering of Login vs protected views, AUTH-06 owns the Settings screen button, AUTH-07 owns the logout flow logic itself.

---

## Exploration Log

### Frontend axios client and interceptor pattern (AUTH-04 foundation)
- **Where**: `frontend/src/services/userApi.js:1-95`
- **What**: Axios client instance created with baseURL and timeout. Error normalization via `normalizeError()` for network errors. Current exports: getUsers, getUser, createUser, updateUser, deleteUser, getDashboardStats. Per AUTH-04 research (lines 93-101): request interceptor will attach `Authorization: Bearer <token>` if token exists; response interceptor will detect 401, clear token, trigger callback. Exports from AUTH-04: setAuthToken(token), clearAuthToken(), getAuthToken(), setAuthExpiredCallback(callback).
- **Surprises**: None. AUTH-04 has already mapped out the exact interceptor locations and exports.
- **Open**: AUTH-07's logout() function will call clearAuthToken() and setAuthExpiredCallback's callback (or a separate logout callback) to trigger the same redirect flow as 401 would.

### Frontend auth state and redirect routing (AUTH-04 + AUTH-05)
- **Where**: `frontend/src/App.jsx:36-65` (current); `frontend/src/App.jsx` (AUTH-04 post-implementation will add isAuthenticated state + conditional render Login vs protected views)
- **What**: App.jsx will manage isAuthenticated state (per AUTH-04 research). AUTH-05 research will add conditional rendering: if isAuthenticated=false, render Login only; if isAuthenticated=true, render Sidebar + activeView (Dashboard/Users/Settings). Logout will call clearAuthToken() + setIsAuthenticated(false) to trigger the Login render.
- **Surprises**: None. Pattern is clear from AUTH-04 and AUTH-05 research.
- **Open**: Implementation detail: is auth state cleared synchronously or asynchronously? Per AUTH-04 research line 106, setAuthToken/clearAuthToken are synchronous (localStorage write). Redirect is thus synchronous (state set immediately, re-render to Login follows). No delay or loading spinner needed.

### Settings screen logout button (AUTH-06 foundation)
- **Where**: `frontend/src/App.jsx:7-34` (SettingsPlaceholder); `docs/stories/AUTH-06.md` (Dependencies, AC4)
- **What**: AUTH-06 story AC4 specifies: "Given the authenticated user clicks 'Logout' on the Settings screen, when the action is triggered, then the app-level logout flow defined in AUTH-07 is invoked." AUTH-06 will replace SettingsPlaceholder with a real Settings component (auth-06/Settings.jsx). This component will have a Logout button that calls a logout() function (exported from userApi.js by AUTH-07). The button's onClick handler will call logout().
- **Surprises**: None. AUTH-06 owns the UI button; AUTH-07 owns the logout logic.
- **Open**: None. Pattern is clear.

### Browser storage and token persistence
- **Where**: Browser localStorage API; AUTH-04 research line 65-68 mentions "localStorage" as the storage mechanism. Decision log in AUTH-04 story (line 147) confirms "token is stored in localStorage; check on mount is a synchronous lookup + JWT expiry timestamp comparison".
- **What**: localStorage key name is TBD in AUTH-04 research (research lines 93-101 don't specify it, but story AC2 line 19 says "the client-side JWT access token is removed from localStorage"). Typical convention: `auth_token` or `token`. Decision: assume AUTH-04 PLAN.md specifies the key name (e.g., `auth_token`). AUTH-07 logout() will call localStorage.removeItem(key) to clear it (already wrapped by clearAuthToken()).
- **Surprises**: None. localStorage is a standard Web API, widely available.
- **Open**: AUTH-04 PLAN.md must specify the exact localStorage key name so AUTH-07 can reference it in unit tests.

### Error handling and edge cases
- **Where**: `frontend/src/services/userApi.js:15-35` (normalizeError function); project rule `.claude/rules/security-baseline.md` (no logging of tokens/PII).
- **What**: After logout, subsequent API calls will include no Authorization header (cleared by clearAuthToken). If a request is already in flight when logout is called, it will either complete with the old token (unlikely if logout is quick) or the backend will return 401, triggering the 401 handler again (harmless, idempotent). localStorage.removeItem() will never throw (removing a non-existent key is a no-op). Edge case: user clicks logout twice in rapid succession — second call should be a no-op (token already cleared).
- **Surprises**: None. Behavior is standard SPA logout pattern.
- **Open**: None. Edge cases are straightforward.

### Accessibility and observability
- **Where**: Story NFR section (lines 26-28); `.claude/rules/security-baseline.md` (no token/PII logging); `.claude/rules/accessibility-baseline.md` (keyboard-operable logout control).
- **What**: (1) Logout button (owned by AUTH-06) must be keyboard-operable and have visible focus state. (2) Logout event logging: story line 28 specifies "log a `logout` event (user id, timestamp, outcome) client-side/analytics only; no server-side invalidation call exists to log against. Do not log token values." Per security-baseline, logout is a non-PII event (no email, token, or session id in logs).
- **Surprises**: None. Constraints are clear.
- **Open**: None. Implementation detail: log event is a simple console.log or future analytics call; out of scope for AUTH-07's core logout logic (can be deferred or added as a simple instrumentation line).

---

## Pattern map

### Existing code to extend

- **`frontend/src/services/userApi.js`** — Add (per AUTH-04 research, now extended for AUTH-07):
  - Export `logout()` function (no arguments). Body: (1) call `clearAuthToken()` (removes token from localStorage, clears axios Authorization header default); (2) optionally call a logout callback if registered (or directly call App.jsx's setIsAuthenticated(false), but this tightly couples HTTP layer to UI state, so callback is better); (3) return Promise.resolve (synchronous operation, no async work).
  - Decision: logout() is synchronous. It does not make a server-side call (no `/api/auth/logout` endpoint, per story line 19-20 "no server-side call required"). clearAuthToken() (already added by AUTH-04) handles the token removal; logout() calls it and triggers the auth-state callback that App.jsx registered.

- **`frontend/src/App.jsx`** (per AUTH-04, now extended by AUTH-05 and AUTH-07):
  - Register a logout callback on mount (same pattern as 401 callback per AUTH-04 research line 107): `setLogoutCallback(() => { setIsAuthenticated(false); })` (or consolidate both callbacks if they do the same thing).
  - When logout() is called from Settings screen, the callback will fire, setIsAuthenticated(false) will execute, and the conditional render in App.jsx (from AUTH-05) will show Login instead of protected views.

- **`frontend/src/pages/Settings.jsx`** (added by AUTH-06, wired by AUTH-07):
  - Logout button's onClick handler will call `logout()` from userApi.js.
  - No loading state needed (logout is instant, <1ms). No error state needed (logout cannot fail; it's local-only).

### Existing patterns to follow

- **Callback-based auth-state signaling** (per AUTH-04 research line 74-75): response interceptor uses a callback to decouple HTTP layer from UI state. Logout will reuse the same callback mechanism (or register its own). This keeps userApi.js agnostic of React state.
- **Synchronous state mutations** (per AUTH-04 research line 106): token check and state updates are synchronous; no loading state between logout click and redirect. Same applies to logout (clearAuthToken is synchronous).
- **Error normalization in userApi.js** (per project CLAUDE.md): all HTTP errors go through normalizeError. Logout has no HTTP step, so no error handling needed in the logout() function itself.
- **No direct React state access from services** (per react-patterns SKILL.md): logout() is in the service layer (userApi.js); it triggers a callback to App.jsx rather than importing React or reaching into App state directly.

### New files to create

- **None**. Logout logic is added to existing userApi.js (service function) and App.jsx (callback registration + state update). The Settings screen component is created by AUTH-06, not AUTH-07; AUTH-07 only wires the button's onClick to call logout().

### Shared code at risk

- **`frontend/src/services/userApi.js` clearAuthToken() function** (added by AUTH-04; called by AUTH-07's logout): clearAuthToken must remove the token from localStorage and update axios default header. Risk: if clearAuthToken has a bug, logout will not fully clear the token, leaving a partial auth state. Mitigation: AUTH-04 PLAN.md must specify clearAuthToken implementation; AUTH-07's unit tests will verify logout() calls clearAuthToken() and that a subsequent API call lacks the Authorization header.
- **`frontend/src/App.jsx` setIsAuthenticated state update** (managed by AUTH-04; triggered by logout callback): Risk: if callback is not called when logout() runs, auth state remains true and user stays on Settings screen. Mitigation: AUTH-07 unit tests verify callback is called when logout() runs, and that setIsAuthenticated(false) causes a redirect to Login (via AUTH-05's conditional render).
- **axios client instance and interceptors** (set up by AUTH-04): if request interceptor breaks, subsequent API calls after logout will fail (expected). If response interceptor breaks, 401 handling will fail (unrelated to logout, but affects the same interceptor chain). Mitigation: AUTH-04's unit tests for interceptors; AUTH-07 reuses the same tested code.

---

## Risk register

| # | Dimension       | Severity | Description                                      | Mitigation                                  |
|---|-----------------|----------|--------------------------------------------------|---------------------------------------------|
| 1 | Integration     | **HIGH** | **Race condition: API request in flight when logout is called**. If an API call is pending and logout clears the token, the request will be sent without Authorization header (if request phase is past the interceptor) or with the old header (if interceptor has already attached it). Backend will return 401 if the request arrives after logout. | Mitigation: (a) This is acceptable behavior for an SPA logout — user expects immediate logout, not "wait for in-flight requests to complete". (b) If request arrives after token is cleared, it gets 401, triggering the 401 handler (which calls the same callback as logout did, idempotent). (c) Test scenario: (i) mock an API call that takes 500ms, call logout while it's in flight, verify token is cleared immediately, verify request completes with old data (or 401 if server rejects), verify auth state is cleared regardless. (d) Document in PLAN.md: "Logout is immediate; in-flight requests may complete with stale tokens or 401s. Both are handled gracefully (idempotent state clear, same callback). No special "cancel all pending requests" logic is needed." |
| 2 | Domain          | **HIGH** | **No server-side session to revoke**. Per story line 20 and AUTH-04 decision (JWT is stateless), there is no server-side session or token-invalidation endpoint. The token remains valid (cryptographically) until its 60-minute TTL expires, even after client-side logout. If a user extracts the token from localStorage after logout and uses it within 60 minutes, the backend will accept it (because the JWT signature is still valid and the exp claim hasn't passed). | Mitigation: (a) This is an accepted tradeoff of stateless JWT (already documented in AUTH-04 research lines 142-146). (b) Documented in story line 20 as "an accepted tradeoff of the stateless-JWT mechanism (already documented in AUTH-04)". (c) For an internal admin tool (not a regulated system), this is acceptable. (d) No code mitigation; this is a policy/architecture decision. (e) If future requirements change (e.g., "admin logout must immediately deny access"), a refresh-token + blacklist would be needed (out of scope for AUTH-07). |
| 3 | Performance     | **HIGH** | **Logout performance target not specified in story**. Story AC1-4 do not include an explicit performance constraint. AUTH-04 story line 89 specifies "< 500ms p95" for logout action completion, but this is part of AUTH-04 (applied to auth-state check), not explicitly repeated in AUTH-07. If logout implementation is slow, user experience degrades (no immediate feedback). | Mitigation: (a) Logout is a pure local operation: localStorage.removeItem (~0.1ms) + axios header clear (~0.1ms) + callback invoke (~0.1ms) = <1ms expected. (b) PLAN.md must specify: "Logout completes synchronously in <10ms (localStorage + header clear + callback). No network call, no delay. Immediate redirect to Login via auth-state re-render." (c) Test: benchmark logout() call over 100 iterations, assert p95 < 10ms. |
| 4 | Integration     | **MED**      | **localStorage unavailable or clear throws**. If localStorage is disabled (rare, but possible in private mode or with certain browser settings) or if removeItem() throws (extremely rare, but possible if quota is exceeded or browser is in a corrupt state), the token may not be cleared. | Mitigation: (a) Wrap localStorage call in try/catch in clearAuthToken() (per AUTH-04 research line 144-145). (b) If removeItem() throws, log a console warning (no PII) and proceed anyway (callback still fires, auth state still clears). (c) Test: mock localStorage.removeItem to throw, verify logout() handles gracefully (callback still fires). |
| 5 | Dependency      | **MED**      | **AUTH-06 Settings screen depends on logout() export from userApi.js**. If AUTH-07 is delayed or changes the logout() signature, AUTH-06 will need to adapt. | Mitigation: (a) This is a normal cross-story dependency. (b) Both stories are in the same research batch; the interface is clear (logout() is a no-arg function). (c) PLAN.md for both stories will lock in the interface. (d) No blocking issue; just normal integration point. |
| 6 | Compatibility   | **MED**      | **logout() behavior differs by browser (localStorage availability)**. Desktop modern browsers (per README target) all support localStorage, so this is low-risk. But if the tool is ever used in a context where localStorage is unavailable, logout would fail to clear the token. | Mitigation: (a) Per README, this is a desktop-only internal admin tool. No mobile, no IE11, no restricted environments. localStorage is guaranteed. (b) If future requirements expand scope, add a fallback to sessionStorage or in-memory storage. (c) For now, no special handling needed. |
| 7 | Dependency      | **LOW**      | **AUTH-04's clearAuthToken() function contract**. If AUTH-04 PLAN.md changes the function signature or location, AUTH-07 will break. | Mitigation: (a) clearAuthToken() is a straightforward function (no args, returns void or Promise.resolve). (b) Both stories are co-owned by Frontend lead; function is stable. (c) Unit tests for logout() will verify clearAuthToken() is called. (d) No blocking issue. |
| 8 | Domain          | **LOW**      | **Logout idempotency**. If user clicks logout twice (e.g., double-click or network delay impression), does logout() handle it gracefully? | Mitigation: (a) localStorage.removeItem(key) is idempotent (removing a non-existent key is a no-op). (b) clearAuthToken() removes the key; second call removes nothing (safe). (c) Callback fires twice (both call setIsAuthenticated(false), idempotent). (d) No error or side effect. (e) Test: call logout() twice in rapid succession, verify no errors. |

---

## Score + verdict

### 5-dimensional rubric

| Dimension       | Weight | Pass criterion                                                              | Finding                                                                   | Score |
|---|---|---|---|---|
| Integration     | 25     | All upstream dependencies available; failure modes well understood          | AUTH-04 (GO-WITH-CONDITIONS, 87/100) provides clearAuthToken, auth callback mechanism. AUTH-06 and AUTH-05 research pending but dependencies are clear (Settings button → logout() → callback → Auth state update → redirect). No blocking dependencies. Race condition (Risk #1) is understood and acceptable. No server-side work needed. localStorage unavailability (Risk #4) is rare for target platform (desktop modern browsers). Integration is straightforward: logout() calls clearAuthToken() + triggers callback. | 85    |
| Compatibility   | 20     | Backward compat plan exists for each affected client/version                | **No breaking changes**. logout() is a new function in userApi.js; existing exports (getUsers, createUser, etc.) unchanged. **Frontend changes**: Settings screen (AUTH-06) gets logout button; existing Dashboard/Users/Settings views are unaffected. **Browser compatibility**: localStorage is widely available in all modern browsers (no IE11 support needed per README desktop-only target). **No version migration needed**. Backward-compatible addition only. | 90    |
| Domain          | 20     | Edge cases enumerated; no hidden invariants surfaced during scan            | **AC1 (logout clears token)**: logout() calls clearAuthToken() ✓. **AC2 (axios header cleared)**: clearAuthToken() clears Authorization header default ✓ (per AUTH-04 research). **AC3 (redirect to Login)**: callback sets isAuthenticated(false), AUTH-05 re-renders Login ✓. **AC4 (subsequent protected-route access rejected)**: after logout, no token → API calls lack header → backend returns 401 → 401 handler redirects to Login again ✓. **NFR (no server-side call)**: logout is local-only, no HTTP endpoint ✓. **NFR (security: no residual artifacts)**: localStorage.removeItem removes token, axios default header cleared, auth state cleared ✓. **Edge cases**: (i) logout called while request in flight → acceptable (request gets 401 or completes stale, both handled). (ii) logout called twice → idempotent (removeItem on non-existent key is no-op, callback fires twice but same result). (iii) localStorage unavailable → rare, handled by try/catch in clearAuthToken. (iv) callback not registered → callback fires but does nothing (harmless, though Settings button click would not redirect). All enumerated, no surprises. | 85    |
| Performance     | 15     | Story has explicit perf budget; estimated work fits within budget           | **Explicit perf budget**: Story line 25 mentions "logout action ... completes and redirects to Login within 500ms p95 under normal network conditions" (part of AUTH-04, applies here too). Logout is a local operation: localStorage.removeItem + axios header clear + callback invoke = <1ms expected, well within 500ms budget. **Implementation work**: ~5-10 lines (logout() function) + ~2 lines (callback registration in App.jsx) + ~5 lines (Settings button onClick handler). Fits within typical story scope. **Benchmarking**: PLAN.md will specify test to measure logout() latency. Expected p95 <10ms. | 95    |
| Dependency      | 20     | All upstream stories complete; no blocking external work                    | **Upstream**: AUTH-04 research complete (GO-WITH-CONDITIONS), clearAuthToken() mapped out. AUTH-06 research pending (but story is in this batch); Settings screen story owns button UI, AUTH-07 owns logout logic (clear interface). AUTH-05 research pending (but story is in this batch); nav routing is independent (owns conditional render, AUTH-07 owns state trigger). **No blocking external work.** Both upstream research are in-progress or complete. Design surface is clear (Settings button → logout() function → callback → state update → redirect). | 90    |

**Total: (85×0.25 + 90×0.20 + 85×0.20 + 95×0.15 + 90×0.20) = 21.25 + 18 + 17 + 14.25 + 18 = 88.5/100**

### **Total: 89/100 → GO-WITH-CONDITIONS**

No single dimension scores below 40. All dimensions are strong (85+), reflecting the straightforward, local-only nature of logout. Integration (85) reflects two manageable HIGH-severity risks (race condition on in-flight requests, stateless JWT means token remains valid until TTL). Both are accepted tradeoffs of SPA architecture and the JWT mechanism (already documented in AUTH-04). Performance (95) is excellent: logout is a <1ms local operation. Dependency (90) is strong: upstream stories are complete or in-progress with clear contracts. Compatibility (90) and Domain (85) are sound: no breaking changes, all edge cases understood.

The conditions below must be explicitly addressed in PLAN.md before implementation.

### Conditions

The following conditions must be explicitly addressed in PLAN.md before implementation:

1. **logout() function signature and location (Integration, RESOLVED)**: locked cross-story contract — `logout()` is exported from `frontend/src/services/userApi.js`, synchronous (`function logout(): void`, no arguments), and calls `clearAuthToken()` (AUTH-04's export) only — no backend call. PLAN.md restates this for implementer reference. Test: unit test `logout()`, verify `clearAuthToken()` is called exactly once.

2. **logout callback registration in App.jsx (Integration, RESOLVED)**: locked cross-story contract — App.jsx registers via `userApi.registerUnauthorizedHandler(() => setIsAuthenticated(false))` on mount (AUTH-04's exact export name, not a separate `setLogoutCallback`). Logout does not register a second, distinct callback — `props.onLogout()` (threaded down to Settings, per AUTH-06's contract) directly calls the same `setIsAuthenticated(false)` App.jsx already exposes; no shared-callback-with-401 mechanism is needed since logout's `onLogout` prop and the 401 handler both just flip the same boolean. Test: click Settings' Logout button, verify `props.onLogout()` fires and `isAuthenticated` becomes `false`.

3. **Settings screen logout button onClick handler (Integration, RESOLVED)**: locked cross-story contract (per AUTH-06's approved PRD) — Settings' Logout button calls `userApi.logout()` then `props.onLogout()`, in that order, no loading state, no error handling (logout cannot fail). PLAN.md restates this for implementer reference.

4. **Race condition acceptance** (Integration, Domain): PLAN.md must document: (a) "If an API call is in flight when logout is called, the request will arrive at the backend after the token is cleared on the client. The backend will return 401 (token is missing from request header), triggering the 401 handler. Both logout and 401 call the same callback (idempotent), clearing auth state and redirecting to Login. In-flight requests do not delay logout; immediate redirect is the expected behavior." (b) Test scenario: mock an API call with a 500ms delay, call logout while it's in flight, verify token is cleared immediately (logout returns synchronously), verify auth state is cleared, verify redirect to Login happens before the request completes.

5. **Stateless JWT token validity after logout** (Domain, Security): PLAN.md must document: (a) "Per story line 20 and AUTH-04's JWT mechanism, the token remains cryptographically valid until its 60-minute TTL expires, even after client-side logout. If an attacker extracts a logged-out user's token and re-uses it within 60 minutes, the backend will accept it (JWT signature is still valid, exp claim hasn't passed). This is an accepted tradeoff of stateless JWT. No server-side token revocation/blacklist is implemented in AUTH-07." (b) Document in story's Mechanism section (already present in story line 26-27). No additional code; this is a policy/architecture note.

6. **Performance benchmark** (Performance): PLAN.md must specify: (a) Frontend tests include a micro-benchmark for logout() latency. (b) Call logout() 100+ times in a loop, measure time for each call, compute p95 latency. (c) Assert p95 < 10ms (expected <1ms typical). Expected result: pass easily (logout is a few synchronous operations: localStorage.removeItem, axios.defaults.headers.common assignment, callback invoke). (d) If benchmark exceeds 10ms, investigate (unlikely; no I/O or async work). Test file: `frontend/src/services/__tests__/userApi.test.js` (or extend existing tests if created by AUTH-04).

7. **localStorage.removeItem error handling** (Compatibility, Robustness): PLAN.md must specify: (a) clearAuthToken() (added by AUTH-04, called by logout()) wraps localStorage.removeItem in try/catch. (b) If removeItem throws (extremely rare; e.g., quota exceeded, browser corruption), log a console warning: "Warning: failed to clear auth token from localStorage" (no PII). (c) Proceed anyway: callback still fires, auth state still clears, redirect still happens. Token is not cleared from storage, but auth state is cleared, so subsequent API calls lack the header (401 handler will redirect again). (d) Test: mock localStorage.removeItem to throw, verify logout() completes without error, verify callback still fires.

8. **Logout idempotency** (Domain): PLAN.md must specify: (a) Logout is idempotent: calling logout() twice in rapid succession (e.g., double-click, network delay impression) is safe. (b) localStorage.removeItem(key) removes the key if present, no-op if absent (idempotent). (c) clearAuthToken() calls removeItem; second call removes nothing. (d) Callback fires twice; both calls to setIsAuthenticated(false) are idempotent. (e) No side effects, no errors. Test: call logout() twice in rapid succession, verify no errors, verify auth state is cleared, verify one redirect happens (or two, idempotent).

9. **Observability: logout event logging (Observability, Security, RESOLVED)**: corrected per story Decision log — no `user_id` is logged, since no user identifier is available client-side under AUTH-04's locked contract (`GET /api/auth/me` excludes `id`; the JWT is decoded only for its `exp` claim). The logout event logs event name + timestamp only: `console.log("auth:logout", { timestamp: new Date().toISOString() })`, mirroring AUTH-04's own `auth_session_expired` event precedent. Test: call `logout()`, capture console output, verify the event is logged with a timestamp only, no identifiers.

10. **Clarity on localStorage key name (Integration, RESOLVED)**: locked cross-story contract — AUTH-04 uses `localStorage` key `auth_token`. AUTH-07's tests verify this exact key is removed after logout.

---

## Synthesis

**AUTH-07 is feasible for planning and implementation with documented conditions; the mechanism is straightforward and all upstream dependencies are either complete or have clear interfaces.**

This story delivers a pure client-side logout operation grounded in the JWT token storage and axios interceptor pattern defined by AUTH-04. The logout flow is simple: clear the token from localStorage (via clearAuthToken), trigger the same callback that 401 handling uses (to decouple HTTP layer from auth state), and let AUTH-05's conditional render show the Login screen when isAuthenticated becomes false. The story has zero server-side work—no logout endpoint, no session revocation, no blacklist. This is consistent with AUTH-04's decision to use stateless JWT, where the token's validity is determined solely by its cryptographic signature and expiry timestamp.

The single biggest risk is a race condition where an API call is in flight when logout is called; the backend will receive the request without an Authorization header (or with an old header if the request phase is past the interceptor) and will return 401. This is acceptable and handled gracefully—the same 401 handler that processes a normal session-expiry will re-trigger the redirect to Login. The second-biggest risk is the stateless JWT's inherent limitation: a logged-out user's token remains valid until the 60-minute TTL expires, even after client-side logout. This is an accepted tradeoff already documented in AUTH-04 research and the story itself.

Implementation is minimal: export a logout() function from userApi.js (calls clearAuthToken and triggers callback), register the callback in App.jsx, and wire the Settings screen logout button to call logout(). No new components or files are needed beyond what AUTH-06 adds (Settings screen). Performance is not a concern—logout is a <1ms local operation, well within the 500ms budget mentioned in story line 25. Compatibility is strong: no breaking changes, backward-compatible addition. All edge cases are enumerated: in-flight requests, double-click, localStorage unavailability, callback not registered.

Key implementation decisions now resolved: (1) logout() is synchronous (no async work, token clear is immediate), (2) callback-based auth-state signaling reuses AUTH-04's pattern (loose coupling), (3) no error state or loading spinner (logout cannot fail), (4) idempotent operation (safe to call multiple times).

---

## Clarifications

(none — all resolved; see cross-story auth contract decisions applied 2026-08-17.)

