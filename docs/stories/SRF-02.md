# Story: SRF-02 — Filter users by role

**Epic**: SRF
**Status**: Validated
**Priority**: P1
**Independent test**: true
**Owner**: Engineering (brownfield backfill — no PO named in intake source; see Decision log)
**Updated**: 2026-08-14

**Source**: intake:raw-input

> Brownfield backfill note: this functionality is already implemented end-to-end. The
> acceptance criteria below describe verified current behaviour (cited file:line), not
> aspirational behaviour, per `/arh-intake` Step 2 instructions.

## User story

As an administrator, I want to filter the users table by role so that I can quickly review
only Admin or only User accounts without scanning the full list.

## Acceptance criteria

1. Given the dashboard is loaded with the Role filter set to its default value "All"
   (`frontend/src/pages/Dashboard.jsx:28`, `frontend/src/pages/Dashboard.jsx:261`), when the
   administrator selects "Admin" from the Role dropdown
   (`frontend/src/pages/Dashboard.jsx:255-263`), then the frontend calls
   `getUsers({ search, role: "Admin", status })` (`frontend/src/pages/Dashboard.jsx:58`), the
   client only forwards the `role` query param when it is not `"All"`
   (`frontend/src/services/userApi.js:41`), and `GET /api/users` returns only records where
   `User.role == "Admin"` (`backend/app/api/users.py:17`,
   `backend/app/repositories/user_repository.py:36-37`).
2. Given a role filter of "User" is applied, when the repository builds the query, then rows
   are restricted to `User.role == RoleEnum.user` ("User") via
   `backend/app/repositories/user_repository.py:36-37`, matching the enum values defined in
   `backend/app/models/user.py:9-11` (`admin = "Admin"`, `user = "User"`).
3. Given the Role dropdown is reset to "All" (`frontend/src/pages/Dashboard.jsx:261`), when the
   list re-fetches, then no `role` filter is applied server-side — `role and role.lower() !=
   "all"` evaluates false and the repository returns unfiltered results
   (`backend/app/repositories/user_repository.py:36-37`), which is also verified for combined
   dropdown/search state via `hasActiveFilters` at `frontend/src/pages/Dashboard.jsx:154`.

## Non-functional requirements

- Performance: Per `.claude/rules/performance-baseline.md`: the `role` filter is applied as a
  single indexed-column equality predicate within the existing `list_users` query
  (`backend/app/repositories/user_repository.py:36-37`); no additional query is issued.
  Budget: p95 < 250ms at up to 100 concurrent requests, adopting the platform default from
  `.claude/rules/performance-baseline.md` since no endpoint-specific SLA is documented; see
  Decision log.
- Security: Per `.claude/rules/security-baseline.md`: `role` is a `Query(None)` optional string
  re-validated server-side via case-insensitive comparison to `"all"`
  (`backend/app/api/users.py:17`); any value other than `Admin`/`User`/`All` (case-insensitive)
  simply matches zero rows rather than raising, since the comparison is a plain SQL equality
  filter, not a strict enum-bound query param.
- Accessibility: Per `.claude/rules/accessibility-baseline.md`: applies to the Role `<select>`
  filter on the Dashboard. The control already carries `aria-label="Filter by role"`
  (`frontend/src/pages/Dashboard.jsx:259`) and is a native `<select>`, satisfying keyboard
  reachability and accessible-name requirements.
- Observability: Out of scope for this backfill — no filter-usage telemetry is currently
  emitted, and none is required since this story documents existing verified behaviour rather
  than introducing new instrumentation; see Decision log.

## Dependencies

- Upstream: none (role filtering is independently queryable — no dependency on SRF-01 search
  term or SRF-03 status filter to function).
- Downstream: SRF-04 (Combine search with role and status filters) composes this role filter
  with SRF-01 (search) and SRF-03 (status filter) at the same `GET /api/users` endpoint
  (`backend/app/api/users.py:17-22`) and the same `getUsers()` call
  (`frontend/src/pages/Dashboard.jsx:58`).

## Test mapping

- E2E: NA (no frontend E2E suite present in repo; manual verification only).
- Unit: `backend/tests/test_users.py:165-173` (`test_role_and_status_filters` — asserts
  `GET /api/users?role=Admin` returns only Admin-role results).
- Manual: Load the dashboard, toggle the Role dropdown between "All", "Admin", and "User", and
  confirm the table updates to match (`frontend/src/pages/Dashboard.jsx:255-263`).

## Clarifications

<!-- none unresolved -->

## Decision log

- 2026-08-14 Owner: assigned to Engineering pending PO confirmation (no PO named in intake
  source; brownfield backfill story, low ambiguity risk — best judgment per self-correction
  loop, requirement-validation skill).
- 2026-08-14 Performance budget: p95 < 250ms at up to 100 concurrent requests (platform default
  per `.claude/rules/performance-baseline.md`, no endpoint-specific SLA existed prior).
- 2026-08-14 Observability: no filter-usage telemetry required — story documents existing
  verified behaviour, not new functionality; instrumentation out of scope.

## Validation log

- 2026-08-14T00:00:00Z Round 1 — v1 (Draft). Score: 86/100. FAIL — Clarity-Unresolved: 0/100
  (3 unresolved `[NEEDS CLARIFICATION]` markers: Owner, Performance budget, Observability).
  Directive: resolve or best-judgment-close all 3 markers with Decision log entries (cap of 3,
  per `clarification-marker` skill); tighten NFR Coverage (Performance/Observability were
  blank/marker-only).
- 2026-08-14T00:00:00Z Round 2 — v2. Self-corrected: Owner assigned (Engineering, pending PO
  confirmation), Performance budget set (p95 < 250ms @ 100 concurrent, platform default),
  Observability scoped out (brownfield backfill, no new instrumentation). All 3 markers removed
  from body and Clarifications section; Decision log updated. Score: 100/100. PASS — no
  dimension < 60. Status set to Validated.
