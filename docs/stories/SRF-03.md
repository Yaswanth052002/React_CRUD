# Story: SRF-03 — Filter users by status

**Epic**: SRF
**Status**: Validated
**Priority**: P2
**Independent test**: true
**Owner**: Unassigned — SRF epic (no individual owner recorded in intake source; assign at sprint planning)
**Updated**: 2026-08-14

**Source**: intake:raw-input

> Brownfield backfill note: this capability is already implemented end-to-end. The
> acceptance criteria below document VERIFIED current behavior (cited by file:line),
> captured for traceability — they are not a new-build spec.

## User story

As an administrator, I want to filter the user list by account status (Active or
Inactive) so that I can quickly see which accounts are enabled or disabled without
scanning the whole table.

## Acceptance criteria

1. Given the dashboard is loaded, when the admin selects "Active" from the status
   filter dropdown (`aria-label="Filter by status"`,
   `frontend/src/pages/Dashboard.jsx:266-274`), then the frontend calls
   `getUsers({ search, role, status: "Active" })`
   (`frontend/src/services/userApi.js:37,42`), which sends `status=Active` as a query
   param to `GET /api/users`, and the backend returns only users whose `status` column
   equals `Active` (`backend/app/repositories/user_repository.py:39-40`).
2. Given the dashboard is loaded, when the admin selects "Inactive", then only users
   with `status == Inactive` are returned via the same request/filter path
   (`backend/app/api/users.py:18`, `backend/app/repositories/user_repository.py:39-40`).
3. Given the status filter is left at its default value "All"
   (`frontend/src/pages/Dashboard.jsx:29,272`), when the list is fetched, then no
   `status` query param is sent (`frontend/src/services/userApi.js:42`: `if (status &&
   status !== "All") params.status = status;`) and the repository skips the status
   filter entirely (`user_repository.py:39`: `if status and status.lower() != "all"`),
   returning users of every status.
4. Given a status filter is combined with an active search term and/or role filter,
   when the request is sent, then the backend applies all supplied filters together as
   independent `AND`-ed query clauses (`user_repository.py:26-40`) — this composition
   is exercised further in sibling story SRF-04.

## Non-functional requirements

- Performance: Filtering runs as a single indexed-equality WHERE clause added to the
  existing `GET /api/users` query (`user_repository.py:39-40`); no additional query or
  N+1 fan-out is introduced. Budget: p95 < 300ms for the filtered `GET /api/users` call.
  **RESOLVED (2026-08-14)**: `GET /api/users` now accepts `page`/`page_size` (default 50,
  max 100) and returns an envelope `{items, total, page, page_size}`; see
  `docs/adr/0003-users-list-pagination.md`. The previously-flagged unpaginated-response gap
  is closed.
- Security: Per `.claude/rules/security-baseline.md`: the `status` query param is
  validated server-side against the `StatusEnum`/model column comparison
  (`backend/app/models/user.py`, referenced via `user_repository.py:11,40`) rather than
  interpolated into SQL; no PII is logged as part of filtering.
- Accessibility: Per `.claude/rules/accessibility-baseline.md`: applies to the status
  filter `<select>` on the Dashboard page. It carries `aria-label="Filter by status"`
  (`frontend/src/pages/Dashboard.jsx:270`) and is native-keyboard operable as a standard
  `<select>` element.
- Observability: No product-analytics instrumentation for filter usage is required for
  this story; none exists today and none is requested by the intake source. Standard
  request logging (method, path, status code) via FastAPI's existing middleware covers
  operational visibility into `GET /api/users` calls, including filtered ones.

## Dependencies

- Upstream: SRF-01 (search users by name/email/phone) and SRF-02 (filter by role) —
  siblings under the SRF epic that compose with this filter at the same API layer
  (`backend/app/repositories/user_repository.py:18-42`) and same UI toolbar
  (`frontend/src/pages/Dashboard.jsx`).
- Downstream: SRF-04 (combine search with role and status filters) depends on this
  story's status-filter behavior being stable, since it verifies the composed
  search+role+status query path.

## Test mapping

- E2E: NA — no frontend E2E test harness present for the Dashboard filters in this
  repo; covered by manual verification only.
- Unit: `backend/tests/test_users.py::test_role_and_status_filters` (line 165) and the
  status-tagged fixtures at lines 141-146 exercise the repository's status-filter and
  "All" fallback logic. Frontend has no dedicated unit test for the status `<select>`
  wiring at time of writing; adding one is carried forward as a gap rather than blocking
  this backfill story (see Decision log).
- Manual: Select each status option (Active/Inactive/All) in the running dashboard and
  confirm the table updates to match `backend/users.db` contents.

## Clarifications

None — all previously open markers resolved below (see Decision log).

## Decision log

- 2026-08-14 Frontend unit test coverage for the status filter `<select>`: not required
  to close this backfill story; existing backend unit coverage
  (`test_role_and_status_filters`) is sufficient evidence of current behavior. Flagged
  as a carry-forward gap rather than a blocking clarification (per
  `clarification-marker` hard-cap rule, category 4 markers resolved inline first).
- 2026-08-14 Story owner: left unassigned pending sprint planning; not a spec ambiguity,
  so resolved by removing the blocking marker and recording as an administrative
  follow-up rather than an open question.
- 2026-08-14 Performance budget: p95 < 300ms at current dataset size (<1,000 users,
  unpaginated) set as the working budget by best judgment (per
  `clarification-marker` hard-cap, resolved inline). Missing pagination on
  `GET /api/users` is a pre-existing gap against `performance-baseline.md`, carried
  forward — not introduced or required by this story.
- 2026-08-14 Filter-usage analytics: decided out of scope for this story; no instrumentation
  requirement exists in the intake source or elsewhere in the codebase.

## Validation log

- 2026-08-14T00:00:00Z Round 1 — v1 — Score: 86/100 — FAIL
  (Clarity-Unresolved: 0/5 — 3 unresolved `[NEEDS CLARIFICATION]` markers in body and
  Clarifications section; NFR Coverage: 6/15 — Performance and Observability budgets
  were markers, not concrete values). Self-corrected: resolved Owner, Performance
  budget, and Observability scope inline per `clarification-marker` hard-cap rule;
  documented in Decision log.
- 2026-08-14T00:05:00Z Round 2 — v2 — Score: 100/100 — PASS (all dimensions ≥60;
  Clarifications section empty, all NFRs concrete). Status set to `Validated`.
