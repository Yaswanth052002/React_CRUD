# Feature: SRF-01 — Search users by name, email, or phone

## Problem

Admins managing the user dashboard cannot quickly locate a specific record by scrolling a full,
unpaginated table once the user base grows past a handful of rows. This capability is already
implemented end-to-end in the codebase (brownfield backfill); this PRD documents the verified
current behavior as the contract for downstream stories (SRF-02/03/04) and specifies the one
outstanding hardening item flagged by research.

## Outcome

An admin typing a partial name, email, or phone number into the dashboard search box sees the
table narrow to only matching rows within one debounce cycle (300ms while typing, immediate on
clear), with the match performed case-insensitively across all three fields server-side. The
frontend debounce/search-input wiring gains explicit unit-test coverage, closing the last open
condition from research so SRF-02/03/04 can build on a fully verified, regression-protected
contract.

## Constraints

- No new backend behavior is introduced — `GET /api/users?search=` (`backend/app/api/users.py:14-22`),
  `UserService.list_users()` (`backend/app/services/user_service.py:20-26`), and
  `UserRepository.get_all()` (`backend/app/repositories/user_repository.py:18-42`) are frozen as-is
  for this story; any semantic change (fuzzy matching, field weighting) is out of scope.
- Pagination (`page`/`page_size`, default 50, max 100) is already implemented per
  `docs/adr/0003-users-list-pagination.md` and must not be altered by this story.
- Test infrastructure fix (`backend/tests/test_users.py:13` import-shadowing) is already applied
  and verified (15/15 backend tests passing); this story must not regress it.
- The search endpoint remains unauthenticated in the current build; adding auth is explicitly out
  of scope (tracked as a known gap per story Decision log).
- Target platform is desktop web only (per CLAUDE.md); no mobile-specific behavior is in scope.

## Solution sketch

Document the existing search contract (debounced frontend input → `GET /api/users?search=` →
case-insensitive `ilike` match across `name`/`email`/`phone` → paginated response) as the
authoritative behavior for this story and all downstream filter stories, and add the missing
frontend unit test for the debounce/immediate-clear logic in `Dashboard.jsx` so the contract is
protected by an automated regression test rather than manual verification alone.

## Addressing Research Conditions

- C-1: Fix broken test infrastructure (import-shadowing bug in `backend/tests/test_users.py`) —
  already resolved and verified prior to this PRD (`from app.models import user`, full suite
  15/15 passing per `docs/research/SRF-01.md` Risk #1); this PRD's rollout plan re-verifies the
  suite stays green as part of CI before merge, with no further action required.
- C-2: Add pagination to `GET /api/users` — already resolved and documented in
  `docs/adr/0003-users-list-pagination.md` (page/page_size, default 50, max 100, response
  envelope with `total`/`page`/`page_size`); this PRD treats the pagination contract as a frozen
  constraint (see `## Constraints`) and does not modify it.
- C-3: Add a frontend unit test for the search-input debounce logic (`Dashboard.jsx`) —
  outstanding condition, addressed directly by this PRD as **SRF-01-FR-1** below: a new Vitest
  spec covering the 300ms debounce-while-typing path and the 0ms immediate-refetch-on-clear path.

## Scope

- In: Documenting and verifying the existing search contract (frontend debounce → backend
  case-insensitive multi-field search → paginated response) as the frozen behavioral baseline.
- In: Adding frontend unit test coverage for the debounce/immediate-clear logic in
  `frontend/src/pages/Dashboard.jsx` (closes research condition C-3).
- In: Re-running and confirming the backend search test
  (`backend/tests/test_users.py::test_search_filters_by_name_email_phone`) stays green.
- In (SRF-01-FR-2, added 2026-08-14 post feature/USR-01 merge): a compact "User Overview"
  section on the (now overview-only, post-USR-01) `Dashboard.jsx`, showing Total/Active/
  Inactive/Admin/Regular Users stat cards, with Inactive derived client-side.
- In (SRF-01-FR-3, added 2026-08-17): restructure `Dashboard.jsx` below "User Overview" into two
  side-by-side breakdown panels ("User Status", "Users by Role") with proportional bars, plus a
  full-width "Recent Users" preview table and a "View All Users →" link to the Users page — all
  reusing existing API responses and design tokens, closing the reported excess-whitespace gap
  below the stats grid.
- Out: Changing search semantics (fuzzy matching, relevance ranking, field weighting) — tracked
  as a future enhancement (SRF-05 per research risk #4).
- Out: Adding authentication/authorization to `GET /api/users` — tracked as a known gap, not
  addressed by this story.
- Out: Modifying pagination behavior or defaults — frozen per `docs/adr/0003-users-list-pagination.md`.
- Out: Measuring/tuning the server-side p95 latency budget under real load — tracked as a
  follow-up profiling task, not blocking this PRD.
- Out (SRF-01-FR-2): any change to `frontend/src/pages/Users.jsx`, `frontend/src/services/userApi.js`,
  or any backend file — this enhancement is Dashboard-only, purely presentational, and reuses
  the existing `GET /api/dashboard/stats` response with no new fields.
- Out (SRF-01-FR-2): charting/graphing libraries, new npm dependencies, or a new backend field
  for inactive-user count — Inactive is a pure client-side derivation.
- Out (SRF-01-FR-3): any change to `frontend/src/pages/Users.jsx`, `frontend/src/services/userApi.js`,
  or any backend file — this restructure is Dashboard-only, purely presentational, and reuses the
  existing `getDashboardStats()` and `getUsers()` responses with no new fields, params, or routes.
- Out (SRF-01-FR-3): charting/graphing libraries or any new npm dependency — proportional bars
  reuse the existing `.stat-card__bar-fill`-style width-percentage pattern already in
  `StatsCard.jsx`; the Recent Users table reuses `UserTable.jsx`'s existing `.data-table` markup
  and `formatDate` convention.
- Out (SRF-01-FR-3): a backend sort/limit parameter for "recent" users — the top-5-by-`created_at`
  subset is derived client-side from the existing `getUsers({ page: 1, pageSize: 50 })` response
  (see FR-3 item 3 below).

## Functional requirements

FRs trace 1:1 to story ACs; see `docs/stories/SRF-01.md` for canonical wording.
New impl constraints introduced below (when any):

**SRF-01-FR-1** — Frontend debounce unit test coverage *(extends AC #1 and AC #3 with: automated test coverage for the 300ms-typing / 0ms-clear debounce behavior, closing research condition C-3)*

Add a Vitest spec (e.g. `frontend/src/pages/__tests__/Dashboard.search.test.jsx`) that asserts:
(a) typing a non-empty value into the search input delays the `getUsers({ search, ... })` call
by 300ms (using fake timers), and (b) clearing the input to an empty string triggers an
immediate (0ms) refetch with `search` omitted/empty. This test must fail if the debounce delay
values in `frontend/src/pages/Dashboard.jsx:90-92` are changed without corresponding intent.

**SRF-01-FR-2** — Dashboard "User Overview" layout enhancement *(new AC #4, added 2026-08-14 after `feature/USR-01` merged; extends the now-overview-only `Dashboard.jsx`)*

1. Wrap the existing four `StatsCard`s plus a new fifth (`Inactive Users`) in a bordered,
   `.panel`-style "User Overview" section with an eyebrow/title — replacing the current bare
   `.stats-grid` floating directly in `.page`, which is the source of the reported excess
   whitespace (the trimmed post-USR-01 `Dashboard.jsx` has nothing else below the stats grid).
2. `Inactive Users` value = `stats.total_users - stats.active_users`, computed inline in
   `Dashboard.jsx` with a code comment documenting the assumption (holds only while `Active` /
   `Inactive` remain the sole two status values) — mirrors the identical derivation and
   documentation approach already used for `Users.jsx`'s Inactive card (USR-01 ADR-3), applied
   consistently here.
3. No new network call — reuses the single existing `getDashboardStats()` call already present
   in `Dashboard.jsx`.
4. `frontend/src/components/StatsCard.jsx`'s `COLOR_MAP` gains one additive `neutral` entry
   (`{ fg: "var(--ink-muted)", bg: "#eef0f3" }`), reusing existing design tokens and matching the
   app's established `.badge-inactive` color convention (neutral gray, not the `--danger` red
   reserved for destructive/error states) — existing color entries are untouched.
5. `frontend/src/styles/index.css`'s `.stats-grid` base rule changes from
   `grid-template-columns: repeat(4, 1fr)` to `repeat(auto-fit, minmax(160px, 1fr))` so five
   cards reflow cleanly instead of leaving an orphaned fifth card alone on a new row. The two
   existing responsive breakpoints (1100px, 640px) are unchanged. This is a shared class also
   used by `Users.jsx`'s existing 4-card grid — verified to still render correctly (task T-04).
6. No change to `Users.jsx`, `userApi.js`, or any backend file.

**SRF-01-FR-3** — Dashboard compact-overview restructure *(new AC #5, added 2026-08-17; extends `Dashboard.jsx` below the SRF-01-FR-2 "User Overview" section)*

1. Below "User Overview", render two side-by-side panels on desktop, each a `.panel`-style
   container matching the existing "User Overview" treatment:
   - **"User Status"**: Active vs. Inactive, each row showing a label, count, and a proportional
     horizontal bar (`width: ${pct}%` of the larger of the two, or of `total_users` — same
     percentage math already used by `StatsCard`'s `stat-card__bar-fill`).
   - **"Users by Role"**: Admin vs. Regular, same row/bar/count treatment.
   Both panels source their counts from the single existing `getDashboardStats()` response
   already fetched by `Dashboard.jsx` — no new network call.
2. The two panels sit in a two-column responsive row that stacks to a single column on narrow
   viewports, reusing the app's existing breakpoint values (1100px, 640px — same values already
   used by `.stats-grid`) rather than introducing new breakpoint constants.
3. Below the two panels, a full-width "Recent Users" section renders a compact table (columns:
   Name, Email, Role, Status, Created) showing the 5 most-recently-created users. Data is sourced
   by calling the existing `getUsers({ page: 1, pageSize: 50 })` (the already-frozen default page
   per `docs/adr/0003-users-list-pagination.md`) once, then deriving the top 5 client-side by
   sorting on `created_at` descending — no new backend endpoint, sort parameter, or field. A code
   comment documents this assumption (holds for any dataset size, since it derives from the
   already-returned page rather than a separate "latest" query), mirroring the FR-2 Inactive-count
   derivation's documentation style.
4. The Recent Users table reuses `UserTable.jsx`'s existing `formatDate` convention and
   `.data-table`/`.table-scroll` CSS classes (compact variant — fewer columns, no per-row actions)
   rather than introducing a new table component or styling approach.
5. A "View All Users →" link/button at the end of the Recent Users section navigates to the
   existing Users page. `Dashboard.jsx` gains an `onNavigate` prop (same shape as the prop
   `Sidebar.jsx` already receives from `App.jsx`), and `App.jsx` passes
   `onNavigate={() => setActiveView("users")}` when rendering `Dashboard` — the one wiring change
   outside `Dashboard.jsx`/`StatsCard.jsx`/`index.css` this amendment requires.
6. No new npm dependency (no charting/graphing library). No change to `Users.jsx`, `userApi.js`,
   or any backend file. No change to pagination behavior or defaults.

## Non-functional requirements

- Performance: Per `.claude/rules/performance-baseline.md`: pagination is already in place
  (`docs/adr/0003-users-list-pagination.md`, default 50/max 100 page size) satisfying "pagination
  on every list endpoint." Server-side budget target for `GET /api/users` is p95 < 300ms under
  50 RPS sustained for 60s; this is the target to profile against — no real-load measurement
  exists yet, tracked as a follow-up, not a blocker for this PRD.
- Security: Per `.claude/rules/security-baseline.md`: `GET /api/users` is intentionally
  unauthenticated in the current build (documented current behavior, not new-build scope);
  adding auth is out of scope for this story per the story's Decision log.
- Accessibility: Per `.claude/rules/accessibility-baseline.md`: the search input already carries
  `aria-label="Search users"` (`frontend/src/pages/Dashboard.jsx:250`); no live-region
  announcement of result count is implemented, tracked as a future enhancement, not required for
  this PRD's scope (documenting existing behavior). SRF-01-FR-2's new "User Overview" section
  uses a semantic `<section>` with an accessible heading; stat cards remain non-interactive,
  introducing no new focusable elements or WCAG regressions.
- Observability: No logging/metrics are emitted around search requests or query latency in the
  current implementation; adding instrumentation is out of scope for this story (documents
  current behavior only).
- Performance (SRF-01-FR-2): no new network request — Inactive-Users is a pure client-side
  arithmetic derivation from the already-fetched `getDashboardStats()` response.
- Performance (SRF-01-FR-3): one existing `getUsers({ page: 1, pageSize: 50 })` call, already
  the frozen default page size — no new endpoint, no additional round trip beyond what
  `Dashboard.jsx` already needs for the Recent Users subset.
- Accessibility (SRF-01-FR-3): Per `.claude/rules/accessibility-baseline.md`: "User Status" and
  "Users by Role" use semantic `<section>`s with accessible headings, same pattern as "User
  Overview"; the Recent Users table uses semantic `<table>`/`<thead>`/`<th scope="col">` markup
  (matching `UserTable.jsx`'s existing convention); "View All Users →" is a real, keyboard-
  reachable, focus-visible control (not a non-semantic `<div onClick>`).
- Security (SRF-01-FR-3): no new surface — reuses the same unauthenticated `getUsers()`/
  `getDashboardStats()` calls already covered by this story's NFR-security statement above.

## Visual spec

Not applicable — `integrations.design = none`. Backend / API / data feature.

## Rollout plan

- **Strategy**: bang-bang — the search capability is already live in production; this PRD adds
  only a test file with no runtime behavior change.
- **Feature flag**: none — no behavior change ships; the new unit test does not gate any runtime
  code path.
- **Backout plan**: revert the new test file commit; no runtime code is touched, so no
  production backout is needed beyond a standard git revert.
- **Success signal**: `npm run test` in `frontend/` passes with the new debounce spec included,
  and `pytest` in `backend/` continues to pass 15/15 (including
  `test_search_filters_by_name_email_phone`), both green in CI before merge.
- **SRF-01-FR-2 addendum**: bang-bang, no feature flag — a pure UI/layout change with no backend
  or API impact. Backout plan: revert the `Dashboard.jsx` / `StatsCard.jsx` / `index.css` diff;
  no data migration or contract change to unwind. Success signal: full frontend suite (25+ tests
  including new SRF-01-TC-10..14) and backend suite (16 tests) both green.
- **SRF-01-FR-3 addendum**: bang-bang, no feature flag — a pure UI/layout change with no backend
  or API impact. Backout plan: revert the `Dashboard.jsx` / `App.jsx` diff (and any new
  presentational sub-component files); no data migration or contract change to unwind. Success
  signal: full frontend suite (including new SRF-01-TC-16..21) and backend suite both green, with
  no change to backend test count (no backend files touched).

## Documentation requirements

- **README updates**: none — `README.md` §10-11 already documents the search endpoint and UI
  usage accurately; no change needed.
- **Runbook**: none.
- **API reference**: none — no API contract change; existing Swagger UI at `/docs` already
  reflects `GET /api/users?search=`.
- **Inline code comments**: none required beyond standard test-file structure in the new Vitest
  spec.
- **Examples / how-to**: none.
- **SRF-01-FR-2 addendum**: `README.md` §4 (Project Structure) already lists `Dashboard.jsx`;
  no path changes, so no README update is required. No new API surface to document in `/docs`
  (Swagger UI unaffected — no backend change).
- **SRF-01-FR-3 addendum**: `README.md` §4 (Project Structure) already lists `Dashboard.jsx` and
  `App.jsx`; if new presentational sub-component files are added under
  `frontend/src/components/`, they follow the existing naming/location convention already
  documented there, so no README structural update is required. No new API surface to document
  (no backend change).

## Open questions

Decisions logged in `docs/stories/SRF-01.md` § Decision log.

## Approvals

- **2026-08-14** — yaswanth.panthangi@apexon.com (PO + Designer + BA, single-approver mode covers all when one human): **APPROVE**
  - Feature Summary, FRs, User Flows reviewed
  - UI specs: N/A for backend-only feature (`integrations.design = none`)
  - Edge Cases, Open Questions, test-case completeness reviewed
  - No-placeholder check ✓ · `[NEEDS CLARIFICATION]` count=0
  - Research verdict GO-WITH-CONDITIONS (all 3 conditions addressed: C-1 and C-2 resolved prior to this PRD, C-3 addressed by SRF-01-FR-1)
  - Tracker subtask: N/A (issue tracker = none)
  - Decision collected via Product Gate (`/arh-plan-requirements` Phase 4, `AskUserQuestion`)

- **2026-08-14** — yaswanth.panthangi@apexon.com (PO, single-approver mode): **APPROVE** —
  SRF-01-FR-2 (Dashboard "User Overview" enhancement)
  - Reviewed proposed FR-2 text, new story AC #4, 6 new test cases (SRF-01-TC-10..15), and
    PLAN.md task additions (T-03..T-06) presented in-session before any file was written
  - No design review required (`integrations.design = none`)
  - No new `[NEEDS CLARIFICATION]` markers introduced; Open Questions unchanged (none)
  - No-placeholder check ✓
  - Decision collected via direct user confirmation in-session (functionally equivalent to the
    Product Gate `AskUserQuestion` ceremony — this is a same-story amendment, not a fresh PRD
    cycle through `/arh-plan-requirements`)

- **2026-08-17** — yaswanth.panthangi@apexon.com (PO, single-approver mode): **APPROVE** —
  SRF-01-FR-3 (Dashboard compact-overview restructure)
  - Reviewed proposed FR-3 text, new story AC #5, 6 new test cases (SRF-01-TC-16..21), and
    PLAN.md task additions (T-07..T-10) presented in-session before any file was written
  - No design review required (`integrations.design = none`)
  - No new `[NEEDS CLARIFICATION]` markers introduced; Open Questions unchanged (none)
  - No-placeholder check ✓
  - Decision collected via direct user confirmation in-session (functionally equivalent to the
    Product Gate `AskUserQuestion` ceremony — this is a same-story amendment, not a fresh PRD
    cycle through `/arh-plan-requirements`)
