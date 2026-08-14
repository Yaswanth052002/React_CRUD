# Story: USR-01 — Dedicated Users Management Page

**Epic**: USR
**Status**: Validated
**Priority**: P1
**Independent test**: true
**Owner**: unassigned
**Updated**: 2026-08-14

**Source**: [RTM](../requirements/RTM.md) · intake:raw-input
**Parent epic**: USR (User Management Page) — greenfield, not yet built

## User story

As an Admin, I want a dedicated Users page (separate from the Dashboard overview) that lets me
search, filter, paginate, view, add, edit, and delete user records, so that I can manage the
full user roster without the Dashboard being overloaded with CRUD tooling.

## Background / current-state grounding

This is forward-looking greenfield work layered on top of SRF-01 (already implemented and
merged), not a backfill. Concretely, today:

- `frontend/src/pages/Dashboard.jsx:20-375` currently contains the *entire* SRF-01
  implementation: state for `search`/`roleFilter`/`statusFilter`/`page` (Dashboard.jsx:27-31),
  a 300ms debounce effect keyed on `search` (Dashboard.jsx:104-111, `search ? 300 : 0`), stats
  cards (Dashboard.jsx:194-252), the toolbar with search input + Role/Status `<select>` filters
  + "+ Add User" button (Dashboard.jsx:254-297), `UserTable` (Dashboard.jsx:299-307), pagination
  controls with `PAGE_SIZE = 50` (Dashboard.jsx:32, 309-334), and the create/edit/view/delete
  modal wiring (Dashboard.jsx:338-370).
- `frontend/src/App.jsx:36,42-53` holds `activeView` state and **currently remaps** the `users`
  sidebar key back onto the `Dashboard` component (`activeView === "users" ? "dashboard" :
  activeView` at App.jsx:43) — there is no dedicated Users page today; clicking "Users" just
  shows the Dashboard with the "dashboard" nav item highlighted.
- `frontend/src/components/Sidebar.jsx:14-25` already defines a `users` nav item (label
  "Users", key `"users"`) — the nav entry exists, it just isn't wired to its own view.
- `frontend/src/services/userApi.js` is the sole HTTP boundary and already exposes everything
  this story needs: `getUsers({search, role, status, page, pageSize})` (userApi.js:37-50),
  `getUser(id)` (userApi.js:52-59), `createUser` (userApi.js:61-68), `updateUser`
  (userApi.js:70-77), `deleteUser` (userApi.js:79-85), and `getDashboardStats()`
  (userApi.js:87-94). No new API client functions are needed.
- Shared/reusable components already exist and must be reused as-is: `Header.jsx`,
  `StatsCard.jsx`, `UserTable.jsx`, `Modal.jsx`, `UserForm.jsx`, `UserDetails.jsx`,
  `DeleteConfirmation.jsx`, `Notification.jsx` (all in `frontend/src/components/`).
- Backend `GET /api/dashboard/stats` (`backend/app/api/dashboard.py:12-15`) returns
  `DashboardStats` (`backend/app/schemas/user.py:69-73`): `total_users`, `active_users`,
  `admin_users`, `regular_users`. `UserRepository.stats()`
  (`backend/app/repositories/user_repository.py:92-117`) computes exactly those four fields —
  there is **no `inactive_users` field** anywhere in the stack today.
- The existing SRF-01 test file `frontend/src/pages/__tests__/Dashboard.search.test.jsx`
  covers the search/debounce/filter/pagination behavior against `Dashboard.jsx` as it exists
  today.

## Acceptance criteria

1. Given the sidebar is rendered, when the Admin clicks the "Users" nav item, then the app
   navigates to a new dedicated Users page (not the Dashboard), and the "Users" nav item is
   shown in its active/highlighted state (i.e. `App.jsx`'s `activeView === "users"` remap to
   `"dashboard"` is removed and a real Users route/view is rendered).
2. Given the Users page has loaded, when it renders, then it shows a page header containing a
   "+ Add User" button, consistent with the existing page-header pattern used elsewhere in the
   app.
3. Given the Users page has loaded, when the dashboard-stats call resolves, then it displays
   four summary cards — Total, Active, Inactive, and Admin — each using the existing
   `StatsCard` component; Total/Active/Admin are sourced directly from `GET
   /api/dashboard/stats` (`total_users`, `active_users`, `admin_users`), and Inactive is
   computed client-side as `total_users - active_users` (see Decision log).
4. Given the Users page has loaded, when the user list request resolves, then a `UserTable` is
   rendered with columns ID, Name, Email, Phone, Role, Status, Created, and Actions (reusing
   the existing `UserTable` component and its current column set/props).
5. Given the Admin types into the search box, when fewer than 300ms elapse between keystrokes,
   then no new API request fires; when the Admin pauses typing for 300ms, then exactly one
   `getUsers({ search, ... })` call fires with the current input value — matching the existing
   debounce behavior in `Dashboard.jsx:104-111` (`search ? 300 : 0`).
6. Given the Admin selects a Role or Status filter, when the selection changes, then the user
   list re-fetches immediately (no debounce) with the new filter applied, and the page resets
   to page 1 (mirroring `Dashboard.jsx:98-101`).
7. Given the Admin clicks a row's view icon, when the detail view opens, then it displays the
   full user record via the existing `UserDetails` component (backed by `GET
   /api/users/{id}`).
8. Given the Admin clicks "+ Add User" and submits a valid form, when the request succeeds,
   then the modal closes, a success toast is shown, and the user list and stats both refresh
   (mirroring `refreshAll()` in `Dashboard.jsx:113-115`); when the request fails (e.g. duplicate
   email → 409), then the form surfaces the server's error message without closing the modal.
9. Given the Admin clicks a row's edit icon and submits changes, when the request succeeds,
   then the modal closes, a success toast is shown, and the list/stats refresh; when it fails,
   then a readable error is shown inline in the form (never a raw stack trace).
10. Given the Admin clicks a row's delete icon, when the confirmation dialog is shown and the
    Admin confirms, then `DELETE /api/users/{id}` is called, a success toast is shown, and the
    list/stats refresh; when the Admin cancels, then no request is made and the row is
    unchanged.
11. Given more users exist than fit on one page, when the Admin navigates via Previous/Next,
    then the table refetches the corresponding page using the existing `page`/`pageSize`
    pagination contract (`PAGE_SIZE = 50`, matching `Dashboard.jsx:32`), and the "Previous"
    button is disabled on page 1 while "Next" is disabled on the last page.
12. Given the initial API calls are in flight, when the page first renders, then loading
    states are shown for both the stats cards and the table (matching existing
    `loadingStats`/`loadingUsers` patterns).
13. Given the backend returns zero users with no filters active, when the table renders, then
    an empty state is shown (via `UserTable`'s existing `hasActiveFilters`-driven state).
14. Given the backend returns zero users because of an active search/filter, when the table
    renders, then a "no results for this filter" state is shown (same `UserTable` mechanism as
    #13, `hasActiveFilters = true`).
15. Given the user-list request fails, when the error is caught, then a readable inline error
    banner is shown near the table (mirroring `Dashboard.jsx:182-192`), never a raw stack
    trace; given the stats request fails, then a non-blocking error toast is shown (mirroring
    `Dashboard.jsx:83-86`) and the page remains usable.
16. Given the Dashboard page (separate from this new Users page) is loaded, when this story
    ships, then Dashboard continues to render as an overview and its own existing test file is
    either preserved covering only what remains in Dashboard, or its search/pagination-specific
    coverage is relocated to a Users-page-scoped test file — `Dashboard.search.test.jsx` must
    not be deleted or left asserting against behavior no longer present in `Dashboard.jsx`.

## Non-functional requirements

- Performance: Per `.claude/rules/performance-baseline.md`: the Users page list endpoint call
  stays on the existing paginated contract (`page`, `pageSize`, default `PAGE_SIZE = 50`,
  matching `Dashboard.jsx:32`) — no unbounded fetch of the full user set. Search input remains
  debounced at 300ms (`Dashboard.jsx:104-111`) to bound request rate while typing.
- Accessibility: Per `.claude/rules/accessibility-baseline.md`: applies to all new UI surfaces
  in this story (new Users page container, its search input, Role/Status filter selects,
  pagination controls, and any newly-extracted toolbar/header component). Reused components
  (`UserTable`, `Modal`, `UserForm`, `UserDetails`, `DeleteConfirmation`) already carry their
  existing accessibility affordances (labels, `aria-label`s, live regions) and must not be
  weakened as they are relocated/reused.
- Security: Per `.claude/rules/security-baseline.md`: no new PII surfaces beyond what the
  existing Dashboard already displays (name/email/phone/role/status). All requests continue to
  route through `frontend/src/services/userApi.js` only; no direct Axios calls from the new
  page/components. Server-side validation and 409-on-duplicate-email behavior are unchanged
  (reused, not reimplemented).
- Observability: Errors are surfaced to the user via the existing toast/inline-banner
  conventions (`Dashboard.jsx:83-86`, `:182-192`); no new logging requirements beyond what the
  existing API layer already does.
- Testability: Frontend Vitest coverage for the new Users page must cover the flows enumerated
  in Test mapping below, at parity with (not less than) the existing
  `Dashboard.search.test.jsx` coverage of search/debounce/filter/pagination behavior.

## Dependencies

- Upstream: None required to start. SRF-01 (`frontend/src/pages/Dashboard.jsx`,
  `frontend/src/services/userApi.js`, backend pagination on `GET /api/users`) is already
  implemented, merged, and validated (`docs/state/features.json` SRF-01: `phase:
  security-reviewed`, `gate: APPROVE`) — this story reuses and relocates that logic; it is not
  blocked on further SRF-01 work.
- Downstream: None identified yet.

## Test mapping

- E2E: NA (no e2e suite configured in this repo per `docs/config/project-commands.yaml`).
- Unit (Vitest, to be created during implementation):
  - `frontend/src/pages/__tests__/Users.jsx` (or equivalent new page test file) — covers
    render of header/"+ Add User", stats cards (incl. client-derived Inactive), table columns,
    search debounce (300ms), Role/Status filter behavior, pagination Previous/Next, add/edit/
    delete CRUD flows (success + error paths), loading/empty/no-results/error states.
  - `frontend/src/pages/__tests__/Dashboard.search.test.jsx` — relocated/adapted (not deleted)
    to continue asserting the same search/pagination behavior against its new home (the Users
    page), OR retained against a slimmed-down Dashboard if any of that behavior remains there;
    exact disposition is an implementation-time decision, not a requirement change.
- Manual: Click through sidebar "Users" nav → confirm active-state highlighting and that the
  Dashboard route is not shown; exercise search/filter/pagination/CRUD against a running
  backend to confirm parity with current Dashboard behavior; confirm Dashboard itself still
  loads as an overview.

## Clarifications

None outstanding — see Decision log for how the two implementation-detail ambiguities
identified during story drafting were resolved.

## Decision log

- 2026-08-14 Inactive-users stat source: derive client-side as `total_users - active_users`
  from the existing `GET /api/dashboard/stats` response rather than adding a new
  `inactive_users` field to the backend. Rationale: per `.claude/rules/reusability-baseline.md`
  and `.claude/rules/surgical-changes.md` (touch only what the task requires; avoid
  unnecessary API/schema churn), and because `total - active` is a strict subset of data
  already returned — no backend/schema/repository change needed for a purely-derived value.
  If a future story needs "inactive" as a first-class filterable/sortable stat independent of
  total/active, revisit then.
- 2026-08-14 Sidebar/App routing change scope: `frontend/src/App.jsx`'s remap of the `"users"`
  activeView key onto `Dashboard` (`App.jsx:43`) will be replaced with a real conditional
  branch rendering a new Users page component, following the same pattern already used for
  `"settings"` → `SettingsPlaceholder` (`App.jsx:50-53`). Rationale: minimal, idiomatic change
  consistent with existing code structure; no new routing library needed for a single-page
  admin console with three views.
- 2026-08-14 Component placement: new dedicated Users page/toolbar/pagination logic lives in a
  new file (e.g. `frontend/src/pages/Users.jsx`) rather than inside `Dashboard.jsx`, per the
  explicit instruction in raw intake and `.claude/rules/reusability-baseline.md` (single
  responsibility per module). Shared presentational components (`UserTable`, `StatsCard`,
  `Modal`, `UserForm`, `UserDetails`, `DeleteConfirmation`, `Notification`, `Header`) remain
  generic and are imported by both `Dashboard.jsx` and the new `Users.jsx`, not duplicated.

## Validation log

- 2026-08-14T00:00:00Z Round 1 — v1 — Score: 100/100 (Completeness 20, Testability 25,
  Feasibility 15, Clarity 10, Clarity-Unresolved 5, Traceability 10, NFR Coverage 15) — PASS.
  All required fields present (incl. `priority: P1`, `independent_test: true`); 16 Given/When/Then
  ACs, all observable and independently testable; no blocking unknowns (reuses existing,
  already-implemented components/endpoints — SRF-01 merged); no ambiguous pronouns, extensive
  file:line grounding; zero `[NEEDS CLARIFICATION]` markers in body and empty Clarifications
  section (both prior implementation-detail ambiguities resolved and logged in Decision log); RTM
  row present (`docs/requirements/RTM.md` USR-01) with valid story-file link; Performance,
  Security, Accessibility, and Observability NFRs stated with concrete, non-vague budgets (300ms
  debounce, `PAGE_SIZE = 50`, named baseline rule files). No self-correction required.
