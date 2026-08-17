# Story: SRF-01 — Search users by name, email, or phone

**Epic**: SRF
**Source**: intake:raw-input
**Status**: Validated
**Priority**: P1
**Independent test**: true
**Owner**: Full-stack (brownfield backfill — no named owner in source system)
**Updated**: 2026-08-14

> Brownfield backfill note: this capability is already implemented end-to-end. The acceptance
> criteria below document verified current behavior (with file:line citations), not new-build
> aspirational behavior.

> Extension note (2026-08-14): AC #4 below is new-build scope, added after `feature/USR-01`
> (dedicated Users management page) was merged into this branch. It is not a brownfield backfill
> like ACs #1-#3 — see `docs/features/SRF-01/REQUIREMENTS.md` § SRF-01-FR-2.

> Extension note (2026-08-17): AC #5 below is a second new-build layout refinement, extending the
> `SRF-01-FR-2` "User Overview" panel with a compact overview restructure (status/role breakdown
> panels + a Recent Users preview). Same in-place-amendment pattern as AC #4 — no new story was
> created. See `docs/features/SRF-01/REQUIREMENTS.md` § SRF-01-FR-3.

## User story

As an admin using the dashboard, I want to search users by name, email, or phone so that I can
quickly locate a specific user record without scrolling the full table.

## Acceptance criteria

1. Given the dashboard is loaded, when the admin types a value into the search input
   (`frontend/src/pages/Dashboard.jsx:247-250`), then after a 300ms debounce
   (`frontend/src/pages/Dashboard.jsx:90-92`, `search ? 300 : 0`) the frontend calls
   `getUsers({ search, role, status })` (`frontend/src/services/userApi.js:37-40`), which issues
   `GET /api/users?search=<value>` (`backend/app/api/users.py:16-22`).
2. Given a search term is submitted, when the backend processes the request, then it matches
   case-insensitively against `name`, `email`, and `phone` via a `LIKE`-wrapped substring match
   (`User.name.ilike`, `User.email.ilike`, `User.phone.ilike` —
   `backend/app/repositories/user_repository.py:26-32`), returning only users where at least one
   of the three fields contains the term.
3. Given the search input is cleared, when the value becomes empty, then the debounce delay is
   0ms (immediate refetch, `frontend/src/pages/Dashboard.jsx:92`) and the full unfiltered user
   list is returned (verified by `backend/tests/test_users.py:154-158`, `test_search_filters_by_name_email_phone`).
4. Given the dashboard is loaded, when the dashboard-stats request resolves, then a bordered
   "User Overview" section renders five compact summary cards — Total, Active, Inactive, Admin,
   and Regular Users — reusing the existing `StatsCard` component; Inactive is computed
   client-side as `total_users - active_users` (no backend/API change); the section reflows
   responsively at the existing `.stats-grid` breakpoints (1100px, 640px); and all existing
   Users-page CRUD/search/filter/pagination behavior (`frontend/src/pages/Users.jsx`) is
   unaffected.
5. Given the dashboard-stats request resolves, when the admin views the Dashboard below the
   "User Overview" section, then two side-by-side panels render — "User Status" (Active vs.
   Inactive, each with a proportional horizontal bar and count) and "Users by Role" (Admin vs.
   Regular, same treatment) — which stack vertically on narrow viewports; below them, a
   full-width "Recent Users" section shows a compact table (Name, Email, Role, Status, Created)
   of the most-recently-created users (a small fixed subset, derived client-side from the
   existing `getUsers()` response already used elsewhere in the app — no new backend endpoint or
   field), plus a "View All Users →" link that navigates to the existing Users page; no existing
   CRUD/search/filter/pagination/API behavior is changed.

## Non-functional requirements

- Performance: search input is debounced 300ms client-side before firing a request
  (`frontend/src/pages/Dashboard.jsx:92`); server-side budget set at p95 < 300ms under 50 RPS
  for `GET /api/users` (per `.claude/rules/performance-baseline.md` — no measurement exists yet,
  this is the target to profile against, not a verified current value).
- Security: no auth/authorization is enforced on this endpoint today; per brownfield backfill
  scope, this story documents current behavior only — the endpoint is intentionally open in the
  present build, and adding auth is out of scope for this story (tracked as a known gap, not a
  blocking requirement here).
- Accessibility: search input has `aria-label="Search users"` (`frontend/src/pages/Dashboard.jsx:250`); no other WCAG-specific behavior (e.g. live-region announcement of result count) is implemented. Per `.claude/rules/accessibility-baseline.md`: the new "User Overview" section (AC #4) uses a semantic `<section>` with an accessible heading; stat cards remain non-interactive, introducing no new focusable elements.
- Observability: no logging/metrics are emitted around search requests or query latency in the current code.
- Performance (AC #4): no new network request — the Inactive-Users value is a pure client-side arithmetic derivation from the existing `getDashboardStats()` response already fetched by `Dashboard.jsx`.

## Dependencies

- Upstream: none (search is independently functional against `GET /api/users` with no `role`/`status` params).
- Downstream: SRF-02 (filter by role), SRF-03 (filter by status), SRF-04 (combine search + filters)
  all compose with this search parameter at the same `GET /api/users` endpoint and the same
  `frontend/src/pages/Dashboard.jsx` state (`search`, `roleFilter`, `statusFilter`).

## Test mapping

- E2E: NA (no frontend E2E suite present in repo).
- Unit: `backend/tests/test_users.py::test_search_filters_by_name_email_phone` (backend);
  no frontend unit test currently covers the debounce/search-input wiring in
  `frontend/src/pages/Dashboard.jsx` — gap, not covered by `npm run test` today.
- Manual: verify search box returns matching rows for partial, case-mixed input against name,
  email, and phone fields.
- Unit (AC #5): `frontend/src/pages/__tests__/Dashboard.search.test.jsx` — status/role breakdown
  panels, Recent Users subset/columns, and "View All Users →" navigation (SRF-01-TC-16..21).

## Clarifications

<!-- none unresolved -->

## Decision log

- 2026-08-14 Owner: Full-stack, unassigned (brownfield backfill has no named owner) — resolved
  via best judgment during story validation.
- 2026-08-14 Performance budget: p95 < 300ms under 50 RPS for `GET /api/users` — resolved via
  best judgment (per `.claude/rules/performance-baseline.md`), pending real measurement.
- 2026-08-14 Auth scope: endpoint intentionally left open in current build; adding
  authentication is out of scope for this story and tracked as a known gap — resolved via best
  judgment given brownfield backfill scope (document current behavior, not new-build behavior).
- 2026-08-14 Extension (AC #4): story amended post-merge (feature/USR-01 → feature/SRF-01) to
  add a Dashboard "User Overview" layout enhancement, per explicit user request. No new story
  was created; the existing SRF-01 id is reused per user instruction. Inactive-Users color
  reuses the existing `.badge-inactive` neutral-gray convention (`var(--ink-muted)` / `#eef0f3`)
  rather than the `--danger` token, consistent with the app's existing semantic color language.
  No mini-ADR was written for this extension — every implementation choice is either dictated by
  explicit constraints (client-side derivation, no new API, no new dependency) or a small,
  reversible CSS/JSX change with a single obvious precedent to follow (same bar `plan-authoring`
  used to skip a mini-ADR for the original SRF-01-FR-1). Approved via direct user confirmation
  in-session (functionally equivalent to the Product Gate `AskUserQuestion` ceremony used for
  the original PRD).
- 2026-08-17 Extension (AC #5): story amended in-place a second time (still `feature/SRF-01`) to
  add a compact-overview restructure — "User Status" and "Users by Role" breakdown panels plus a
  "Recent Users" preview — per explicit user request. No new story was created. "Recent Users"
  data is derived client-side by sorting the existing `getUsers({ page: 1, pageSize: 50 })`
  response (the already-frozen default page, per `docs/adr/0003-users-list-pagination.md`) on
  `created_at` descending and taking the top 5, rather than adding a backend sort/limit
  parameter — resolved via best judgment as the smallest change consistent with the "no new
  backend API unless absolutely required" constraint; flagged in `PLAN.md` § 1b as the one
  judgment call in this amendment. Approved via direct user confirmation in-session.

## Validation log

- 2026-08-14T00:00:00Z Round 1 — v1 — Score: 80/100 (raw dims: Completeness 20, Testability 25,
  Feasibility 15, Clarity 10, Clarity-Unresolved 0, Traceability 10, NFR Coverage 8) — FAIL
  (Clarity-Unresolved <60: 3 unresolved `[NEEDS CLARIFICATION]` markers in body + Clarifications
  section; NFR Coverage <60: Performance and Security budgets unstated). Self-corrected: resolved
  all 3 markers via best-judgment defaults, logged in Decision log; added concrete performance
  budget and explicit security-scope statement.
- 2026-08-14T00:05:00Z Round 2 — v2 — Score: 100/100 (Completeness 20, Testability 25,
  Feasibility 15, Clarity 10, Clarity-Unresolved 5, Traceability 10, NFR Coverage 15) — PASS.
