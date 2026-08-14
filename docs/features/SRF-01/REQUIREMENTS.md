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
- Out: Changing search semantics (fuzzy matching, relevance ranking, field weighting) — tracked
  as a future enhancement (SRF-05 per research risk #4).
- Out: Adding authentication/authorization to `GET /api/users` — tracked as a known gap, not
  addressed by this story.
- Out: Modifying pagination behavior or defaults — frozen per `docs/adr/0003-users-list-pagination.md`.
- Out: Measuring/tuning the server-side p95 latency budget under real load — tracked as a
  follow-up profiling task, not blocking this PRD.

## Functional requirements

FRs trace 1:1 to story ACs; see `docs/stories/SRF-01.md` for canonical wording.
New impl constraints introduced below (when any):

**SRF-01-FR-1** — Frontend debounce unit test coverage *(extends AC #1 and AC #3 with: automated test coverage for the 300ms-typing / 0ms-clear debounce behavior, closing research condition C-3)*

Add a Vitest spec (e.g. `frontend/src/pages/__tests__/Dashboard.search.test.jsx`) that asserts:
(a) typing a non-empty value into the search input delays the `getUsers({ search, ... })` call
by 300ms (using fake timers), and (b) clearing the input to an empty string triggers an
immediate (0ms) refetch with `search` omitted/empty. This test must fail if the debounce delay
values in `frontend/src/pages/Dashboard.jsx:90-92` are changed without corresponding intent.

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
  this PRD's scope (documenting existing behavior).
- Observability: No logging/metrics are emitted around search requests or query latency in the
  current implementation; adding instrumentation is out of scope for this story (documents
  current behavior only).

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

## Documentation requirements

- **README updates**: none — `README.md` §10-11 already documents the search endpoint and UI
  usage accurately; no change needed.
- **Runbook**: none.
- **API reference**: none — no API contract change; existing Swagger UI at `/docs` already
  reflects `GET /api/users?search=`.
- **Inline code comments**: none required beyond standard test-file structure in the new Vitest
  spec.
- **Examples / how-to**: none.

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
