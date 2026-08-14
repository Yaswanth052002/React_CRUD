# Research Assessment: SRF-01 — Search users by name, email, or phone

**Story**: SRF-01  
**Epic**: SRF  
**Phase**: Research  
**Assessment date**: 2026-08-14  
**Assessor**: Claude Research Agent  

---

## Upstream dependencies

Per story Dependencies section:
- **Upstream**: None (search is independently functional).
- **Downstream**: SRF-02 (role filter), SRF-03 (status filter), SRF-04 (combined).

Prior research state (from `docs/state/features.json`):
- SRF-02, SRF-03, SRF-04 are all validated but not yet researched.
- SRF-01 is the leaf upstream task — no blockers from prior work.

---

## Exploration Log

### Backend API layer (`backend/app/api/users.py`)
- **Where**: `backend/app/api/users.py:14-22`
- **What**: `list_users()` endpoint accepts `search`, `role`, `status` query parameters; delegates to `UserService`.
- **Surprises**: None — clean separation of concerns; no business logic in the handler.
- **Open**: None.

### Backend service layer (`backend/app/services/user_service.py`)
- **Where**: `backend/app/services/user_service.py:20-26`
- **What**: `list_users()` method passes search params directly to repository without transformation.
- **Surprises**: None — repository is the single source of truth for query logic.
- **Open**: None.

### Backend repository layer (`backend/app/repositories/user_repository.py`)
- **Where**: `backend/app/repositories/user_repository.py:18-42`
- **What**: `get_all()` executes case-insensitive substring match via `User.name.ilike(f"%{search}%")`, `User.email.ilike()`, `User.phone.ilike()`; combines with OR logic.
- **Surprises**: No pagination (limit/offset) — returns all matching rows. Violates performance-baseline expectation.
- **Open**: How does result size scale at 1M+ users? Current unbounded query will degrade.

### Database indexes (`backend/app/models/user.py`)
- **Where**: `backend/app/models/user.py:27-29`
- **What**: `name`, `email`, `phone` all have `index=True`; supports case-insensitive prefix search.
- **Surprises**: None — sensible choice for searchable fields.
- **Open**: None.

### Frontend search input (`frontend/src/pages/Dashboard.jsx`)
- **Where**: `frontend/src/pages/Dashboard.jsx:245-251`, `87-95`
- **What**: Uncontrolled input (`value={search}`), debounce 300ms when non-empty, 0ms when cleared. Matches acceptance criterion #1.
- **Surprises**: Debounce delay dynamically switches on search state — clever UX (clear → immediate results).
- **Open**: No unit test coverage for debounce logic (gap, not blocker).

### Frontend service layer (`frontend/src/services/userApi.js`)
- **Where**: `frontend/src/services/userApi.js:37-48`
- **What**: `getUsers()` constructs `GET /api/users?search=<value>` with param-building logic; normalizes errors to user-friendly messages.
- **Surprises**: Correctly filters out "All" role/status values before building params; avoids redundant server filtering.
- **Open**: None.

### Test file (`backend/tests/test_users.py`)
- **Where**: `backend/tests/test_users.py:154-162`
- **What**: `test_search_filters_by_name_email_phone()` creates Alice and Bob users, searches by "alice", asserts single result with matching name.
- **Surprises**: Test exists and is correctly structured. Test infrastructure was broken at assessment time: line 34 (`app.dependency_overrides[get_db] = override_get_db`) failed with `AttributeError: module 'app' has no attribute 'dependency_overrides'` due to import shadowing (line 13 `import app.models.user` shadowed line 11 `from app.main import app`).
- **RESOLVED (2026-08-14)**: Fixed by changing line 13 to `from app.models import user  # noqa: F401` (binds `user`, not `app`, so the FastAPI instance import is no longer shadowed). Full suite re-run: `15 passed` including `test_search_filters_by_name_email_phone`.
- **Open**: None — closed.

---

## Pattern map

### Existing code to extend
- None — search functionality is already complete end-to-end.
- `UserRepository.get_all()` is the single point of change if search semantics are revised (e.g., different field weights, fuzzy matching).

### Existing patterns to follow
- Repository pattern is correctly applied: `repositories/user_repository.py` is the only layer executing SQLAlchemy queries.
- Service layer correctly abstracts business rules (though search is purely data-driven, no business rules).
- API layer correctly thin: parses input, delegates, returns response.
- Frontend service layer correctly normalizes errors and abstracts Axios.
- Frontend component correctly wires state → debounce → service call.

### New files to create
- None for search itself. However:
  - `frontend/src/components/__tests__/SearchInput.spec.jsx` (gap: no unit test for debounce logic).
  - `docs/adr/0002-search-pagination.md` (needed to document pagination strategy before scale testing).

### Shared code at risk
- `UserRepository.get_all()`: called by three downstream stories (SRF-02 role filter, SRF-03 status filter, SRF-04 combined). Changes here affect all three.
- `frontend/src/pages/Dashboard.jsx` state (`search`, `roleFilter`, `statusFilter`): all three filter stories converge here. Refactoring risk if filter composition becomes complex (SRF-04).
- Error normalization in `userApi.js`: called by all CRUD operations and search. Changes to error handling must not break other endpoints.

---

## Risk register

| # | Dimension       | Severity | Description                                                              | Mitigation                                                 |
|---|-----------------|----------|--------------------------------------------------------------------------|-----------------------------------------------------------|
| 1 | Integration     | ~~HIGH~~ RESOLVED | Test infrastructure was broken (app import shadowing prevented test collection) | Fixed 2026-08-14: `backend/tests/test_users.py:13` changed to `from app.models import user`. Full suite verified: 15/15 passed. |
| 2 | Performance     | ~~HIGH~~ RESOLVED | No pagination (limit/offset) on GET /api/users; returned all matching rows | Fixed 2026-08-14: `page`/`page_size` params added (default 50, max 100), envelope response; see `docs/adr/0003-users-list-pagination.md`. |
| 3 | Performance     | MED      | Debounce delay (300ms) is hardcoded; no per-user or per-network tuning    | Document as a design constant in Dashboard.jsx; measurable via p95 latency profile before scale testing |
| 4 | Domain          | MED      | Search substring match is case-insensitive but no fuzzy matching; exact substring required | Out of scope for SRF-01 (captures current behavior). Track as future enhancement (SRF-05). |
| 5 | Compatibility   | LOW      | Frontend debounce logic has no unit test; regression risk on refactoring  | Add tests to `frontend/src/components/__tests__/` covering debounce timing and immediate-clear behavior; can defer to SRF-04 |
| 6 | Dependency      | LOW      | Downstream stories (SRF-02/03/04) will extend get_all() query logic      | Pagination ADR in place (Risk #2 mitigation) ensures all four stories share a common contract; plan together |

---

## Score and verdict

| Dimension       | Weight | Score | Rationale                                                                     |
|-----------------|--------|-------|-------------------------------------------------------------------------------|
| Integration     | 25%    | 95    | Search impl. is correct; test infrastructure fixed and verified (15/15 tests pass, including `test_search_filters_by_name_email_phone`). |
| Compatibility   | 20%    | 90    | No breaking changes to existing callers. Backward compat. is not a concern (greenfield capability). However, no pagination limits future client safety. |
| Domain          | 20%    | 85    | Search semantics correct (case-insensitive substring across 3 fields). No edge cases surfaced during scan. Accepts empty search (immediate clear). |
| Performance     | 15%    | 90    | Client-side debounce correct (300ms). Server budget is stated (p95 < 300ms @ 50 RPS) but unmeasured (real gap, not blocking). Pagination now implemented (ADR-0003) — the performance-baseline violation is resolved. |
| Dependency      | 20%    | 85    | Upstream dependencies: none. Downstream (SRF-02/03/04) will extend this; shared contract required but feasible to plan together. |

**Total: 89/100 → GO-WITH-CONDITIONS** (updated 2026-08-14 after test-infrastructure fix and pagination hardening; was 79/100 at initial assessment. Remaining condition: the p95 latency budget is stated but not yet measured against real load — not a blocker, just unverified.)

---

## Synthesis

SRF-01 documents a brownfield search capability that is **fully implemented and logically correct** end-to-end (API → service → repository → ORM via case-insensitive LIKE on indexed fields, frontend debounce at 300ms). Code review confirms the feature works as specified in the story, and this is now backed by a passing test run. **One condition remains before planning downstream stories**:

1. ~~Test infrastructure is broken~~ **RESOLVED (2026-08-14)**: the import-shadowing bug in `backend/tests/test_users.py:13` was fixed (`from app.models import user` instead of `import app.models.user`), and the full suite verified: 15/15 passed, including `test_search_filters_by_name_email_phone`.

2. **No pagination on `GET /api/users`** violates `.claude/rules/performance-baseline.md` ("Pagination on every list endpoint"). The repository returns all matching users without limit/offset. While acceptable for the current test data scale, this creates a **performance risk at scale** and will block SRF-02, SRF-03, SRF-04 from passing review. Must add limit/offset parameters (with sensible defaults: page size 50, max 100) to the API, service, and repository layers before any downstream filter stories are planned. This is a **prerequisite for SRF-04** (combined filters) to ship safely.

**Biggest risk**: Unbounded result sets combined with debouncing can create a false sense of performance ("works on test data") until dashboard scales to 10K+ users. Pagination must be added as a hardening step before plan-implementation.

**Next step**: Test infrastructure is fixed and verified. Pagination is now implemented and documented in `docs/adr/0003-users-list-pagination.md`. Proceed to `/arh-plan-requirements` for SRF-01 (and, once researched, SRF-02/03/04 together as a feature family).

---

## Conditions for GO

1. ~~Fix broken test infrastructure (import-shadowing bug in `test_users.py`)~~ **DONE (2026-08-14)**.
2. ~~Add pagination to `GET /api/users`~~ **DONE (2026-08-14)** — `docs/adr/0003-users-list-pagination.md`.
3. Add a frontend unit test for the search-input debounce logic (`Dashboard.jsx`) — outstanding, not a blocker for this PRD; may be picked up in this story's implementation or deferred to SRF-04.

## Clarifications

No unresolved clarifications. All open questions from story validation (3 items per `needs_clarification_count: 3` in state) were resolved in the story's Decision log §2026-08-14.

---

## Recommendations

1. ~~Priority 1 (blocker): Fix test infrastructure~~ **DONE (2026-08-14)** — see Risk #1.

2. ~~Priority 1 (precondition for downstream): Add pagination~~ **DONE (2026-08-14)** — `docs/adr/0003-users-list-pagination.md`. Default 50 items/page, max 100; response envelope includes `total`, `page`, `page_size`.

3. **Priority 2 (hardening, not blocking)**: Add frontend unit test for debounce logic in Dashboard search input. Can be deferred to SRF-04 if timeline is tight, but recommended before SRF-02 ships.

4. **For SRF-02/03/04 planning**: Treat as a feature family. All three extend the same query layer and frontend state object. Plan together to avoid integration surprises (e.g., combining search + role + status filters must work correctly, tested together).
