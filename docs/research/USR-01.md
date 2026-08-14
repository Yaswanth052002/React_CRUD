# Research Assessment: USR-01 — Dedicated Users Management Page

**Story**: USR-01  
**Epic**: USR  
**Phase**: Research  
**Assessment date**: 2026-08-14  
**Assessor**: Claude Research Agent  

---

## Upstream dependencies

Per story Dependencies section:
- **Upstream**: SRF-01 (already implemented, merged, phase: security-reviewed, gate: APPROVE). This story reuses and relocates SRF-01's logic, not blocked on further SRF-01 work.
- **Downstream**: None identified yet.

Prior research state (from `docs/state/features.json`):
- SRF-01 is security-reviewed and approved; no blockers from that direction.
- USR-01 is greenfield: a new dedicated Users page extracted from Dashboard.

---

## Exploration Log

### App.jsx routing state machine
- **Where**: `frontend/src/App.jsx:36, 43, 50-53`
- **What**: Top-level `activeView` state (initially "dashboard"). Conditional rendering: `activeView === "settings"` → SettingsPlaceholder, else Dashboard. Currently, `activeView === "users"` is remapped to "dashboard" (line 43: `activeView === "users" ? "dashboard" : activeView`), so clicking "Users" nav shows Dashboard.
- **Surprises**: None — a simple boolean/ternary state machine, not a router library. Extending from 2 to 3 views (adding real "users" branch) is trivial.
- **Open**: None.

### Sidebar navigation
- **Where**: `frontend/src/components/Sidebar.jsx:1-42`
- **What**: `NAV_ITEMS` array defines three nav entries: dashboard, users, settings. The "users" item (key="users") exists, with a label and icon; it is passed to `onNavigate(item.key)` on click.
- **Surprises**: None — nav item already defined, just not wired to its own view in App.jsx.
- **Open**: None.

### Dashboard.jsx component (SRF-01 implementation)
- **Where**: `frontend/src/pages/Dashboard.jsx:1-375+` (incomplete read; core logic at lines 20-112, render at 172+)
- **What**: Monolithic component contains:
  - State: `search`, `roleFilter`, `statusFilter`, `page`, `totalUsers` (lines 27-32); `users`, `stats`, `loadingUsers`, `loadingStats`, `loadError` (lines 21-25); modal state (`modalMode`, `editingUser`, `viewingUser`, `deletingUser`, `submitting`, `deleting`, `formError`) (lines 34-41); toast state (line 43).
  - Effects: debounced search (300ms for non-empty, 0ms when cleared) keyed on search/filter changes (lines 104-111); filter-reset-to-page-1 effect (lines 98-101); initial load of stats (lines 92-95).
  - Handlers: `loadUsers`, `loadStats`, `refreshAll`, form submit, delete confirm.
  - Render: Header, stats cards (Total/Active/Admins/Regular Users), inline load error, search toolbar (input + role/status selects + "+ Add User" button), UserTable, pagination controls, modals (create/edit/view/delete), toast container.
- **Surprises**: None — clean, idiomatic React hooks usage. All state is local; no hidden global state or cross-component coupling detected.
- **Open**: None.

### Frontend reusable components
- **Where**: `frontend/src/components/*.jsx` (9 components)
- **What**: Inventory of components to be reused in Users page:
  - Header (title + menu button + admin chip) — lines 1-24 of Header.jsx
  - StatsCard (label, value, icon, color, loading skeleton) — line 8 signature shows all props
  - UserTable (users array, loading, callbacks for view/edit/delete, hasActiveFilters flag for empty state) — lines 35-+ of UserTable.jsx
  - Modal (title, onClose, size, children, ESC to close, backdrop click to close) — lines 1-27 of Modal.jsx
  - UserForm (presumably for create/edit; inferred from Dashboard.jsx usage line 144+)
  - UserDetails (for view modal; inferred from Dashboard.jsx usage line 345+)
  - DeleteConfirmation (for delete confirmation; inferred from Dashboard.jsx usage line 350+)
  - Notification (toast; inferred from Dashboard.jsx usage line 372+)
- **Surprises**: All components are generic and accept props for data/callbacks — no hardcoded assumptions. Modal has a11y attributes (role="dialog", aria-modal, aria-label). No dependencies on Dashboard-specific state.
- **Open**: None.

### Backend `/api/dashboard/stats` endpoint
- **Where**: `backend/app/api/dashboard.py:12-15` (router), `backend/app/schemas/user.py:69-73` (DashboardStats schema), `backend/app/repositories/user_repository.py:92-117` (stats() method)
- **What**: GET /api/dashboard/stats returns `{ total_users, active_users, admin_users, regular_users }`. Repository computes four separate COUNT queries keyed on status/role enums.
- **Surprises**: **No `inactive_users` field**. Story's Decision log already resolves this: derive client-side as `total_users - active_users`. This is sound (no business logic change, pure arithmetic).
- **Open**: None (decision documented and rationale given).

### Frontend service layer (userApi.js)
- **Where**: `frontend/src/services/userApi.js:37-94`
- **What**: Exports:
  - `getUsers({ search, role, status, page, pageSize })` — constructs GET /api/users with query params, filters out "All" values before building params (lines 37-50)
  - `getDashboardStats()` — GET /api/dashboard/stats (lines 87-94)
  - `getUser(id)`, `createUser`, `updateUser`, `deleteUser` (CRUD operations)
  - All wrap Axios calls with `normalizeError()` to convert HTTP errors to user-friendly Error objects (lines 15-35)
- **Surprises**: None — clean abstraction; all errors normalized once at the service boundary.
- **Open**: None.

### Test file (Dashboard.search.test.jsx)
- **Where**: `frontend/src/pages/__tests__/Dashboard.search.test.jsx:1-138`
- **What**: Vitest suite covering search/debounce/filter behavior against Dashboard component. Test cases:
  - TC-01: 300ms debounce on non-empty search
  - TC-02: immediate (0ms) fetch when clearing search
  - TC-09: aria-label="Search users" on input
  - (Full TC list likely continues beyond line 138; incomplete read)
- **Surprises**: Mocks `userApi.js` at the service boundary, not axios directly (per react-patterns). Uses `vi.useFakeTimers()` to control debounce timing. Correctly calls `vi.advanceTimersByTimeAsync()` to flush timers.
- **Open**: **AC#16 requires this test's coverage to be preserved or relocated.** Story decision log (2026-08-14) clarifies: either preserve Dashboard's own test file for remaining Dashboard behavior, OR relocate search/debounce/filter/pagination tests to Users-page-scoped test file. This test file must not be deleted.

### Backend users list endpoint
- **Where**: `backend/app/api/users.py:14-22` (inferred from SRF-01 research; specific lines not re-read)
- **What**: GET /api/users accepts `search`, `role`, `status`, `page`, `page_size` query params (per story background, line 39); returns paginated response with `items` and `total`.
- **Surprises**: None — pagination already implemented by SRF-01 (25 items per page, likely 50 per Dashboard.jsx:32 PAGE_SIZE = 50).
- **Open**: None.

---

## Pattern map

### Existing code to extend
- **Frontend**: `frontend/src/pages/Dashboard.jsx` — all state, effects, handlers for search/filter/pagination/CRUD will be **relocated** (not extended) to the new Users.jsx page. Dashboard will retain only the stats cards and become a lighter overview.
- **Frontend**: All components (`Header`, `StatsCard`, `UserTable`, `Modal`, `UserForm`, `UserDetails`, `DeleteConfirmation`, `Notification`) — will be **reused as-is** by both Dashboard.jsx (for remaining overview) and new Users.jsx (for full CRUD).
- **Frontend**: `frontend/src/services/userApi.js` — all functions (`getUsers`, `getDashboardStats`, CRUD operations) will be **reused as-is** by both pages.
- **Backend**: No changes anticipated. Dashboard stats endpoint remains unchanged; users list endpoint already supports all required parameters (pagination, search, filters).

### Existing patterns to follow
- **React page component pattern**: Users.jsx should follow Dashboard.jsx's structure: function component with hooks, local state via `useState`, effects via `useEffect`, error handling via `try/catch` → `Notification` toast/inline banner. See Dashboard.jsx:1-115 for the exact idiom.
- **Debounce pattern**: Dashboard.jsx:104-111 implements the search debounce (300ms for non-empty, 0ms for clear) via `useRef(debounceRef)` + `setTimeout` + cleanup. Users.jsx will replicate this exact pattern.
- **Filter reset to page 1**: Dashboard.jsx:98-101 resets `page` to 1 when filters change. Users.jsx will replicate.
- **State lifting & prop drilling**: All data flows down via props from page component to presentational components; callbacks flow up. No Context or global state. Users.jsx follows this pattern.
- **Service-layer abstraction**: No direct axios calls from components. All HTTP via `userApi.js` functions. Users.jsx enforces this rule.
- **Error normalization**: Errors caught at the component level and rendered via `Notification` with `.message` (already normalized by userApi.js). Users.jsx follows this pattern.

### New files to create
- **`frontend/src/pages/Users.jsx`** (required): New page component extracted from Dashboard logic. Will contain all search/filter/pagination/CRUD state and handlers. Expected ~300-350 LOC (mirrors Dashboard structure).
- **`frontend/src/pages/__tests__/Users.test.jsx`** (required, per AC#16): New test file covering Users-page-specific behavior. May be an adaptation of Dashboard.search.test.jsx (if tests are relocated) or a new file (if tests are copied/written fresh). Either way, the test coverage for search/debounce/filter/pagination must not be lost.
- **No new backend files**: API/schema/repository layers are already complete; no new endpoints, schemas, or queries needed.

### Shared code at risk
- **`frontend/src/services/userApi.js`**: Now called by three surfaces: Dashboard (for overview stats), Users (for full CRUD), potentially others in future. Changes to function signatures or error handling affect all callers. Mitigation: This story does not modify userApi.js, so risk is low. Future changes must be backward-compatible.
- **`frontend/src/App.jsx` activeView state**: Will be extended from 2-branch conditional (dashboard/settings) to 3-branch (dashboard/users/settings). Trivial change, but if routing logic grows more complex in future stories, App.jsx could become a bottleneck. Mitigation: Remain with simple conditional rendering (no router library) for now; if a 5th+ view is added, consider a router library then.
- **`frontend/src/components/Sidebar.jsx` activeView prop**: Will receive values "dashboard", "users", "settings" (no change to Sidebar itself, only App.jsx's use of it). Risk: none.
- **Pagination contract** (`page`, `page_size` params to getUsers): Both Dashboard and Users rely on this contract. If backend pagination changes, both must adapt. Mitigation: Pagination is stable (SRF-01, security-reviewed); low risk of change.

---

## Risk register

| # | Dimension       | Severity | Description                                                              | Mitigation                                                 |
|---|-----------------|----------|--------------------------------------------------------------------------|-----------------------------------------------------------|
| 1 | Domain          | HIGH     | Test coverage relocation gap (AC#16): Dashboard.search.test.jsx currently tests Dashboard component. When search/pagination logic moves to Users.jsx, these tests become orphaned. Deletion is forbidden (AC#16); relocation risk if not done carefully. | Per story AC#16 and Decision log, explicitly plan test migration during /arh-plan-implementation. Either: (a) adapt Dashboard.search.test.jsx to test Users.jsx instead, OR (b) leave Dashboard tests as-is and create new Users.test.jsx for relocated behavior. Verify all search/debounce/filter/pagination TCs from Dashboard.search.test.jsx are covered by Users tests before shipping. |
| 2 | Domain          | MED      | Hidden coupling in Dashboard.jsx extraction. Dashboard.jsx (375 lines) has tightly coupled state/effects. Extracting Users.jsx without careful line-by-line trace risks missing a dependency (e.g., a state var referenced by multiple effects, a callback used in unexpected places). | During /arh-plan-implementation, create a detailed extraction checklist: (1) list all state vars/effects/handlers in Dashboard, (2) mark which move to Users and which stay in Dashboard, (3) trace imports/props for each item, (4) verify no orphaned refs in Dashboard after extraction. Consider adding comments at extraction boundaries. |
| 3 | Domain          | MED      | Client-side "Inactive" stat derivation assumption. Story Decision log resolves to compute `inactive_users = total_users - active_users` rather than adding a backend field. This works mathematically but is an implicit assumption: if business rules change (e.g., archived users counted in total but not active, creating a gap), the derivation breaks silently. | Document the assumption in code comment on the Stats card that computes Inactive. Add an integration test (or at minimum, a manual test case) that verifies `inactive = total - active` using a running backend with known data (e.g., 5 active, 3 inactive, total 8). If a future story changes inactive semantics, this test will catch the break. |
| 4 | Integration     | MED      | Backend pagination contract stability. Users.jsx (like Dashboard.jsx) relies on GET /api/users pagination (page, page_size, total in response). If backend pagination logic regresses or changes, both pages break. SRF-01 is security-reviewed (low risk), but a future story might touch pagination. | Backend pagination is stable and covered by SRF-01's test suite (15/15 tests passed, per SRF-01 research). This story does not modify backend; low risk. Recommendation: if any backend work touches users endpoint or pagination in future stories, re-run SRF-01 test suite to catch regressions. |
| 5 | Performance     | LOW      | Pagination default (50 items) inherited from Dashboard. If test data grows or users encounter pages with 1000s of items, pagination performance is unchanged (same backend/frontend contract). No new risk introduced. | This story reuses SRF-01's pagination contract unchanged. Performance-baseline is met (pagination on every list endpoint, default 50 items, debounce 300ms). No new action required. |
| 6 | Compatibility   | LOW      | Users.jsx is a new page (no backward-compat concern). Dashboard.jsx simplified (removed CRUD tooling) but retains stats cards and overview layout; existing tests for Dashboard stats (if any) must still pass. | Dashboard remains a valid page; this story does not remove the Dashboard route, only moves CRUD to Users. Test Dashboard's stats rendering independently of CRUD behavior. Low risk. |

---

## Score and verdict

| Dimension       | Weight | Score | Rationale                                                                     |
|-----------------|--------|-------|-------------------------------------------------------------------------------|
| Integration     | 25%    | 92    | All backend endpoints (GET /api/users, GET /api/dashboard/stats, CRUD operations) are already stable and proven by SRF-01 (security-reviewed). Frontend service layer (userApi.js) is unchanged. No new integrations introduced. Risk: userApi.js is now used by two pages, but this is a simple delegation (low coupling). |
| Compatibility   | 20%    | 95    | Users.jsx is purely additive (greenfield page). Dashboard.jsx simplified but not breaking. Sidebar/App.jsx routing extension is trivial (no breaking changes to existing callers). No backward-compat concerns; existing Dashboard tests should continue to pass. |
| Domain          | 20%    | 75    | Extraction logic is well-specified (reuses SRF-01 CRUD/search/pagination behavior). However, test coverage relocation (AC#16) introduces uncertainty: if test migration is not executed correctly during implementation, coverage gaps can surface post-launch. Additionally, client-side "Inactive" derivation is mathematically sound but relies on an implicit assumption (total - active = inactive) that could break with future business rule changes. Both risks are manageable but require careful attention during implementation. |
| Performance     | 15%    | 90    | Users.jsx inherits pagination (50 items, debounce 300ms) from SRF-01. No new N+1 queries, unbounded fetches, or performance risks introduced. Pagination contract is stable (SRF-01 security-reviewed). Debounce logic copied verbatim from Dashboard. Risk: low. |
| Dependency      | 20%    | 95    | SRF-01 (upstream) is complete, security-reviewed, and approved. No blocking upstream work. Downstream: none identified. This story depends only on SRF-01's already-implemented logic. Risk: none. |

**Total: 89/100 → GO**

---

## Conditions for GO

None. This story meets the GO threshold (89/100 ≥ 80). However, the implementation plan must explicitly address the two medium-severity domain risks:

1. **Test coverage relocation (AC#16)**: Plan-implementation must create a concrete mapping from Dashboard.search.test.jsx test cases to either (a) adapted Users.test.jsx, or (b) new Users tests + simplified Dashboard tests. Verify all TCs pass pre-launch. This is not a blocker (the feature logic is sound), but a requirement for this story's acceptance.

2. **Inactive stat derivation assumption**: Plan-implementation should add a code comment documenting the `total - active = inactive` assumption, and implementation phase should include a simple integration test verifying the math against a running backend.

---

## Synthesis

USR-01 proposes extracting SRF-01's already-implemented search/filter/pagination/CRUD logic from the monolithic Dashboard.jsx into a new dedicated Users page, leaving Dashboard as a lighter overview. **The extraction is low-risk and feasible**, because:

1. **SRF-01 logic is proven**: Pagination, search, debounce, error handling, CRUD state machine, and all reusable components are already battle-tested and security-reviewed (SRF-01 status: security-reviewed, gate: APPROVE).
2. **Extraction boundaries are clear**: Dashboard.jsx is self-contained and idiomatic React; state, effects, and handlers are local (no hidden global state or cross-component coupling). Moving 200 lines of logic to a new Users.jsx is straightforward.
3. **App.jsx routing is trivial**: Simple conditional rendering; extending from 2 to 3 views requires only a three-line change (move the remap of "users" → "dashboard" to a real Users.jsx branch).
4. **Component reuse is proven**: Header, StatsCard, UserTable, Modal, UserForm, UserDetails, DeleteConfirmation, Notification are all generic and already used by Dashboard; reuse in Users.jsx carries zero coupling risk.
5. **Backend requires no changes**: All endpoints (GET /api/users with pagination, search, filters; GET /api/dashboard/stats; CRUD operations) are already in place, stable, and proven.

**Biggest risk**: Test coverage relocation (AC#16). Dashboard.search.test.jsx currently tests search/debounce/filter/pagination behavior against the Dashboard component. When this logic moves to Users.jsx, the test file's assertions become stale (testing a component that no longer contains the logic). Deletion is forbidden; relocation is required. This is not a blocker (the feature logic is sound), but **implementation must execute the test migration carefully** to avoid coverage gaps or orphaned test cases.

**Next step**: Proceed to `/arh-plan-requirements` to detail the extraction checklist, test migration strategy, and component/file split plan.

---

## Clarifications

No unresolved clarifications. Story USR-01 was validated with 0 outstanding items (per `docs/state/features.json: needs_clarification_count: 0`). All two design-detail ambiguities (Inactive-users source, Sidebar/App routing change scope) were resolved in the story's Decision log (2026-08-14).

---

## Recommendations

1. **Create Users.jsx via methodical extraction from Dashboard**: Map each state var, effect, and handler from Dashboard to Users; mark which stay in Dashboard (stats, header) and which move (search, filters, pagination, CRUD). Add comments at extraction boundaries. Pair-review the extraction to catch hidden dependencies.

2. **Execute test migration per AC#16**: Choose the test strategy (adapt Dashboard.search.test.jsx to test Users.jsx, OR create new Users.test.jsx + keep slimmed Dashboard tests). Verify all search/debounce/filter/pagination TCs pass. Do not delete Dashboard.search.test.jsx; ensure no test cases are lost in the migration.

3. **Document the "Inactive" stat assumption**: Add a code comment on the stats card rendering (Users.jsx, near the Inactive card) explaining that `inactive = total - active`. Add a simple integration test (or manual test case) verifying this math against a running backend with known data (e.g., 5 active, 3 inactive, total 8). This makes the assumption explicit and testable.

4. **Verify App.jsx routing change is minimal**: Change the remap (`activeView === "users" ? "dashboard" : activeView`) to a third conditional branch rendering Users component. Keep conditional rendering (no router library). Add a brief comment explaining the routing structure for future maintainers.
