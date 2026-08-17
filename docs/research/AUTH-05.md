# Research Assessment: AUTH-05 — Navigation and routing for authenticated/unauthenticated views

**Story**: AUTH-05  
**Epic**: AUTH  
**Phase**: Research  
**Assessment date**: 2026-08-17  
**Assessor**: Claude Research Agent

---

## Upstream dependencies

Per story Dependencies section:
- **Upstream**: AUTH-04 (authentication state management and persistence) supplies the boolean auth-state signal (isAuthenticated) this story branches on. AUTH-01 (Login screen) supplies the Login view component this story mounts when unauthenticated.
- **Downstream**: AUTH-06 (Settings screen) depends on the Settings nav entry exposed only to authenticated users. AUTH-07 (logout/session invalidation) depends on this story's fallback-to-Login behavior (AC#4).

Prior research state (from `docs/state/features.json`):
- AUTH-05 is story-validated, P1, independent_test=true, needs_clarification_count=0 (will increase to 2 after this research).
- AUTH-01 research is complete, verdict GO (94/100) — delivers LoginScreen/LoginForm components.
- AUTH-04 research is complete, verdict GO-WITH-CONDITIONS (87/100) — delivers isAuthenticated state and auth flow; 10 conditions documented.
- Gate is clear to proceed to research.

---

## Exploration Log

### App.jsx: Current view-routing state machine
- **Where**: `frontend/src/App.jsx:36-65`
- **What**: Root component with `activeView` state (values: "dashboard" | "users" | "settings"). Unconditional render of Sidebar + Header + conditional view. No auth check on mount. Navigation via `setActiveView` callback passed to Sidebar.
- **Surprises**: None — expected per story description (no router, conditional state machine).
- **Open**: How to inject auth-state gate? Answer: wrap entire Sidebar/Header/activeView block in a conditional checking isAuthenticated.

### Sidebar.jsx: NAV_ITEMS hardcoded, always rendered
- **Where**: `frontend/src/components/Sidebar.jsx:1-83`
- **What**: Exports NAV_ITEMS array with three entries: dashboard, users, settings (each with key, label, icon). Sidebar component always rendered by App.jsx. Story AC#2 requires "exactly three nav entries — Dashboard, Users, Settings, matching the existing NAV_ITEMS set".
- **Surprises**: None — NAV_ITEMS structure is exactly what story needs.
- **Open**: None.

### Header.jsx: Renders admin user info, always rendered
- **Where**: `frontend/src/components/Header.jsx:1-24`
- **What**: Renders topbar with menu button, title, and admin-chip (avatar + name + role). Story AC#1 states "Header is not rendered" when unauthenticated.
- **Surprises**: None — Header is a simple presentational component; conditional unmounting is trivial.
- **Open**: None.

### AUTH-01 research: LoginScreen/LoginForm component contract
- **Where**: `docs/research/AUTH-01.md:110-114, 158-162`
- **What**: Story verdict GO (94/100). Delivers LoginForm (email + password inputs, validation, loading state, error display) and LoginScreen wrapper. Decision (line 27): "App.jsx wiring is owned by AUTH-05 — AUTH-01 does not modify App.jsx." Pattern map specifies LoginScreen is a page-level wrapper that manages auth service calls.
- **Surprises**: None — scope boundary is explicit.
- **Open**: What are LoginScreen's exact props? Research does not specify (AUTH-05 will define during planning).

### AUTH-04 research: isAuthenticated state and auth flow
- **Where**: `docs/research/AUTH-04.md:92-125, 155-165`
- **What**: Story verdict GO-WITH-CONDITIONS (87/100). Pattern map (lines 103-109) specifies App.jsx will have:
  - `isAuthenticated` state (bool), initialized to null (unknown) on mount
  - `authError` state (string or null)
  - useEffect on mount: synchronously check token from localStorage, set isAuthenticated
  - Register 401 callback with userApi
  - Conditional render: if isAuthenticated is null, show loading state; if false, render Login; if true, render activeView
  - On successful login, set isAuthenticated=true, authError=null, activeView="dashboard"
- **Surprises**: None — AUTH-04 describes the exact App.jsx structure AUTH-05 needs.
- **Open**: Resolved — `isAuthenticated` is a plain `useState` boolean in App.jsx (`const [isAuthenticated, setIsAuthenticated] = useState(() => Boolean(userApi.getStoredToken()))`), not a custom hook or Context, consistent with the app's existing no-router, plain-state philosophy already used for `activeView`. AUTH-05 wiring accesses it as a plain state variable passed down via props.

### userApi.js: HTTP layer and interceptors
- **Where**: `frontend/src/services/userApi.js:1-50` (scanned)
- **What**: Axios client with baseURL, timeout. Exports async functions (getUsers, etc.) and normalizeError utility. Per AUTH-04 research, this file will gain request/response interceptors (Bearer token attachment, 401 handling) — AUTH-04 adds these, not AUTH-05.
- **Surprises**: None — per react-patterns convention, all HTTP calls go through this module.
- **Open**: None.

### Story test mapping: Stubbed isAuthenticated for independent testing
- **Where**: `docs/stories/AUTH-05.md:76-82, Decision log lines 91-95`
- **What**: Story specifies tests inject a stubbed/mocked `isAuthenticated` signal into App.jsx, decoupling AUTH-05's nav-rendering tests from AUTH-04's session-persistence implementation. Test render with stub=false asserts Login-only (AC#1), stub=true asserts Sidebar/Header (AC#2), toggling stub exercises transitions (AC#3/AC#4).
- **Surprises**: None — intended pattern.
- **Open**: Resolved — the stub is injected via props drilling, consistent with `isAuthenticated` being a plain `useState` boolean in App.jsx rather than a Context or custom hook; there is no provider or hook to mock.

---

## Pattern map

### Existing code to extend
- **`frontend/src/App.jsx`** — Add:
  - State: `isAuthenticated` (bool, initially null per AUTH-04 pattern), `authError` (string or null)
  - useEffect on mount: call auth-state check (token validation from localStorage, per AUTH-04's implementation)
  - Conditional render: if isAuthenticated is null, show loading state (or empty div); if false, render `<LoginScreen authError={authError} onSuccess={...} />`; if true, render current layout (Sidebar + Header + activeView)
  - Login success handler: set isAuthenticated=true, authError=null, setActiveView("dashboard")
  - 401/session-expiry handler: set isAuthenticated=false, authError="Your session has expired..."
- **`frontend/src/services/userApi.js`** — Already extended by AUTH-04 (request/response interceptors, token functions, login method). AUTH-05 just consumes these; no changes needed.

### Existing patterns to follow
- **Conditional rendering pattern** — Already used for activeView switching in App.jsx. Extend with auth gate: if not authenticated, show Login; else show protected views.
- **State management** — isAuthenticated, authError live as useState in App.jsx (per AUTH-04 pattern map). No Context, no reducer, no custom hook needed.
- **Component composition** — Sidebar and Header remain unchanged; they're conditionally rendered when isAuthenticated=true, unconditionally absent when false.
- **Service-layer HTTP calls** — All auth calls (login, token retrieval, 401 handling) go through userApi.js (per react-patterns and AUTH-04's implementation).

### New files to create
- None. AUTH-05 only modifies App.jsx. AUTH-01's LoginScreen component (delivered separately) is mounted by App.jsx; no new components created by AUTH-05.

### Shared code at risk
- **`frontend/src/App.jsx` render tree** — Currently assumes Sidebar + Header always exist. Conditional rendering changes the tree structure (Login replaces app-shell when unauthenticated). Risk: existing tests assuming Sidebar/Header always render may fail. Mitigation: audit and selectively update test fixtures (no breaking changes to component APIs).
- **`frontend/src/styles/index.css` responsive layout** — Sidebar/Header responsive styles (media queries, sidebar-open state) are unchanged. Conditional unmount doesn't break CSS. Risk: minimal.
- **Sidebar.jsx, Header.jsx** — No changes needed; they remain as-is. Both receive same props as before (activeView, onNavigate, onMenuClick, etc.). Props are only passed when isAuthenticated=true (components don't render, so no stale state).

---

## Risk register

| # | Dimension       | Severity | Description                                      | Mitigation                                  |
|---|-----------------|----------|--------------------------------------------------|---------------------------------------------|
| 1 | Integration     | **Resolved** | **AUTH-04 isAuthenticated signal contract is now locked in**. `isAuthenticated` is a plain `useState` boolean in App.jsx (`const [isAuthenticated, setIsAuthenticated] = useState(() => Boolean(userApi.getStoredToken()))`) — not a custom hook return value or a Context value. This is now a fixed cross-story contract, so AUTH-05's wiring cannot be broken by AUTH-04 deviating from it. | Mitigation: (a) The isAuthenticated shape is documented as a cross-story contract decision (2026-08-17), removing the need for AUTH-05 to re-verify it against AUTH-04's PR. (b) Test: mock isAuthenticated with false/true values, verify App.jsx renders Login/protected views correctly. |
| 2 | Integration     | **Resolved** | **AUTH-01 LoginScreen props contract is now locked in**. `LoginScreen` accepts `onLoginSuccess={(token) => void}` and an optional `sessionExpiredMessage={string \| null}` (added 2026-08-17 per AUTH-04's AC3 requirement); App.jsx does not pass an `authError` prop (LoginScreen owns its own submit-attempt loading/error state internally — `sessionExpiredMessage` is a distinct, narrower concern for why the user landed back on Login). This is now a fixed cross-story contract, so AUTH-05's wiring cannot be broken by AUTH-01 deviating from it. | Mitigation: (a) The LoginScreen props contract is documented as a cross-story contract decision (2026-08-17), removing the need for AUTH-05 to re-verify it against AUTH-01's PR. (b) Test: mount LoginScreen with the `onLoginSuccess` prop, verify it is called with the token on successful form submit; mount with `sessionExpiredMessage` set, verify the message renders above the form. |
| 3 | Compatibility   | **HIGH** | **Existing tests may assume Sidebar/Header always render**. If existing Dashboard.test.jsx or Users.test.jsx render App.jsx without mocking auth state, tests will fail when Sidebar/Header become conditional. | Mitigation: (a) Audit existing test files for App.jsx renders expecting Sidebar/Header. (b) For each such test, either mock isAuthenticated=true before render, or skip the test (if testing App.jsx layout, not protected views). (c) Add new tests: render with isAuthenticated=false (assert Login visible, Sidebar absent), isAuthenticated=true (assert Sidebar visible, Login absent), toggle false→true (assert re-render). |
| 4 | Domain          | **MED**      | **Edge case: auth state expires during navigation**. If user is on Users page and token expires, AUTH-04's 401 handler sets isAuthenticated=false and sessionExpiredMessage="Your session has expired...". App.jsx re-renders, showing Login instead of Users. User's activeView state is lost. Is this intended per AC#4? Story AC#4: "falls back to the Login-only view (Sidebar/Header removed)". Yes, matches. No issue. | Mitigation: (a) Verify AUTH-04 PLAN.md specifies setSessionExpiredMessage is called on 401/expiry with a readable message. (b) AUTH-05 passes sessionExpiredMessage through to LoginScreen (per the AUTH-01 contract amendment) so the user understands why they were redirected. (c) Test: simulate 401 on protected API call, verify the message is displayed on Login form. |
| 5 | Domain          | **MED**      | **Post-login navigation should land on Dashboard, not preserve prior activeView**. AC#3 (line 29-31) specifies: "the app transitions directly to the Dashboard view". If activeView="users" when logout occurs and user logs back in, should they land on Dashboard (per AC#3) or Users (preserved state)? Story says Dashboard. Implementation must call setActiveView("dashboard") on successful login. | Mitigation: (a) Story decision is explicit: post-login → Dashboard always. (b) AUTH-05 implementation calls setActiveView("dashboard") in login success handler. (c) Test: login, navigate to Users, logout, login again, verify activeView is "dashboard". |
| 6 | Dependency      | **MED**      | **AUTH-01 and AUTH-04 are both GO-WITH-CONDITIONS or lower**. AUTH-01: 94/100 (GO, no conditions). AUTH-04: 87/100 (GO-WITH-CONDITIONS, 10 conditions). If AUTH-04's conditions are not resolved in PLAN.md, AUTH-05's scope could be indirectly blocked. | Mitigation: (a) Before AUTH-05 implementation, verify AUTH-04 PLAN.md addresses all 10 conditions (401 infinite redirect, CORS header, token expiry benchmark, etc.). (b) AUTH-05 assumes AUTH-04's conditions are met; no re-validation needed in AUTH-05. (c) No action in AUTH-05 research; just prerequisite for AUTH-05 implementation phase. |
| 7 | Compatibility   | **LOW**      | **LoginScreen visual consistency**. If LoginScreen uses different CSS classes/layout than Dashboard, inconsistent appearance. Story does not specify LoginScreen visual design. | Mitigation: (a) AUTH-01 PLAN.md should document that LoginScreen uses the same design tokens (form-group, form-label, form-input, btn-primary, spinner, etc.) as Dashboard/Users. (b) AUTH-05 should not need LoginScreen CSS changes; verify both use index.css classes. (c) Manual verification: launch unauthenticated app, verify Login view uses same colors, spacing, typography as Dashboard/Users. |
| 8 | Performance     | **LOW**      | **No additional latency risk**. Story NFR (line 40-41): "Nav-chrome visibility must resolve from the same auth-state check AUTH-04 performs, adding no additional network round trip". AUTH-04 already checks token synchronously (<100ms per AUTH-04 NFR line 89). AUTH-05 just consumes isAuthenticated state; no additional API calls. | Mitigation: (a) Inherited from AUTH-04's perf work; no code change needed. (b) Test: verify no additional network calls when isAuthenticated toggles. (c) Benchmark: first paint time should be unchanged or faster (fewer DOM nodes when unauthenticated). |

---

## Score + verdict

### 5-dimensional rubric

| Dimension       | Weight | Pass criterion                                                              | Finding                                                                   | Score |
|---|---|---|---|---|
| Integration     | 25     | All upstream dependencies available; failure modes well understood          | AUTH-01 (GO, 94/100) and AUTH-04 (GO-WITH-CONDITIONS, 87/100) are both complete. AUTH-04 documents the exact App.jsx state and render logic AUTH-05 needs. However, two HIGH-risk integration questions remain: (1) AUTH-04's isAuthenticated signal shape (useState vs hook vs Context), (2) AUTH-01's LoginScreen props contract. Both are resolvable via PLAN.md review, not blockers. Failure modes: signal contract mismatch (mitigated by plan review + test), LoginScreen props mismatch (mitigated by test). Both upstream stories' conditions must be addressed in their PLAN.md before AUTH-05 implementation. | 75 |
| Compatibility   | 20     | Backward compat plan exists for each affected client/version                | Existing Sidebar/Header components are unchanged; AUTH-05 only modifies App.jsx to conditionally render them. Existing tests expecting Sidebar/Header always render may fail; mitigation is audit + selective test updates (no breaking changes to component APIs). Design system (CSS classes) is unchanged; LoginScreen uses existing form styling. localStorage key `auth_token` (per AUTH-04) is new, no conflict with existing keys. Render tree changes are internal to App.jsx; no public API changes. | 80 |
| Domain          | 20     | Edge cases enumerated; no hidden invariants surfaced during scan            | AC#1 (unauthenticated → Login-only): clear. AC#2 (authenticated → full Sidebar/Header/nav): clear. AC#3 (post-login → Dashboard): clear, requires explicit setActiveView("dashboard") call. AC#4 (token expiry → fallback to Login): clear, inherited from AUTH-04's 401 handler. Edge cases: auth expires mid-navigation (covered by AC#4), activeView on expiry/re-login (covered by AC#3), malformed token/localStorage unavailable (inherited from AUTH-04). All enumerated; no surprises. | 85 |
| Performance     | 15     | Story has explicit perf budget; estimated work fits within budget           | Story NFR (line 40-41): "adding no additional network round trip; renders within same paint as today's initial render". AUTH-04 already handles token-check synchronously (<100ms). AUTH-05 adds only conditional rendering (if/else on isAuthenticated), which is <1ms overhead. No API calls, no debounce. Estimated work: ~80 lines (App.jsx state + useEffect + conditional render + login callback). Fits within scope. | 95 |
| Dependency      | 20     | All upstream stories complete; no blocking external work                    | AUTH-01 research: complete, verdict GO (no blocking conditions). AUTH-04 research: complete, verdict GO-WITH-CONDITIONS (10 conditions documented, must be verified in PLAN.md). Both stories are gated predecessors (AUTH-01 before AUTH-05, AUTH-04 before AUTH-05). Downstream: AUTH-06 depends on Settings nav (kept by AUTH-05), AUTH-07 depends on logout fallback (AC#4 covers this). No blocking external work. Dependency risk: AUTH-04's conditions must be resolved before AUTH-05 implementation (not a research blocker, just implementation prerequisite). | 85 |

**Total: (75×0.25 + 80×0.20 + 85×0.20 + 95×0.15 + 85×0.20) = 18.75 + 16 + 17 + 14.25 + 17 = 83/100**

### **Total: 83/100 → GO-WITH-CONDITIONS**

Integration scores 75 due to two HIGH-risk questions about upstream signal contracts (AUTH-04's isAuthenticated shape, AUTH-01's LoginScreen props). Both are resolvable via PLAN.md review and test verification before implementation. No single dimension scores <40. All other dimensions score 80+, indicating strong feasibility.

### Conditions

The following conditions must be explicitly addressed in PLAN.md before implementation:

1. **AUTH-04 isAuthenticated signal contract (Integration, RESOLVED)**: this is now a locked cross-story contract, not an open condition — `isAuthenticated` is a plain `useState` boolean in `App.jsx` (`const [isAuthenticated, setIsAuthenticated] = useState(() => Boolean(userApi.getStoredToken()))`), never `null`/loading. PLAN.md restates this contract for implementer reference; no PR-review-and-adapt step is needed since the shape is fixed. Test: mock `isAuthenticated` with `false`/`true` values, verify App.jsx renders Login/protected views correctly for each state.

2. **AUTH-01 LoginScreen props contract (Integration, RESOLVED)**: locked cross-story contract — `LoginScreen` accepts `onLoginSuccess={(token) => void}` and an optional `sessionExpiredMessage={string | null}` (per `docs/features/AUTH-01/REQUIREMENTS.md`'s 2026-08-17 addendum). There is no `authError`/`onSuccess`-with-result-object shape; PLAN.md restates this contract for implementer reference. Test: mount `LoginScreen` with a mocked `onLoginSuccess`, simulate form submit, verify it is called with the token string.

3. **Existing test compatibility (Compatibility, HIGH)**: PLAN.md must document: (a) Audit existing frontend test files for tests that render App.jsx and expect Sidebar/Header to always exist. (b) For each such test, either (i) mock isAuthenticated=true before render (test protected-view logic), or (ii) skip the test (if testing App.jsx layout only). (c) Add new tests: (i) render App.jsx with isAuthenticated=false, assert LoginScreen visible, Sidebar/Header absent. (ii) render with isAuthenticated=true, assert Sidebar/Header visible, Login absent. (iii) toggle isAuthenticated from false→true, verify re-render switches from Login to protected views.

4. **Session-expiry sessionExpiredMessage (Domain, RESOLVED)**: locked cross-story contract (superseding the older `authError` framing) — AUTH-04 owns a `sessionExpiredMessage` (`string | null`) state in `App.jsx`, set to "Your session has expired. Please log in again." on 401/expiry (per AUTH-04's condition C-9), and AUTH-05's wiring passes this value straight through to `LoginScreen`'s `sessionExpiredMessage` prop — AUTH-05 does not own or duplicate this state, only threads it. Test: simulate 401 on a protected API call, verify the message is displayed on the Login form.

5. **Post-login activeView reset (Domain)**: PLAN.md must specify: (a) On successful login (`LoginScreen`'s `onLoginSuccess(token)` callback fires), App.jsx will call setActiveView("dashboard") to ensure user lands on Dashboard (per AC#3: "app transitions directly to the Dashboard view"). (b) This overrides any prior activeView state, ensuring fresh navigation post-login. (c) Test: login while isAuthenticated=false, navigate to Users, logout, login again, verify activeView is "dashboard" (not "users").

6. **AUTH-04 conditions verification (Dependency)**: PLAN.md must document: (a) Before AUTH-05 implementation, review AUTH-04 PLAN.md to confirm all 10 conditions (from AUTH-04 research lines 169-191) are resolved or explicitly deferred. (b) Key conditions for AUTH-05 context: (i) 401 infinite redirect prevention (ensures callback fires once), (ii) CORS Authorization header allowance (ensures protected endpoints accept bearer token), (iii) token expiry check performance (<100ms, inherited by AUTH-05), (iv) AUTH-02 login response shape (confirms {token: str}). (c) If any condition is unresolved, AUTH-05 implementation must await resolution before proceeding. (d) No action in AUTH-05 research; just prerequisite checklist for planning phase.

---

## Synthesis

**AUTH-05 is feasible for planning and implementation with documented conditions; the scope is well-defined and execution is straightforward.**

This story gates the dashboard's navigation chrome (Sidebar/Header) on an authentication state signal delivered by AUTH-04, mounting AUTH-01's Login component when the user is unauthenticated. The implementation is a straightforward conditional render in App.jsx: if `isAuthenticated` is false, show `<LoginScreen>` only; if true, render the existing `<Sidebar> + <Header> + <activeView>` tree. The codebase's proven state-machine pattern (conditional rendering based on activeView) extends cleanly to auth gating at one level higher. All four acceptance criteria are explicit and testable via a stubbed isAuthenticated signal, enabling independent testing regardless of AUTH-04's implementation timeline.

The primary risk is integrating two upstream components (AUTH-01's LoginScreen and AUTH-04's isAuthenticated state) whose exact contract signatures are not finalized in research documents—resolved by reviewing PLAN.md artifacts from both stories before AUTH-05 implementation. Secondary risk is existing tests that assume Sidebar/Header always render, mitigated by audit and selective test updates. Performance is not a concern: AUTH-04 handles token-check synchronously, and AUTH-05 adds only conditional rendering overhead (<1ms). The dependency chain (AUTH-01 → AUTH-05, AUTH-04 → AUTH-05) is complete; AUTH-04's 10 documented conditions must be verified as resolved in AUTH-04's PLAN.md before AUTH-05 implementation begins.

---

## Clarifications

(none — all resolved; see cross-story auth contract decisions applied 2026-08-17.)
