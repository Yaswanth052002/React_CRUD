# Research Assessment: AUTH-04 — Authentication state management and persistence across page refresh

**Story**: AUTH-04  
**Epic**: AUTH  
**Phase**: Research  
**Assessment date**: 2026-08-17  
**Assessor**: Claude Research Agent

---

## Upstream dependencies

Per story Dependencies section (refreshed):
- **Upstream**: AUTH-02 (existing-user authentication and credential validation — issues the JWT token this story persists and consumes on 401). AUTH-03 (password security/hashing — this story's server-side dependency, must not contradict server-side-only credential storage).
- **Informational (not gating)**: AUTH-08 (docker/deployment CORS configuration) — implements env/CORS config for the JWT-bearer mechanism, but does not gate AUTH-04's research/planning.
- **Downstream**: AUTH-05 (navigation must consult auth state to decide reachable views), AUTH-06 (Settings screen displays user info from auth state), AUTH-07 (logout clears the localStorage key this story defines).

Prior research state (from `docs/state/features.json`):
- AUTH-04 is story-validated, P1, independent_test=true, needs_clarification_count=0. Gate is clear to proceed to research.
- AUTH-02 research is complete, verdict GO-WITH-CONDITIONS (conditions documented in `docs/research/AUTH-02.md`). Login endpoint returns `{token: str}` per Decision log (line 147).
- AUTH-03 research is complete, verdict GO-WITH-CONDITIONS (password hashing via passlib[bcrypt]; hash-verify interface defined).
- Mechanism is already decided in the story (JWT bearer token in localStorage, axios interceptor, 60-minute TTL).

---

## Exploration Log

### Frontend entry point: App.jsx and current view-routing logic
- **Where**: `frontend/src/App.jsx:36-65`
- **What**: App.jsx is the root component. It uses a single `activeView` state variable (values: "dashboard" | "users" | "settings") to conditionally render the active view. No router library (no react-router). No authentication check on mount. Navigation is via `setActiveView` callback passed to Sidebar.
- **Surprises**: None — story explicitly mentions no router library and conditional rendering via state. This is the expected pattern for this repo.
- **Open**: How to inject auth state check before rendering protected views? Mechanism: check token on mount in a useEffect, set an isAuthenticated state, conditionally render Login component if auth state fails. Decision: add auth state to App.jsx at the same level as activeView.

### Frontend HTTP layer: userApi.js and axios client
- **Where**: `frontend/src/services/userApi.js:1-95`
- **What**: Exports an axios client (`client`) and async functions for CRUD operations (getUsers, getUser, createUser, updateUser, deleteUser, getDashboardStats). All HTTP calls go through `client` — no direct axios calls in components. Error normalization via `normalizeError()` function (lines 15-35) converts axios errors to plain Error objects. Client is created with baseURL from env var (VITE_API_URL, defaults to http://localhost:8000) and a 10-second timeout.
- **Surprises**: None — project convention per CLAUDE.md: "Components never call Axios directly — every HTTP call goes through `frontend/src/services/userApi.js`."
- **Open**: Where to add the axios request interceptor (to attach Authorization header) and response interceptor (to handle 401)? Decision: both interceptors are added in this file, on the `client` instance, lines TBD (as part of implementation). Exports: `setAuthToken(token)` and `clearAuthToken()` functions to manage the stored token, and `getAuthToken()` to retrieve it. 401 handler detects expired/invalid tokens and signals App.jsx to redirect to Login.

### Frontend components: no Login component exists yet
- **Where**: `frontend/src/components/`
- **What**: 11 components exist (Sidebar, Header, Dashboard, Users, UserTable, UserForm, Modal, Notification, etc.). No Login component.
- **Surprises**: None — AUTH-01 story (login screen UI) is a separate story. AUTH-04 requires a Login component to render when auth state is falsy, but does not own its implementation (AUTH-01 does). Decision: AUTH-04's scope includes a minimal login form in a new frontend/src/components/Login.jsx (email + password + submit button), per story AC2/AC3 redirect behavior. Full password validation and polish are AUTH-01's responsibility; AUTH-04 provides the bare minimum to support token acquisition and testing.
- **Open**: None — pattern is clear.

### Backend: no auth endpoints exist yet
- **Where**: `backend/app/api/`, `backend/app/services/`
- **What**: Current API routes (users.py) handle CRUD on users. No auth endpoints (/api/auth/login, etc.). No JWT utilities (no PyJWT, no token generation). These are AUTH-02's responsibility.
- **Surprises**: None — AUTH-02 adds the login endpoint. AUTH-04 consumes the response (token field).
- **Open**: None — AUTH-02 is a clear dependency; AUTH-04 only requires AUTH-02's output contract (200 response with {token: str}).

### Backend: CORS and cross-origin configuration
- **Where**: `backend/app/main.py:1-79`
- **What**: FastAPI app with CORS configured. Lines 1-25: imports, logger setup, engine/session. Lines 26-43: CORS middleware configuration reading CORS_ORIGINS from env (comma-separated list). Line 44: create_all() on startup. Lines 45-79: error handlers and router includes. CORS is already present; no additional cross-origin config needed for bearer tokens (unlike cookies, which require SameSite/Secure/withCredentials complexity).
- **Surprises**: None — CORS is already configured, simplifying the bearer-token setup.
- **Open**: None — no backend changes needed for bearer-token CORS; cookies would require AUTH-08 work (per story Mechanism section, line 36-40).

### Docker deployment topology: separate frontend and backend containers
- **Where**: `docker-compose.yml:1-17`
- **What**: Two services: `backend` (port 8000) and `frontend` (port 5173 in the container, mapped to 80). They are separate containers, confirming the cross-origin topology. Frontend talks to backend at http://localhost:8000 (or via environment variable in production).
- **Surprises**: None — story explicitly mentions docker-compose topology and uses this as justification for bearer tokens over cookies.
- **Open**: None — this confirms the mechanism choice is sound for the deployment topology.

### localStorage and token expiry checking
- **Where**: Browser Web Storage API (not yet in code, but story NFR line 89 specifies)
- **What**: Story NFR: "Auth-state check on app mount is synchronous (local token presence/expiry check, no network round-trip) and completes in **< 100ms**". Decision: token is stored in localStorage; check on mount is a synchronous lookup + JWT expiry timestamp comparison (no server roundtrip). Use `jwt-decode` library (lightweight, no verification needed on client, only timestamp check) to extract exp claim and compare to current time.
- **Surprises**: None — this is a standard SPA pattern.
- **Open**: `jwt-decode` library needs to be added to package.json. Lightweight (~2KB minified), zero dependencies, stable package.

### Error handling: normalizeError extension for 401
- **Where**: `frontend/src/services/userApi.js:15-35`
- **What**: Currently handles ECONNABORTED (timeout), no-response (server down), 404, 500+, and fallback. Missing: 401 handling.
- **Surprises**: None — 401 needs special handling (not a user-facing error message, but a signal to redirect to Login).
- **Open**: How to signal 401 to App.jsx without throwing an error? Mechanism: response interceptor detects 401, clears token, emits a custom event or callback that App.jsx listens to. Alternatively, throw a custom error type (e.g., `UnauthorizedError`) that normalizeError catches and re-throws (letting App.jsx catch it at the component level). Decision: use a callback-based approach (export `setAuthExpiredCallback()` function in userApi.js; response interceptor calls it on 401). This keeps the HTTP layer loosely coupled from the auth state logic.

### Accessibility: focus management on redirect to Login
- **Where**: Story NFR section, lines 96-100
- **What**: "On redirect, focus moves to the first focusable element of the Login form (matching the "default focus on open" pattern for modal-like transitions), and the transition respects `prefers-reduced-motion`". Per `.claude/rules/accessibility-baseline.md`: modal/dialog-like transitions need focus trap and default focus on first interactive element.
- **Surprises**: None — rule is clear.
- **Open**: Implementation detail: Login.jsx will have an initial useEffect that calls focus() on the first input field (email or password). No animation is added in this story (keep it minimal for Auth-04; animation could be future polish). The `prefers-reduced-motion` rule applies if Auth-04 adds any transition.

### Observability: session-expiry logging
- **Where**: Story NFR section, lines 101-103
- **What**: "Session-expiry-triggered redirects are logged client-side only as an opaque event (e.g. `auth_session_expired`) with no token value, no email, and no other PII".
- **Surprises**: None — security-baseline compliant.
- **Open**: Implementation: when 401 is detected or token is expired on mount, log a client-side event (via console.log or a future analytics integration) with the event name only, no context.

---

## Pattern map

### Existing code to extend
- **`frontend/src/services/userApi.js`** — Add:
  - Request interceptor: attaches `Authorization: Bearer <token>` header if a token is stored in localStorage.
  - Response interceptor: detects 401 status, clears stored token, triggers a callback to signal App.jsx to redirect to Login. Does not throw; normalizeError handles the rest.
  - Export `setAuthToken(token)` — stores token in localStorage and updates interceptor context.
  - Export `clearAuthToken()` — removes token from localStorage.
  - Export `getAuthToken()` — retrieves token from localStorage; returns null if absent.
  - Export `setAuthExpiredCallback(callback)` — registers a callback that response interceptor calls on 401. Callback receives no args; just signals that auth has failed.
  - Export `login(email, password)` — calls POST /api/auth/login (endpoint added by AUTH-02), returns {token: str}. Caller (App.jsx) will call `setAuthToken(token)` on success.
  - Update `normalizeError()` to not treat 401 as a generic error; response interceptor has already cleared the token and triggered the callback.

- **`frontend/src/App.jsx`** — Add:
  - New state: `isAuthenticated` (bool), initialized to null (unknown) on mount.
  - New state: `authError` (string or null) for session-expired error message shown to Login form.
  - useEffect on mount: synchronously check for token in localStorage, decode exp claim, set isAuthenticated = (token exists AND exp > now). If token exists but is expired, set isAuthenticated = false and authError = "Your session has expired. Please log in again." Timing: target < 100ms.
  - Register auth-expired callback with userApi.setAuthExpiredCallback(() => { setIsAuthenticated(false); setAuthError("Your session has expired. Please log in again."); }) on mount.
  - Conditional render: if isAuthenticated is null, show loading state (or empty div, since check is synchronous and fast). If isAuthenticated is false, render Login component. If isAuthenticated is true, render activeView as today.
  - On successful login (via Login component), call setIsAuthenticated(true), setAuthError(null), setActiveView("dashboard").

### Existing patterns to follow
- **Error normalization in userApi.js** — Keep the existing normalizeError pattern for network errors. Extend it with a check for 401 (but response interceptor has already handled the signal; normalizeError just converts to a plain Error with a generic message, never exposing the 401 as user-facing).
- **Conditional rendering in App.jsx** — Follow the existing pattern of checking a state variable (isAuthenticated) and rendering different components. Same as activeView today.
- **Service-layer HTTP calls** — All auth-related calls (login, token retrieval) go through userApi.js, not directly in App.jsx. App.jsx calls userApi.login(), not axios.post().
- **Axios interceptor registration** — Interceptors are registered on the client instance in the module where it's created (userApi.js), not in App.jsx or other components. This ensures they apply to all HTTP calls globally.

### New files to create
- **`frontend/src/components/Login.jsx`** — Minimal login form component. Props: (email, password, onSubmit, isLoading, errorMessage). Renders two input fields (email, password), a submit button, and an error message area. Basic client-side validation (non-empty, email format). On mount, focus moves to the first input. No password validation policy (AUTH-01 responsibility). Accessibility: inputs have labels, error message is in aria-live region.
- **`frontend/src/hooks/useAuth.js`** (optional) — Custom hook encapsulating auth state and methods (optional for clarity; can be inlined in App.jsx if simpler). Exports: `useAuth()` → {isAuthenticated, authError, login, logout, setAuthError}. Handles token storage, expiry checking, callback registration. Cleaner than putting all logic in App.jsx.

### Shared code at risk
- **`frontend/src/services/userApi.js` client instance** — Request and response interceptors added here affect all HTTP calls globally. Risk: if interceptor has a bug (e.g., attaches header incorrectly), all API calls fail. Mitigation: unit test the interceptor in isolation (mock axios, verify header is attached and 401 triggers callback).
- **`frontend/src/App.jsx` render logic** — Auth state check must complete before protected-view rendering. Risk: if token check takes > 100ms, a flash of unauth content occurs. Mitigation: keep check synchronous (localStorage + jwt-decode, no network); benchmark in tests.
- **Login state and activeView state in App.jsx** — Changing activeView while isAuthenticated is false should be impossible (Login re-initializes activeView to "dashboard" on successful login). Risk: stale activeView state if logout happens mid-session. Mitigation: on 401 redirect, reset activeView to "dashboard" and re-render Login (safe, user will be on Login form after session expires).

### Architectural decision: token decode and verification
- **Where**: Story NFR line 89 (synchronous token check) and AC2 (render Login immediately if no valid token).
- **What**: Do we verify the token signature on the client (requires public key from backend), or just check expiry (trusts backend's issued token)?
- **Decision**: Check expiry only (extract exp claim from JWT, compare to current time). No signature verification. Rationale: (1) Signature verification requires a public key from the backend (adds a roundtrip or hardcoding). (2) Since this is a bearer token in localStorage, an attacker who can read localStorage can also modify the token to extend expiry (XSS risk is already known and accepted per story line 56-59). (3) Server will re-validate on every API call (401 if expired/invalid); client-side expiry check is a UX optimization (avoid flash, avoid API call with stale token). (4) Trust server to reject invalid tokens; client check is defensive only. Decision: use `jwt-decode` library to extract exp, no signature verification.

---

## Risk register

| # | Dimension       | Severity | Description                                      | Mitigation                                  |
|---|-----------------|----------|--------------------------------------------------|---------------------------------------------|
| 1 | Integration     | **HIGH** | **401 infinite redirect loop**. If response interceptor always clears token and triggers redirect on 401, and Login component calls a protected endpoint on mount (e.g., fetching user profile to populate form), the 401 will redirect back to Login, creating a loop. | Mitigation: (a) Login component must not fetch protected endpoints while unauthenticated. (b) Auth-state mutation (setAuthToken) must happen BEFORE the first protected call after login succeeds. (c) Response interceptor does NOT re-trigger callback if token is already null (check localStorage before signaling). (d) Test: simulate 401 on a protected call, verify redirect happens once (no loop), verify token is cleared exactly once. |
| 2 | Performance     | **HIGH** | **Token expiry check on mount exceeds 100ms budget**. Story AC2 (NFR line 89) requires check to complete in < 100ms. If jwt-decode or localStorage access is slow, this fails. | Mitigation: (a) jwt-decode is ~2KB, synchronous, no network; typical decode time <1ms for a token. (b) localStorage is synchronous native API. (c) Benchmark: measure time from App.jsx mount to isAuthenticated state set; target < 5ms (well below 100ms budget). Test asserts p95 latency < 100ms over 100 iterations. (d) If benchmark fails (unlikely), profile to identify bottleneck. (e) Fallback: if benchmark shows >50ms, move token check to a web worker (unlikely needed; out of scope). |
| 3 | Dependency      | **Resolved** | **AUTH-02 login endpoint contract includes token field**. Story AC1/AC5 assume successful login returns {token: str}. This is now locked in: `userApi.login(email, password)` calls `POST /api/auth/login` and resolves to exactly `{ token: string }` on success. | Mitigation: (a) AUTH-02 Decision log (line 147) already states "login endpoint returns `{token: str}`". (b) This shape is now a fixed cross-story contract (see cross-story auth contract decisions, 2026-08-17), so no further verification against a moving target is needed. (c) Unit test: mock userApi.login to return expected shape, verify setAuthToken is called with token value. |
| 4 | Security        | **HIGH** | **XSS: localStorage token readable by any script**. Story line 56-59 acknowledges this as "known, accepted risk for a desktop-only internal admin tool". However, risk is CRITICAL if CSP is not in place. Current repo has no CSP. CSP hardening is explicitly deferred to a future security-hardening story; AUTH-04 does not introduce CSP. | Mitigation: (a) Accept the risk as documented in the story (internal tool, no regulated data, standard SPA pattern). (b) Document in PLAN.md: "Token is stored in localStorage and is readable by inline scripts. CSP hardening (nonce-based inlining, strict-dynamic, etc.) is out of scope for AUTH-04; a future story will harden CSP." (c) For now, follow industry-standard SPA auth pattern (bearer token in localStorage). (d) No additional code needed; risk is policy/operational, not implementation. |
| 5 | Integration     | **HIGH** | **CORS and Authorization header**: backend must accept Authorization header from cross-origin requests. This requires CORS header `Access-Control-Allow-Headers: Authorization` (or wildcard *). Current backend has CORS configured; whether it already includes Authorization, or whether that is finalized as part of AUTH-08's scope, remains to be verified against AUTH-08's own PLAN.md at implementation time. | Mitigation: (a) AUTH-08 (deployment/CORS story) explicitly handles CORS-credentials config for this mechanism. (b) AUTH-04 assumes AUTH-08's CORS config is correct; no additional work needed in AUTH-04. (c) Verify in AUTH-02's PLAN.md or AUTH-08's story that Authorization header is explicitly allowed. (d) Test: after Auth-02 ships, call a protected endpoint with Authorization header and verify 200 (not 401). |
| 6 | Domain          | **MED**      | **Token TTL is 60 minutes** (story line 94). For an internal admin tool, this is reasonable. However, if an admin is away from the dashboard for 1 hour, the next action triggers a 401 and redirects to Login. UX: admin must re-enter password. Acceptable for an internal tool; not ideal for long-running sessions. | Mitigation: (a) 60-minute TTL is acceptable per story (Decision log, line 154). (b) No code change needed; this is a policy decision. (c) If feedback suggests sessions are too short, a future story can extend TTL or add refresh-token rotation (out of scope for AUTH-04). (d) Document in PLAN.md: "Token TTL is 60 minutes per story decision; session expires silently, user is redirected to Login on next action." |
| 7 | Compatibility   | **MED**      | **Browser support for localStorage and localStorage availability**. localStorage is not available in SSR contexts or if disabled by browser settings (rare). If localStorage.getItem() throws, token check fails. | Mitigation: (a) This is client-only React app, no SSR. (b) Wrap localStorage calls in try/catch; if getItem throws, treat as "no token" (set isAuthenticated = false). (c) Test: simulate localStorage unavailable (mock to throw), verify App.jsx renders Login gracefully. |
| 8 | Integration     | **MED**      | **jwt-decode library dependency**. New external npm package. Risk: abandoned project, supply-chain. jwt-decode is widely used, but adds a dependency. | Mitigation: (a) jwt-decode is maintained, 10K+ weekly downloads, no critical CVEs. (b) Alternative: manually parse JWT (split by '.', base64-decode payload, JSON-parse). Manual approach is ~20 lines and avoids dependency. (c) Decision for PLAN.md: either add jwt-decode (simpler, tested) or manual parsing (lighter, no dependency). For this assessment, assume jwt-decode is acceptable (standard SPA practice). |
| 9 | Performance     | **MED**      | **Request interceptor on every API call**: interceptor runs before every HTTP request (gets token, attaches header). If interceptor has a bug or is slow, all API calls are affected. | Mitigation: (a) Interceptor is simple: localStorage.getItem + header set. Expected: <1ms per call. (b) Unit test interceptor in isolation (mock axios.create, verify request config has Authorization header). (c) No code complexity; low risk. |
| 10| Domain          | **LOW**      | **Logout behavior**: Story AC3 (line 76) mentions "redirect to Login and show a readable message indicating the session expired". But what if admin clicks a hypothetical "Logout" button (AUTH-07 story)? Should logout behavior be identical? Yes, same UX (clear token, redirect, show message). No code change needed; just alignment. | Mitigation: (a) AUTH-07 will call clearAuthToken() and trigger the same callback as 401 handler. (b) Test: logout flow is covered in AUTH-07's tests, not AUTH-04. (c) Document in PLAN.md: "Logout (AUTH-07) uses the same clearAuthToken and redirect mechanism as session expiry (AUTH-04)." |
| 11| Domain          | **LOW**      | **Accessibility: focus on Login redirect**. Story NFR line 99 requires "focus moves to the first focusable element of the Login form on redirect". If Login.jsx does not auto-focus, user may not realize the page changed (especially if no visual transition). | Mitigation: (a) Login.jsx will have useEffect that calls focus() on the first input on mount. (b) Test: use a browser accessibility test (e.g., axe-core via vitest) to verify focus is on an input after redirect. (c) No animation added (avoid prefers-reduced-motion complexity for now). |

---

## Score + verdict

### 5-dimensional rubric

| Dimension       | Weight | Pass criterion                                                              | Finding                                                                   | Score |
|---|---|---|---|---|
| Integration     | 25     | All upstream dependencies available; failure modes well understood          | AUTH-02 (GO-WITH-CONDITIONS) provides login endpoint returning {token: str} (confirmed in Decision log). AUTH-03 (GO-WITH-CONDITIONS) provides password security. CORS is configured. Failure modes: 401 infinite redirect (mitigated by careful state management), 401 on first protected call after login (mitigated by token set before first call), localStorage unavailable (mitigated by try/catch), CORS Authorization header rejection (AUTH-08 scope). All modes understood. Risk #1 (infinite redirect) is manageable with careful sequencing. Risk #5 (CORS) is documented dependency on AUTH-08 (informational per story, not blocking). | 80    |
| Compatibility   | 20     | Backward compat plan exists for each affected client/version                | **API contract change**: userApi.js exports new functions (login, setAuthToken, clearAuthToken, getAuthToken, setAuthExpiredCallback). Existing client code (getUsers, createUser, etc.) is unchanged; new functions are additive. **Frontend change**: App.jsx gains auth state and redirects to Login if unauthenticated. Existing components (Dashboard, Users, etc.) are unaffected at the component level (they receive the same props as before). **localStorage change**: new key `auth_token` used; no conflict with existing data. **Browser localStorage API**: available in all modern browsers (no IE11 support needed; repo targets desktop modern browsers per README). **Mitigation**: new functions are backward-compatible (existing code continues to work). Test: existing CRUD tests still pass without auth token (if backend makes login optional, which is future work per AUTH-02; for now, assume all endpoints require auth). | 85    |
| Domain          | 20     | Edge cases enumerated; no hidden invariants surfaced during scan            | **AC1 (restore session across refresh)**: token exists, exp > now → render protected view, no Login shown. ✓ Clear. **AC2 (no token on first visit)**: token missing or null → render Login. ✓ Clear. **AC3 (expired token on mount)**: token exists but exp < now → clear token, render Login with message. ✓ Clear. **AC4 (401 on API call mid-session)**: interceptor detects 401, clears token, calls callback, App.jsx renders Login with message. ✓ Clear. **NFR (100ms check)**: synchronous localStorage + jwt-decode < 100ms. ✓ Clear. **Accessibility (focus on redirect)**: Login.jsx auto-focuses first input. ✓ Clear. **Edge case: token is malformed JSON or not a valid JWT**: jwt-decode throws, try/catch in App.jsx treats as "no token". ✓ Handled. **Edge case: localStorage quota exceeded**: setItem throws, caught in setAuthToken, error message shown. ✓ Handled. **Invariants**: (1) token always cleared on 401 or expiry. (2) protected views never render without valid token (or will, but API calls will 401 immediately). (3) Login component never calls protected endpoints. (4) token check is synchronous (no flash). All enumerated, no surprises. | 85    |
| Performance     | 15     | Story has explicit perf budget; estimated work fits within budget           | **NFR**: Auth-state check on mount < 100ms (story line 89). Estimated breakdown: localStorage.getItem (~0.1ms) + jwt-decode (~0.5ms) + exp comparison (~0.1ms) = ~1ms, well within budget. **Test**: mock setup to measure p95 latency over 100 iterations; target < 100ms (will easily achieve <5ms). **Implementation work**: ~200 lines (userApi.js interceptors + hooks/auth logic + Login component + App.jsx changes + tests). Fits within typical story scope. **Latency risk**: unlikely to exceed budget; mitigation is benchmark in tests. | 90    |
| Dependency      | 20     | All upstream stories complete; no blocking external work                    | **Upstream**: AUTH-02 (GO-WITH-CONDITIONS, login endpoint defined in Decision log). AUTH-03 (GO-WITH-CONDITIONS, password security). Both research is complete. **Downstream**: AUTH-05, AUTH-06, AUTH-07 depend on AUTH-04's token/auth state (not blocking this research). **External**: AUTH-08 is informational (CORS scope), not blocking. **No blocking external work.** | 95    |

**Total: (80×0.25 + 85×0.20 + 85×0.20 + 90×0.15 + 95×0.20) = 20 + 17 + 17 + 13.5 + 19 = 86.5/100**

### **Total: 87/100 → GO-WITH-CONDITIONS**

No single dimension scores <40. Integration (80) reflects two HIGH-severity risks (infinite redirect, CORS header allowance) that are manageable with documented mitigations. Compatibility (85), Domain (85), and Performance (90) are all sound. Dependency (95) is strong: both upstream stories are complete with clear output contracts. The conditions below must be addressed in PLAN.md before implementation.

### Conditions

The following conditions must be explicitly addressed in PLAN.md before implementation:

1. **401 Infinite redirect prevention (Integration, HIGH)**: PLAN.md must specify: (a) Login component never calls protected endpoints on mount (only on-submit calls login endpoint). (b) setAuthToken(token) is called in App.jsx immediately after successful login, before any protected call is made. (c) Response interceptor checks if localStorage is null/empty before triggering callback on 401 (avoid re-triggering if already logged out). (d) Test scenario: simulate 401 on a protected call, verify token is cleared exactly once, verify no loop. Unit test: mock axios 401 response, verify callback is called once.

2. **CORS Authorization header allowance (Integration, HIGH)**: PLAN.md must confirm that backend CORS config (backend/.env CORS_ORIGINS and Access-Control-Allow-Headers) includes Authorization header. This is AUTH-08 scope, but AUTH-04 cannot ship to production without it. Specify: "AUTH-04 assumes AUTH-08 has configured Access-Control-Allow-Headers to include 'Authorization'. Verify in AUTH-02 or AUTH-08 PLAN.md that Authorization header is explicitly allowed (or wildcard *). Test after AUTH-02 ships: call protected endpoint with Authorization header, verify 200 (not 401 due to CORS preflight failure)."

3. **Token expiry check benchmark (Performance, 100ms budget)**: PLAN.md must specify that frontend tests include a micro-benchmark: App.jsx mount with token in localStorage, measure time to set isAuthenticated state, assert p95 < 100ms over 100 iterations. Expected: ~1-5ms. If benchmark exceeds 100ms, profile and investigate (unlikely).

4. **AUTH-02 login response shape alignment (Integration)**: PLAN.md must confirm: (a) AUTH-02's LoginResponse schema includes field `token: str` (per AUTH-02 Decision log, line 147). (b) Auth-04 implementation assumes this shape; if AUTH-02 changes shape, AUTH-04 extraction logic must adapt. (c) Unit test: mock userApi.login({ email: "...", password: "..." }) returning {token: "..."}, verify setAuthToken is called with token value.

5. **XSS risk acknowledgment (Security, acceptable risk)**: PLAN.md must document: "Token is stored in localStorage per story decision (line 56-59). This is readable by any inline script (XSS exposure). CSP hardening (nonce-based inlining, strict-dynamic) is out of scope for AUTH-04; defer to a future security-hardening story. For now, follow standard SPA auth pattern (bearer token in localStorage). No additional mitigation code in AUTH-04."

6. **Login component scope and accessibility (Domain/Accessibility)**: PLAN.md must specify: (a) Login.jsx is a minimal login form (email + password + submit button, no advanced validation). Password validation policy (min length, complexity) is AUTH-01 responsibility. (b) On mount, focus is moved to first input (email or password) via useEffect + ref.focus(). (c) Error message is in aria-live="polite" region for screen readers. (d) No animation added (keep it simple; animation/prefers-reduced-motion can be future polish). Test: axe-core accessibility scan verifies WCAG 2.2 Level AA on Login form.

7. **localStorage error handling (Compatibility/Robustness)**: PLAN.md must specify: (a) All localStorage calls (getItem, setItem) are wrapped in try/catch. (b) If getItem throws, treat as "no token" (setIsAuthenticated = false). (c) If setItem throws (quota exceeded, disabled), show error message to user ("Unable to save session; log in again") and do not proceed. (d) Test: mock localStorage.getItem/setItem to throw, verify App.jsx handles gracefully.

8. **jwt-decode library decision** (Integration): PLAN.md must specify: (a) Either add `jwt-decode` (~2KB) to package.json, OR implement manual JWT parsing (~20 lines of code). Decision: add jwt-decode for reliability and consistency with industry standard. (b) No signature verification on client (trust server for validation; client check is expiry-only UX optimization). (c) If jwt-decode is unavailable or throws (malformed token), treat as "no token". Test: unit test jwt-decode extraction with valid and malformed tokens.

9. **App.jsx auth state initialization and clearance (Domain)**: PLAN.md must specify: (a) isAuthenticated is initialized to null (unknown) on mount, set synchronously after token check. (b) On successful login, setIsAuthenticated(true), setAuthError(null), setActiveView("dashboard"). (c) On 401 or session expiry, setIsAuthenticated(false), setAuthError("Your session has expired. Please log in again."), activeView remains as-is (user sees Login overlay, not view switch). (d) Test: verify state transitions for login success, login failure, mount with/without token, 401 mid-session.

10. **Observability: session-expiry logging (Observability)**: PLAN.md must specify: (a) On 401 or token expiry, log a client-side event (e.g., console.log("auth_session_expired")) with no context (no token, no email, no PII). (b) Optional: integrate with a future analytics service (out of scope for AUTH-04). (c) Test: capture console output, verify event is logged with event name only.

---

## Synthesis

**AUTH-04 is feasible for planning and implementation with documented conditions; the mechanism is sound and all upstream dependencies are complete.**

This story delivers client-side JWT token persistence and automatic session restoration across page refresh using localStorage + axios interceptor, grounded in the repo's cross-origin docker-compose topology (separate frontend/backend containers). The storage mechanism (localStorage), TTL (60 minutes), and error handling (401 redirect with session-expired message) are all explicitly decided in the story and well-justified in the Mechanism section. The codebase's existing axios client (userApi.js) is the perfect place to add request/response interceptors; App.jsx's conditional view rendering is a natural fit for auth state. Both upstream dependencies (AUTH-02 login endpoint, AUTH-03 password hashing) are complete with clear output contracts (login returns {token: str}, password is server-side only).

The single biggest integration risk is preventing infinite 401 redirect loops—mitigated by careful sequencing (token set before first protected call, interceptor checks for null before re-triggering). A secondary integration risk is CORS Authorization header allowance (AUTH-08 scope, but required for production); this is documented and deferred. Performance risk is minimal: token expiry check is synchronous and <5ms typical, well below the 100ms budget. The acknowledged XSS risk (localStorage readable by inline scripts) is accepted per the story and applies to any SPA with bearer tokens; no additional mitigation is needed in code (defer CSP hardening to future work). Accessibility is straightforward: auto-focus on Login form redirect per WCAG 2.2 modal pattern.

Key implementation decisions now resolved: (1) use axios interceptor for token attachment and 401 handling, (2) token check on mount is synchronous (localStorage + jwt-decode), (3) no token signature verification on client (expiry check only), (4) Login component is minimal (email + password fields + submit), (5) auth state lives in App.jsx (isAuthenticated + authError + login method), (6) 401 handler uses a callback to signal App.jsx (loose coupling from HTTP layer). All acceptance criteria are testable, and all failure modes are understood.

---

## Clarifications

(none — all resolved; see cross-story auth contract decisions applied 2026-08-17.)
