# Research Assessment: AUTH-06 — Settings screen with user info and logout action

**Story**: AUTH-06  
**Epic**: AUTH  
**Phase**: Research  
**Assessment date**: 2026-08-17  
**Assessor**: Claude Research Agent

---

## Upstream dependencies

Per story Dependencies section (refreshed):
- **Upstream**: AUTH-01 (login UI patterns/styling for consistency), AUTH-02/AUTH-03 (backend auth — token issuance and password security), AUTH-04 (auth state management — isAuthenticated signal and current-user endpoint `GET /api/auth/me`), AUTH-05 (route guard — Settings screen only renders if authenticated, redirects to Login if not).
- **Downstream**: AUTH-07 (logout flow — Logout button triggers session/token invalidation).

Prior research state (from `docs/state/features.json`):
- AUTH-06 is story-validated, P2, independent_test=false (depends on AUTH-04 auth state and AUTH-05 route guard), needs_clarification_count=0.
- AUTH-04 research: complete, verdict GO-WITH-CONDITIONS (87/100, 10 conditions documented). Delivers: isAuthenticated state in App.jsx (null/false/true), token persistence in localStorage, 401 handler callback, login method in userApi.js.
- AUTH-05 research: complete, verdict GO-WITH-CONDITIONS (83/100, 6 conditions documented). Delivers: conditional rendering of Settings nav item and page when authenticated, Login fallback when not.
- AUTH-07 research: complete, verdict GO-WITH-CONDITIONS (82/100). Delivers: logout flow that clears token and redirects to Login.
- Both upstream stories are gated predecessors; their conditions are documented and assumed to be resolved before AUTH-06 implementation.

---

## Exploration Log

### Frontend: Existing Settings placeholder in App.jsx
- **Where**: `frontend/src/App.jsx:7-34`
- **What**: SettingsPlaceholder component (currently rendered when activeView="settings") shows a placeholder page with page-header, title, description, and a state-block saying "Nothing here yet". Header receives title="Settings" and onMenuClick callback.
- **Surprises**: None — placeholder follows the same pattern as Dashboard/Users pages.
- **Open**: None.

### Frontend: UserDetails component — read-only detail-view pattern
- **Where**: `frontend/src/components/UserDetails.jsx:1-76`
- **What**: Modal-based detail view with avatar header (details-header class), name/email display (fontWeight 700, fontSize 16 for name; muted color for email), and a details-grid with label-value pairs (details-item, details-item__label, details-item__value classes). Renders role/status as badges. Story explicitly says to reuse this pattern but as a page (not modal) and with only name/email fields (not ID, phone, role, status, dates).
- **Surprises**: None — pattern is clean and reusable.
- **Open**: None. Settings page will render a similar details-header and details-grid with just name and email, stripped of modal wrapper and extra fields.

### Frontend: userApi.js — HTTP layer pattern
- **Where**: `frontend/src/services/userApi.js:1-95`
- **What**: Exports async functions for each API endpoint (getUsers, getUser, createUser, updateUser, deleteUser, getDashboardStats). Each function wraps a client.get/post/put/delete call and normalizes errors via normalizeError(). Pattern: async function, try/catch, throw normalizeError on error. Story says "a new client function (e.g. `getCurrentUser()`) will need to be added there when the backend endpoint exists". AUTH-04 research confirms backend will provide `GET /api/auth/me` returning `{name: str, email: str}` authenticated via Bearer token.
- **Surprises**: None — pattern is established and consistent.
- **Open**: None. getCurrentUser() function will follow the same pattern: export async function, client.get("/api/auth/me"), normalizeError on exception.

### Frontend: Page-level component pattern (Dashboard.jsx)
- **Where**: `frontend/src/pages/Dashboard.jsx:1-50`
- **What**: Pages receive onMenuClick callback (for sidebar toggle on mobile) and use useState for local state (stats, loadingStats, users, loadingUsers, toasts). useCallback pattern for async data fetches. Error handling: use pushToast("error", message) to display errors. Notification component renders toasts (stack pattern with auto-dismiss after 4s).
- **Surprises**: None — page pattern is established.
- **Open**: None. Settings page will follow the same: import Header, define state (currentUser, loadingUser, error, toasts), fetch on mount via useEffect, display loading/error/success states, use Notification for error toast.

### Frontend: Header component — shared across pages
- **Where**: `frontend/src/components/Header.jsx:1-24`
- **What**: Simple presentational component that accepts title and onMenuClick props, renders a topbar with menu button, title, and admin-chip.
- **Surprises**: None.
- **Open**: None. Settings page will import and render Header with title="Settings" (matching the SettingsPlaceholder pattern).

### Frontend: Notification and toast pattern
- **Where**: `frontend/src/components/Notification.jsx:1-31`
- **What**: Notification component accepts toasts array and onDismiss callback. Renders toast-stack with toast-success or toast-error classes, icons, and close button. Dashboard.jsx demonstrates usage: pushToast("error", message) on fetch failure.
- **Surprises**: None.
- **Open**: None. Settings page will use the same pushToast pattern for error display if getCurrentUser() fails.

### Backend: No auth endpoint exists yet
- **Where**: `backend/app/api/` (users.py, dashboard.py, no auth.py)
- **What**: Current API routes handle CRUD on users and dashboard stats. No `GET /api/auth/me` endpoint. AUTH-02 research assumes it will be added by AUTH-02 or AUTH-04, depending on scope split. Story AC1 explicitly depends on "GET /api/auth/me endpoint, which returns the authenticated user's name and email" and is "authenticated via the same Bearer-token mechanism as all other protected endpoints".
- **Surprises**: None — expected, AUTH-04 is responsible for backend setup.
- **Open**: Resolved — the `GET /api/auth/me` response shape is `{ "name": string, "email": string }` exactly, per the cross-story auth contract; `role` is never returned by this endpoint. Per AUTH-04 Decision log (line 107), this story depends on AUTH-04 finalizing the endpoint; AUTH-06 assumes it exists by the time AUTH-06 is implemented.

### Frontend: Design system and CSS classes
- **Where**: `frontend/src/styles/index.css` (assumed to exist)
- **What**: Based on UserDetails and other components, uses classes: details-header, details-avatar, details-grid, details-item, details-item__label, details-item__value, badge, page, page__header, page__eyebrow, page__title, page__desc, panel, state-block, btn, btn-primary, btn-secondary, Header title pattern.
- **Surprises**: None.
- **Open**: None. Settings page will reuse these classes; no custom CSS needed.

### Story acceptance criteria alignment
- **AC1**: "when the screen loads, then it displays the current authenticated user's name and email as read-only fields, sourced from the current-user identity established by AUTH-04's auth state (backed by the `GET /api/auth/me` endpoint)". Pattern: fetch on mount via useEffect, display via details-header + details-grid.
- **AC2**: "contains no password-change form, no fields for editing name/email/phone/role/status, and no other account-management action beyond "Logout"". Simple, minimal scope.
- **AC3**: "Given a user is NOT authenticated, when they attempt to navigate directly to the Settings screen..., then they are redirected to the login screen". Handled by AUTH-05 route guard; AUTH-06 scope is just the page itself (assumes guard is already in place).
- **AC4**: "when the authenticated user clicks "Logout"..., then the app-level logout flow defined in AUTH-07 is invoked". AUTH-06 owns the button wiring; AUTH-07 owns the flow. Button click calls a logout method from userApi.js or App.jsx context.
- **AC5**: "Given the current-user fetch fails (e.g. network error or session expired mid-load), when the error is caught, then a readable inline error message is shown on the Settings screen". Error handling via try/catch + pushToast pattern (or inline error banner).

---

## Pattern map

### Existing code to extend
- **`frontend/src/services/userApi.js`** — Add:
  - Export `async function getCurrentUser()` — calls client.get("/api/auth/me"), returns {name: str, email: str}, normalizes errors via normalizeError().
  - Optional: Export `async function logout()` — calls a backend endpoint to invalidate session (owned by AUTH-07; AUTH-06 may need to import and call it, or AUTH-07 owns the call and AUTH-06 just wires the button).
  
- **`frontend/src/App.jsx`** — Modify:
  - Replace SettingsPlaceholder render branch with a real Settings page component (to be created).
  - No changes to activeView state machine or auth state (already handled by AUTH-04/AUTH-05).

### Existing patterns to follow
- **Page-level component pattern** (Dashboard.jsx, Users.jsx) — Settings.jsx will follow: receive onMenuClick callback, use useState for currentUser/loadingUser/error, useEffect for fetch on mount, render Header + page content + Notification for errors.
- **Read-only detail-view styling** (UserDetails.jsx) — Reuse details-header, details-grid, details-item, details-item__label, details-item__value classes. Strip modal wrapper (render as page div instead).
- **Error normalization** (userApi.js, normalizeError) — All fetch errors are normalized to plain Error with user-friendly message; components catch and display via Notification or inline banner.
- **Data-fetch pattern** — useEffect with async function + try/catch. Set loading state, call service function, handle error (pushToast), set result on success.
- **Notification/toast pattern** (Dashboard.jsx) — Maintain a toasts array in state, push errors to it via pushToast callback, render Notification component at page level.

### New files to create
- **`frontend/src/pages/Settings.jsx`** — Page-level Settings component. Props: (onMenuClick, onLogout). State: currentUser (null initially), loadingUser (bool), error (string or null), toasts (array). useEffect on mount: call getCurrentUser(), set currentUser or error. Render: Header + page structure with details-header (avatar + name) and details-grid (name, email read-only) + Logout button + Notification for errors + loading spinner if loading. No tests file yet (story says "E2E: NA, Unit: `frontend/src/pages/__tests__/Settings.jsx`").

### Shared code at risk
- **`frontend/src/App.jsx` activeView rendering** — Currently rendersSetting via SettingsPlaceholder. Replacing it with Settings.jsx should be a drop-in swap if signatures match (onMenuClick callback, no other props needed initially).
- **`frontend/src/services/userApi.js` client instance** — Adding getCurrentUser() is a new function export; existing functions (getUsers, etc.) unchanged. Low risk; new function follows established pattern.
- **Auth state signal from AUTH-04/AUTH-05** — Resolved: Settings.jsx does not receive an isAuthenticated prop; AUTH-05's route guard in App.jsx (before the activeView switch) ensures Settings is never rendered when unauthenticated. Per AUTH-05 research, the guard gates the entire Sidebar/Header/activeView tree; Settings.jsx can assume isAuthenticated=true at render time. No guard logic in Settings.jsx itself needed (inherited from AUTH-05).

---

## Risk register

| # | Dimension       | Severity | Description                                      | Mitigation                                  |
|---|-----------------|----------|--------------------------------------------------|---------------------------------------------|
| 1 | Integration     | **Resolved** | **AUTH-04 `GET /api/auth/me` endpoint contract is now locked in**. The response shape is exactly `{ "name": string, "email": string }` — no `id`, `role`, or other fields. This is now a fixed cross-story contract, so getCurrentUser() extraction cannot be broken by AUTH-04/AUTH-02 shipping a different shape. | Mitigation: (a) The response schema is documented as a cross-story contract decision (2026-08-17), removing the need for AUTH-06 to re-verify it against AUTH-04's PR. (b) AUTH-06 implementation unit tests: mock getCurrentUser to return `{name, email}`, verify Settings page displays both fields. (c) Integration test after AUTH-04 ships: call actual endpoint, verify response matches. |
| 2 | Integration     | **Resolved** | **AUTH-07 logout callback/method contract is now locked in**. `logout()` is a plain function exported from `userApi.js` (mirrors the `getCurrentUser` pattern); it calls `clearAuthToken()` only, with no backend call. Settings.jsx's Logout handler calls `userApi.logout()` then `props.onLogout()` (a prop threaded down from App.jsx, the same way `onLoginSuccess` is threaded to LoginScreen). This is now a fixed cross-story contract. | Mitigation: (a) The logout ownership/export location is documented as a cross-story contract decision (2026-08-17), removing the need for AUTH-06 to re-verify it against AUTH-07's PR. (b) Test: mock the `logout` function and the `onLogout` prop, click Logout button, verify both are called. |
| 3 | Dependency      | **Resolved** | **AUTH-04 isAuthenticated signal availability is now locked in**. AUTH-05's route guard sits in App.jsx before the activeView switch, so Settings.jsx is only ever rendered when isAuthenticated=true; Settings.jsx does not receive an isAuthenticated prop and needs no fallback rendering for the unauthenticated case. | Mitigation: (a) The guard placement (App.jsx, before activeView rendering, not in Settings.jsx) is documented as a cross-story contract decision (2026-08-17). (b) Settings.jsx can assume isAuthenticated=true at render time; no explicit guard or fallback rendering needed. (c) Test: Settings page tests do not need to test the unauthenticated case (AUTH-05 owns that test). |
| 4 | Integration     | **MED**      | **getCurrentUser() called on every Settings page mount**. Story NFR line 71: "the current-user fetch is a single bounded request (no polling, no unbounded retries) issued once on Settings screen mount". Ensures no duplicate fetches. Implementation: useEffect with empty dependency array (runs once on mount). Risk: if Settings.jsx is re-mounted (e.g., user navigates away and back), fetch runs again. Acceptable per AC (fetch is bounded, not unbounded). | Mitigation: (a) useEffect dependency array is empty (runs once on mount, not on re-render). (b) No polling or retry loop in Settings.jsx itself (inherited from userApi.js normalizeError + single-call pattern). (c) Test: mount Settings page, verify getCurrentUser() is called once (spy on axios client or userApi.js). (d) Verify no infinite fetch loops if error occurs (catch error, set error state, render error message; do not refetch automatically). |
| 5 | Domain          | **Resolved** | **Loading and error states are now locked in**. Loading state renders a spinner next to the name/email fields, reusing the existing `.spinner` class already used elsewhere in the app (e.g. `UserForm.jsx`/`Dashboard.jsx`), not a full-page skeleton. Error state renders an inline, persistent banner (not an auto-dismissing toast), consistent with the story AC's "readable inline error message" wording. | Mitigation: (a) The loading/error UX is documented as a cross-story contract decision (2026-08-17). (b) Implementation reuses the existing `.spinner` class and an inline banner component, no new UI pattern needed. |
| 6 | Compatibility   | **MED**      | **Test isolation from auth state**. Story test mapping (line 91-95) says "tests inject a stubbed/mocked isAuthenticated signal into App.jsx, decoupling AUTH-06's tests from AUTH-04's session-persistence implementation". But Settings.jsx tests should be independent of AUTH-04/AUTH-05's auth state tests. Resolved: Settings.jsx unit tests mock the service functions (`getCurrentUser`, `logout`) directly rather than relying on AUTH-04/AUTH-05 to stub `isAuthenticated`; `isAuthenticated` is not tested in Settings.jsx — App.jsx tests cover that (AUTH-05 scope). | Mitigation: (a) Settings.jsx unit tests mock getCurrentUser() to return expected {name, email}. (b) Mock logout() function to verify button click triggers it. (c) No need to test unauthenticated case (AUTH-05 route guard scope). (d) Integration test: after AUTH-04/AUTH-05 ship, call Settings page while authenticated, verify layout and logout flow. |
| 7 | Domain          | **Resolved** | **Avatar display logic is now locked in**. No avatar is shown on the Settings screen — plain text name/email fields only, consistent with the story's "minimal, no other account management" scope. This directly follows from `GET /api/auth/me` never returning `role`. | Mitigation: (a) The no-avatar decision is documented as a cross-story contract decision (2026-08-17), so Settings.jsx does not need role data or avatar-color logic. (b) Settings page reuses `details-header`/`details-grid` structure without the avatar element. |
| 8 | Performance     | **LOW**      | **Single getCurrentUser() call on mount**. Story NFR line 71: "single bounded request...issued once on Settings screen mount; any retry on transient failure is capped and uses backoff with jitter". Per AUTH-04's error handling research, normalizeError converts network errors to plain Error with user message. No automatic retry in getCurrentUser() (one-shot call). If it fails, error is displayed; user can refresh page to retry. Per story design, no automatic retry in Settings.jsx. | Mitigation: (a) getCurrentUser() does not retry; single call via axios client (inherited from userApi.js). (b) If fetch fails, error is shown; user can manually refresh. (c) Test: simulate network error, verify error message is displayed (do not auto-refetch). (d) Performance: single GET request, expected <100ms on good network (inherited from userApi.js timeout 10s). No perf concern. |
| 9 | Security        | **Resolved** | **PII in error logs — confirmed already correct, no design change needed**. Story NFR line 80: "Errors on the current-user fetch are surfaced via the existing inline-banner/toast convention; no PII (name/email) is ever written to logs". This was a confirmation question, not a real ambiguity: normalizeError()/Settings never logs name/email; only opaque/generic messages are shown or logged, per existing convention. | Mitigation: (a) normalizeError() converts HTTP errors to user-facing messages; never includes raw response data or PII. (b) Settings.jsx: do not log currentUser data; log only opaque event (e.g., "settings_loaded") if needed. (c) Notification/toast message: show user-facing error (e.g., "Could not load your profile. Please try again."), not raw error details. (d) Test: verify error message does not include user's name or email. |
| 10| Domain          | **Resolved** | **Logout wiring responsibility is now locked in**. Settings.jsx's Logout handler calls `userApi.logout()` (clears token + axios header) then `props.onLogout()` (a prop from App.jsx calling `setIsAuthenticated(false)`). Settings.jsx does not implement any redirect logic itself — once `isAuthenticated` flips to false, App.jsx's guard automatically re-renders Login. Settings disappears automatically; no manual redirect needed. | Mitigation: (a) Logout button calls `userApi.logout()` then `props.onLogout()`. (b) `logout()` clears token (AUTH-07 scope, implemented in userApi.js). (c) App.jsx's guard (AUTH-05 scope) re-renders Login once isAuthenticated is false. (d) Test: click Logout, verify both `userApi.logout()` and `props.onLogout()` are called; verify page is replaced by Login (via App.jsx mock/integration test, not Settings.jsx unit test). |

---

## Score + verdict

### 5-dimensional rubric

| Dimension       | Weight | Pass criterion                                                              | Finding                                                                   | Score |
|---|---|---|---|---|
| Integration     | 25     | All upstream dependencies available; failure modes well understood          | AUTH-04 and AUTH-05 research are complete (GO-WITH-CONDITIONS verdicts). AUTH-04 delivers: isAuthenticated state, getCurrentUser endpoint expectation (returns {name: str, email: str}), auth state callback for 401 handling. AUTH-05 delivers: route guard to gate Settings page. AUTH-07 delivers: logout flow. However, three HIGH-risk integration questions remain: (1) AUTH-04 GET /api/auth/me response schema exact shape, (2) AUTH-07 logout callback/method export location, (3) AUTH-05 route guard placement and isAuthenticated availability. All are resolvable via PLAN.md review before AUTH-06 implementation. Failure modes: mismatched response schema → Settings displays wrong fields (test catches before merge), logout wiring mismatch → Logout button does not work (test catches), route guard prevents Settings from rendering → Settings never mounts (AUTH-05 owns this gate, AUTH-06 assumes guard is in place). All modes understood; no surprises. | 75 |
| Compatibility   | 20     | Backward compat plan exists for each affected client/version                | Frontend change: Settings.jsx is a new page, replacing SettingsPlaceholder. No existing components change; Sidebar/Header remain the same (AUTH-05 handles conditional mounting). userApi.js adds getCurrentUser() function (new, non-breaking). App.jsx swaps SettingsPlaceholder for Settings.jsx component (internal App.jsx change, no public API change). Design system (CSS classes) uses existing tokens (details-header, details-grid, page structure); no new CSS needed. localStorage key `auth_token` (AUTH-04 scope) is unchanged. No breaking changes to component APIs. Backward compat risk: minimal. | 85 |
| Domain          | 20     | Edge cases enumerated; no hidden invariants surfaced during scan            | AC1 (display name/email on load): clear, fetch on mount, render via details-header + details-grid. AC2 (no edit UI): clear, read-only fields only. AC3 (unauthenticated redirect): clear, owned by AUTH-05 route guard; Settings never renders without auth. AC4 (Logout invokes auth-07 flow): clear, button calls logout(), auth state updates via callback. AC5 (error on fetch): clear, catch error, display message. NFR (single bounded fetch, no unbounded retries, no polling): clear, useEffect with empty dependency array + single call to getCurrentUser(). Security (no PII in logs): clear, normalizeError ensures generic messages. Edge cases: (1) fetch fails → error message shown, user can refresh. (2) User logs out from Settings page → Logout button triggers logout(), auth state updates, page is unmounted/replaced by Login (handled by AUTH-05). (3) Page is mounted with no token (unauthenticated) → AUTH-05 guard prevents Settings from mounting (not Settings.jsx scope). All enumerated. | 85 |
| Performance     | 15     | Story has explicit perf budget; estimated work fits within budget           | Story NFR line 71: "single bounded request...issued once on Settings screen mount". Estimated breakdown: useEffect runs once on mount, calls getCurrentUser() (single axios GET request to /api/auth/me), expected <100ms latency on good network (inherited from userApi.js 10s timeout). Rendering: details-header + details-grid is minimal DOM, no complex layouts or animations. No debouncing, no polling. Estimated implementation: ~150 lines (Settings.jsx page component, getCurrentUser() function in userApi.js, unit tests). Fits within typical story scope. No perf risk. | 90 |
| Dependency      | 20     | All upstream stories complete; no blocking external work                    | AUTH-04: research complete, verdict GO-WITH-CONDITIONS (87/100, 10 conditions documented). AUTH-05: research complete, verdict GO-WITH-CONDITIONS (83/100, 6 conditions documented). AUTH-07: research complete, verdict GO-WITH-CONDITIONS (82/100). All upstream stories are researched; planning/implementation can proceed in parallel with AUTH-06 research once conditions are resolved. No blocking external work (backends like AUTH-02/03 are responsible for token/password, not AUTH-06's direct dependency). Dependency risk: AUTH-04/AUTH-05/AUTH-07 conditions must be verified in their respective PLAN.md files before AUTH-06 implementation (not research blocker, implementation prerequisite). | 90 |

**Total: (75×0.25 + 85×0.20 + 85×0.20 + 90×0.15 + 90×0.20) = 18.75 + 17 + 17 + 13.5 + 18 = 84.25/100**

### **Total: 84/100 → GO-WITH-CONDITIONS**

Integration scores 75 due to three HIGH-risk integration questions about upstream contracts (AUTH-04 endpoint response shape, AUTH-07 logout export, AUTH-05 route guard placement). All are resolvable via PLAN.md review and test verification before implementation. No single dimension scores <40. Compatibility (85), Domain (85), Performance (90), Dependency (90) all indicate strong feasibility. The story's scope is minimal and well-defined; all acceptance criteria are testable.

### Conditions

The following conditions must be explicitly addressed in PLAN.md before implementation:

1. **AUTH-04 GET /api/auth/me response schema (Integration, RESOLVED)**: locked cross-story contract — the response is exactly `{name: string, email: string}`, no `role`/`id`/other fields, ever. PLAN.md restates this for implementer reference; no PR-review-and-adapt step needed.

2. **AUTH-07 logout callback/method export (Integration, RESOLVED)**: locked cross-story contract — `logout()` is a plain function exported from `userApi.js` (clears the token only, no backend call). Settings' Logout handler calls `userApi.logout()` then `props.onLogout()` (a prop threaded from App.jsx, same pattern as `onLoginSuccess`). PLAN.md restates this for implementer reference.

3. **AUTH-05 route guard placement and Settings accessibility (Dependency, RESOLVED)**: locked cross-story contract — the guard lives in `App.jsx` before the `activeView` switch, not in `Settings.jsx`. Settings.jsx assumes `isAuthenticated=true` at render time, no fallback message needed, and its tests don't need to cover the unauthenticated case (AUTH-05 owns that).

4. **Loading and error UX states (Domain, RESOLVED)**: locked cross-story contract — loading state is a spinner next to the name/email fields (reusing the existing `.spinner` class), error state is an inline, persistent banner (not an auto-dismissing toast), per the story AC's "readable inline error message" wording.

5. **getCurrentUser() function signature and export (Integration, MED, open)**: PLAN.md must document: (a) ADD to userApi.js: `export async function getCurrentUser() { ... }` — calls client.get("/api/auth/me"), returns `{name: string, email: string}`, throws normalizeError on failure. (b) Response is a plain object (not wrapped in axios response.data structure); clients consume directly. (c) Test: unit test getCurrentUser() with mocked axios client, verify it makes a GET request to `/api/auth/me` and returns data.

6. **Settings.jsx component structure (Domain, MED, open)**: PLAN.md must specify: (a) Export as default: `export default function Settings({ onLogout }) { ... }`. (b) State: currentUser (initially null), loadingUser (bool), error (string|null). (c) useEffect on mount: fetch getCurrentUser(), set currentUser or error. (d) Render: Header + page layout + (if loading) spinner + (if error) inline banner + (if currentUser) details-header + details-grid (name, email only, no avatar per condition #7) + Logout button. (e) Logout button onClick: call `userApi.logout()` then `props.onLogout()`.

7. **Avatar in details-header (Domain, RESOLVED)**: locked cross-story contract — no avatar is shown; plain text name/email fields only, consistent with `GET /api/auth/me` never returning `role`.

8. **Logout button loading state (Domain, RESOLVED)**: since `logout()` is synchronous (clears localStorage + triggers the `onLogout` callback, no backend call per AUTH-07's finalized stateless-JWT mechanism), no loading state is needed on the Logout button — the click immediately triggers logout and the page is replaced by Login via App.jsx's guard.

9. **Authorization and current-user identity (Security, MED, open)**: PLAN.md must confirm: (a) Per security-baseline.md, `GET /api/auth/me` derives the current user's identity from the caller's Bearer token server-side, NOT from a client-supplied `user_id` parameter (AUTH-04/AUTH-02's responsibility, not this story's code). (b) No client-side check needed in Settings.jsx; trust server for identity.

10. **Independent test isolation (Compatibility, MED, open)**: PLAN.md must document: (a) Settings.jsx unit tests mock `getCurrentUser()` and `logout()` directly; do not rely on AUTH-04/AUTH-05 session state. (b) Tests verify: loading spinner, name/email render on resolve, error banner on reject, Logout button calls `logout()` + `onLogout()`, correct CSS classes. (c) No need to test the unauthenticated case (AUTH-05 owns that).

---

## Synthesis

**AUTH-06 is feasible for planning and implementation with documented conditions; the scope is well-defined and execution is straightforward.**

This story delivers a minimal read-only Settings page showing the current authenticated user's name and email (sourced from `GET /api/auth/me`), with a Logout button that triggers the session-invalidation flow defined in AUTH-07. The implementation reuses the existing read-only detail-view pattern from UserDetails.jsx (details-header and details-grid CSS classes), follows the page-level component pattern established by Dashboard.jsx and Users.jsx (state, useEffect for data fetch, error/loading handling via toast), and leverages the error-normalization pattern already embedded in userApi.js. The scope is bounded: no password change, no account editing, no complex features—just display + logout.

The primary integration risk is that three upstream contracts (AUTH-04's endpoint response schema, AUTH-07's logout export, AUTH-05's route guard placement) are not fully specified in research documents, but all are resolvable by reviewing PLAN.md artifacts from each upstream story before AUTH-06 implementation begins. Secondary risks (loading/error UX, avatar display, logout button loading state) are domain-level design choices, not technical blockers; all are explicitly enumerable and documented in PLAN.md conditions above. Performance is not a concern: single GET request on mount, <100ms expected. Security is straightforward: rely on server-side identity derivation (AUTH-04/AUTH-02 scope), never expose raw errors or PII to logs (inherited from normalizeError pattern).

The dependency chain (AUTH-04 + AUTH-05 + AUTH-07 → AUTH-06) is complete; all upstream stories are researched with GO-WITH-CONDITIONS verdicts, indicating their conditions must be verified before AUTH-06 implementation. No blocking external work remains.

---

## Clarifications

(none — all resolved; see cross-story auth contract decisions applied 2026-08-17.)
