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

## Non-functional requirements

- Performance: search input is debounced 300ms client-side before firing a request
  (`frontend/src/pages/Dashboard.jsx:92`); server-side budget set at p95 < 300ms under 50 RPS
  for `GET /api/users` (per `.claude/rules/performance-baseline.md` — no measurement exists yet,
  this is the target to profile against, not a verified current value).
- Security: no auth/authorization is enforced on this endpoint today; per brownfield backfill
  scope, this story documents current behavior only — the endpoint is intentionally open in the
  present build, and adding auth is out of scope for this story (tracked as a known gap, not a
  blocking requirement here).
- Accessibility: search input has `aria-label="Search users"` (`frontend/src/pages/Dashboard.jsx:250`); no other WCAG-specific behavior (e.g. live-region announcement of result count) is implemented.
- Observability: no logging/metrics are emitted around search requests or query latency in the current code.

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

## Validation log

- 2026-08-14T00:00:00Z Round 1 — v1 — Score: 80/100 (raw dims: Completeness 20, Testability 25,
  Feasibility 15, Clarity 10, Clarity-Unresolved 0, Traceability 10, NFR Coverage 8) — FAIL
  (Clarity-Unresolved <60: 3 unresolved `[NEEDS CLARIFICATION]` markers in body + Clarifications
  section; NFR Coverage <60: Performance and Security budgets unstated). Self-corrected: resolved
  all 3 markers via best-judgment defaults, logged in Decision log; added concrete performance
  budget and explicit security-scope statement.
- 2026-08-14T00:05:00Z Round 2 — v2 — Score: 100/100 (Completeness 20, Testability 25,
  Feasibility 15, Clarity 10, Clarity-Unresolved 5, Traceability 10, NFR Coverage 15) — PASS.
