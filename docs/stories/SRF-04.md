# Story: SRF-04 — Combine search with role and status filters

**Epic**: SRF
**Status**: Validated
**Priority**: P2
**Independent test**: false
**Owner**: unassigned
**Updated**: 2026-08-14

**Source**: intake:raw-input

> Brownfield backfill note: this capability is already implemented end-to-end (backend +
> frontend). This story documents verified current behavior for traceability, not a new-build
> spec. Acceptance criteria cite the exact file:line evidence read during intake.

## User story

As an administrator, I want to combine a text search with role and status filters so that I can
narrow the user list to exactly the records I need (e.g. "active admins named Priya").

## Acceptance criteria

1. Given the dashboard is loaded, when I enter a search term AND select a role AND select a
   status simultaneously, then `GET /api/users` is called with all three query params
   (`search`, `role`, `status`) together (`frontend/src/pages/Dashboard.jsx:58` builds the call
   from `search`, `roleFilter`, `statusFilter` state; the debounced effect at
   `frontend/src/pages/Dashboard.jsx:88-95` re-triggers `loadUsers()` on any of the three
   changing), and the backend applies all three as combined (AND) predicates — search matches
   name/email/phone via `ilike` (`backend/app/repositories/user_repository.py:26-34`), then role
   is filtered when not `"all"` (`backend/app/repositories/user_repository.py:36-37`), then
   status is filtered when not `"all"` (`backend/app/repositories/user_repository.py:39-40`) —
   each `.filter()` call narrows the same SQLAlchemy query object, so results satisfy
   search AND role AND status, not OR.
2. Given a role filter and/or status filter is set to `"All"`, when the list is requested, then
   that predicate is skipped entirely (`role.lower() != "all"` / `status.lower() != "all"` guards
   at `backend/app/repositories/user_repository.py:36,39`) so only the remaining active
   predicates narrow the result — e.g. search alone, or search + role only.
3. Given one or more of search/role/status is active (search non-empty, role != "All", or
   status != "All"), when the combined query returns zero rows, then the table shows the
   filtered empty state "No users match your search" with guidance to adjust the search term or
   clear filters, and the "+ Add User" shortcut is hidden (`hasActiveFilters` computed at
   `frontend/src/pages/Dashboard.jsx:154` and consumed at
   `frontend/src/components/UserTable.jsx:66-77`); given no filters are active, the empty state
   instead reads "No users yet" and shows the "+ Add User" button.

## Non-functional requirements

- Performance: combined search+role+status query executes a single SQL statement (no N+1).
  Interim budget (no dedicated load-test infra exists yet to derive one empirically): p95 <
  300ms for `GET /api/users` with all three filters active, at up to 10k user rows — consistent
  with SQLite + single indexed `ilike`/equality predicates and the current unpaginated result
  set size; re-baseline once pagination (below) or a larger dataset lands.
- Security: Per `.claude/rules/security-baseline.md`: `search` is passed through SQLAlchemy
  `ilike` with bind parameters (`backend/app/repositories/user_repository.py:26-34`) — no raw
  string-built SQL. No PII is logged by this endpoint.
- Accessibility: Per `.claude/rules/accessibility-baseline.md`: search input, role select, and
  status select each carry `aria-label` (`frontend/src/pages/Dashboard.jsx:250,259,270`); no
  additional a11y work identified for the combined-filter path itself.
- Observability: no combined-filter-specific metric/log exists today; list endpoint has no
  dedicated logging beyond default FastAPI access logs.
- Performance gap (per `.claude/rules/performance-baseline.md`, "pagination on every list
  endpoint"): **RESOLVED (2026-08-14)** — `GET /api/users` / `UserRepository.get_all` now accept
  `page`/`page_size` (default 50, max 100) and return `{items, total, page, page_size}`.
  See `docs/adr/0003-users-list-pagination.md`. The combined search+role+status filters compose
  correctly with pagination since all three still narrow the same underlying query before
  `limit`/`offset` is applied.

## Dependencies

- Upstream: SRF-01 (search by name/email/phone), SRF-02 (filter by role), SRF-03 (filter by
  status) — SRF-04 is the composition/integration of all three siblings and cannot be
  meaningfully validated without their individual behavior already in place.
- Downstream: none identified.

## Test mapping

- E2E: NA (no e2e/Cypress/Playwright suite in this repo today).
- Unit: `backend/tests/test_users.py` (search/filter combination assertions per README §12,
  "dashboard stats and search/filter logic"); `frontend` Vitest suite for `Dashboard.jsx` /
  `UserTable.jsx` empty-state and query-building behavior — exact combined-filter test cases not
  independently confirmed during this intake pass.
- Manual: verify via Swagger UI (`/docs`) that `GET /api/users?search=...&role=...&status=...`
  returns the AND-combined result set matching direct SQL inspection.

## Clarifications

(none — both prior markers resolved below)

## Decision log

- 2026-08-14 Performance budget: p95 < 300ms for combined search+role+status `GET /api/users`
  at up to 10k rows (best-judgment interim default, no load-test infra exists to derive
  empirically; re-baseline once pagination lands or dataset grows) — per story-validation
  self-correction round 1.
- 2026-08-14 Pagination scope: out of scope for SRF-04; it is a pre-existing gap on the shared
  `GET /api/users` endpoint, not introduced by combining filters — carried forward as a separate
  backlog item, not a blocker for this story — per story-validation self-correction round 1.

## Validation log

- 2026-08-14T00:00:00Z Round 1 — v1: Total 89/100. FAIL — Clarity-Unresolved: 0/5 (2 unresolved
  `[NEEDS CLARIFICATION]` markers in Performance NFR and pagination-gap NFR, both mirrored in
  Clarifications section). Directive: resolve or best-judgment-document both markers per
  `clarification-marker` skill (cap-of-3 rule), record resolution in Decision log, clear
  Clarifications section.
- 2026-08-14T00:05:00Z Round 2 — v2: Total 100/100. Completeness 20, Testability 25,
  Feasibility 15, Clarity 10, Clarity-Unresolved 5, Traceability 10, NFR Coverage 15. PASS — no
  dimension below 60. Status set to Validated.
