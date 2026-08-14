# ADR-0003: Pagination on GET /api/users

- Status: Accepted
- Date: 2026-08-14
- Deciders: project lead (via /arh-research SRF-01 recommendation)

## Context

`/arh-research SRF-01` flagged that `GET /api/users` (and its `UserRepository.get_all()`
data-access method) returned every matching row with no `limit`/`offset`, violating
`.claude/rules/performance-baseline.md` ("Pagination on every list endpoint (default page
size, max page size)"). This endpoint is shared by all four SRF (Search & Filter) stories, so
the fix had to land before those stories could be considered fully hardened.

## Decision

- `GET /api/users` accepts `page` (1-indexed, default `1`, `ge=1`) and `page_size` (default
  `50`, `ge=1`, `le=100`) query parameters, alongside the existing `search`/`role`/`status`
  filters.
- The response shape changes from a bare JSON array to an envelope:
  `{"items": [...], "total": <int>, "page": <int>, "page_size": <int>}` — modeled by the new
  `UserListResponse` Pydantic schema.
- `UserRepository` gains `_filtered_query()` (shared filter-building, used by both listing and
  counting) plus `get_all(..., limit, offset)` and `count_filtered(...)`, so filtering and
  pagination compose without duplicating query logic.
- The frontend (`Dashboard.jsx`) tracks a `page` state, resets to page 1 whenever search/role/
  status filters change, and renders a "Showing X–Y of Z" footer with Previous/Next controls
  (disabled at the first/last page).

## Alternatives considered

- **Cursor-based pagination**: rejected — offset pagination is simpler to reason about at this
  dataset size (an internal admin tool, not a high-traffic public API) and matches the existing
  `order_by(User.id.asc())` contract with no schema migration needed.
- **Leave unpaginated, cap page size to e.g. 500**: rejected — still violates the performance
  baseline's explicit pagination requirement, and defers the problem rather than resolving it.

## Consequences

- Positive: the endpoint's response size is now bounded regardless of table growth; the gap
  against `.claude/rules/performance-baseline.md` is closed; all four SRF stories share one
  pagination contract.
- Negative: `GET /api/users`'s response shape is a breaking change for any external client
  expecting a bare array — none exist today (the only consumer is `frontend/src/services/
  userApi.js`, updated alongside this ADR).
- Reversible? Yes — reverting to a bare array would only require dropping the envelope and the
  two new query params; low cost given the single internal consumer.
