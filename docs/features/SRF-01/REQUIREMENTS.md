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
