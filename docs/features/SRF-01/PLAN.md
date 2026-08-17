# PLAN: SRF-01 — Search users by name, email, or phone

Status: Complete (amended 2026-08-14 with SRF-01-FR-2; amended 2026-08-17 with SRF-01-FR-3)
Story: SRF-01 · Priority: P1 · Research verdict: GO-WITH-CONDITIONS (89/100)

> Amendment note (2026-08-14): §§ 1-7 below (original) cover SRF-01-FR-1 only. Following the
> merge of `feature/USR-01` (dedicated Users page) into this branch, the story was extended
> in-place with SRF-01-FR-2 (Dashboard "User Overview" layout enhancement) per explicit user
> request — no new story was created. The amendment is appended as §§ 2a/5a/6a/7a below rather
> than rewritten inline, to keep the original PRD's plan-validation record intact and auditable.

> Amendment note (2026-08-17): the story was extended in-place a second time with SRF-01-FR-3
> (Dashboard compact-overview restructure: status/role breakdown panels + Recent Users preview)
> per explicit user request — still no new story. Appended as §§ 1b/2b/5b/6b/7b below, same
> append-don't-rewrite convention as the FR-2 amendment.

> Scope note: this is a brownfield backfill PRD. `GET /api/users?search=` (backend) and the
> debounced search input (`frontend/src/pages/Dashboard.jsx`) are already implemented,
> pagination is already implemented (`docs/adr/0003-users-list-pagination.md`), and the
> backend test-infrastructure bug is already fixed and verified (15/15 tests passing). Per
> `docs/features/SRF-01/REQUIREMENTS.md` § Constraints, all of the above are **frozen** for
> this story. The only new deliverable is **SRF-01-FR-1**: a Vitest spec covering the
> 300ms-debounce / 0ms-immediate-clear behavior in `Dashboard.jsx`, closing research
> Condition C-3. This PLAN is deliberately narrow — it documents the frozen contract for
> traceability and plans exactly one new test file plus one verification task.

## 1. Architecture Decisions

No mini-ADR is written for this story. Rationale: the only new artifact is a test file
(`frontend/src/pages/__tests__/Dashboard.search.test.jsx`) exercising already-implemented,
already-decided behavior. There is no library choice, schema change, new external dependency,
or async/sync boundary decision to make — the test uses the project's existing Vitest +
jsdom runner (`frontend/vite.config.js` `test.environment: "jsdom"`, already wired,
`frontend/package.json` `"test": "vitest run"`) and the existing `vi.useFakeTimers()` API
that ships with Vitest, with no new dependency to add. A competent reviewer given this same
prompt would not reasonably choose a different runner or approach, so per `plan-authoring`
§ Architecture decisions ("if three readers would each pick a different solution... write the
ADR" / else it isn't ADR-worthy) this decision does not clear the bar for a mini-ADR. No
`decide` skill invocation follows from this section — there is no mini-ADR to mirror into
`decisions[]`.

## 1a. Architecture Decisions (SRF-01-FR-2 amendment)

**No mini-ADR required.** Every choice in this amendment is either dictated by an explicit
user constraint (client-side Inactive derivation, no new API, no new dependency, reuse
existing components) or a small, obviously-reversible CSS/JSX change with one clear existing
precedent to follow (the app's established `.badge-inactive` neutral-gray convention for
"Inactive" state, and the existing `.panel` container pattern already used by `Users.jsx`'s
toolbar). Per `plan-authoring`'s bar ("if three readers would each pick a different solution,
write the ADR"), none of these choices clears it — same rationale the original § 1 used to skip
a mini-ADR for SRF-01-FR-1. Recorded here as plan prose rather than a `decisions[]` state entry,
per this session's explicit instruction not to hand-edit state files.

## 1b. Architecture Decisions (SRF-01-FR-3 amendment)

**No mini-ADR required, but one judgment call is flagged for traceability.** Most of this
amendment is the same class of small, reversible, precedent-following change as FR-2 (reusing
`.panel`, `StatsCard`'s bar-fill percentage math, and `UserTable`'s table markup/`formatDate`
convention). The one non-trivial decision:

- **"Recent Users" source**: rather than adding a backend sort/limit parameter (e.g.
  `GET /api/users?sort=created_at_desc&limit=5`), `Dashboard.jsx` calls the existing
  `getUsers({ page: 1, pageSize: 50 })` — the already-frozen default page — and derives the top 5
  by sorting the returned page client-side on `created_at` descending. Rationale: REQUIREMENTS.md
  § Scope (Out) explicitly excludes a new backend endpoint/param "unless absolutely required,"
  and a client-side sort of an already-fetched, already-small (page_size ≤ 100) result set is not
  a performance concern at this app's scale. A competent reviewer could alternatively choose to
  add a backend `limit`/`sort` param — so unlike the rest of this amendment, this one choice
  plausibly clears the "three readers, three answers" bar. It is recorded here as plan prose
  (not a `decisions[]` state entry, per this session's explicit instruction not to hand-edit state
  files) precisely so it isn't silently buried among the lower-judgment CSS/JSX changes.
- **`onNavigate` wiring**: `Dashboard.jsx` gains an `onNavigate` prop and `App.jsx` passes
  `onNavigate={() => setActiveView("users")}` — this mirrors the existing prop `Sidebar.jsx`
  already receives from the same `App.jsx` call site, so it is not treated as a separate
  judgment call.

## 2. File and Module Plan

| ID   | Action | Path                                                          | Reason                                                                                      |
|------|--------|----------------------------------------------------------------|----------------------------------------------------------------------------------------------|
| F-01 | create | `frontend/src/pages/__tests__/Dashboard.search.test.jsx`        | New Vitest spec for SRF-01-FR-1: 300ms debounce-while-typing + 0ms immediate-clear refetch, plus a static aria-label assertion (TC-09) |
| F-02 | verify | `backend/tests/test_users.py`                                   | No edits — re-run the existing suite to confirm the already-applied import-shadowing fix (research Risk #1) and pagination coverage (Risk #2, ADR-0003) remain green; traces C-1/C-2 |

No other files are created or modified by the original SRF-01-FR-1 scope.
`frontend/src/services/userApi.js`, `backend/app/api/users.py`,
`backend/app/services/user_service.py`, and `backend/app/repositories/user_repository.py`
remain frozen per REQUIREMENTS.md § Constraints for FR-1 and are untouched by the FR-2
amendment below as well.

## 2a. File and Module Plan (SRF-01-FR-2 amendment)

| ID   | Action | Path                                            | Reason                                                                                     |
|------|--------|--------------------------------------------------|----------------------------------------------------------------------------------------------|
| F-03 | modify | `frontend/src/pages/Dashboard.jsx`                | Wrap stats cards in a bordered "User Overview" section; add 5th `StatsCard` (Inactive Users) derived client-side |
| F-04 | modify | `frontend/src/components/StatsCard.jsx`           | Add one additive `neutral` entry to `COLOR_MAP` (existing entries untouched)                |
| F-05 | modify | `frontend/src/styles/index.css`                   | Change `.stats-grid` base rule to `repeat(auto-fit, minmax(160px, 1fr))`; existing 1100px/640px media queries unchanged |
| F-06 | modify | `frontend/src/pages/__tests__/Dashboard.search.test.jsx` | Extend the existing file with SRF-01-TC-10..14 (no new test file — reuses the existing `describe` structure) |

### Wiring

F-03/F-04/F-05 are edits to already-registered, already-imported modules (`Dashboard.jsx` is
already rendered by `App.jsx`; `StatsCard.jsx` is already imported by `Dashboard.jsx` and
`Users.jsx`; `index.css` is already the app's single global stylesheet, imported once in
`main.jsx`) — no new entry-registration is needed. F-06 is a leaf test file edit, exempt per
`plan-validation` § Wiring, same exception SRF-01-FR-1's F-01 used.

**Shared-class risk**: F-05's `.stats-grid` change affects `Users.jsx`'s existing 4-card usage
too (same class, different consumer). T-04 below explicitly re-verifies `Users.jsx`'s stats
grid still renders correctly after the change — this is a disclosed, tested blast-radius
expansion, not a silent side effect.

### Wiring

F-01 is a leaf test file (per `plan-validation` § Wiring "Allowed exception: ... test file,
fixture, README"). It is discovered automatically by Vitest's default glob
(`**/__tests__/**` alongside `**/*.test.jsx`, already the convention used by
`frontend/src/services/userApi.test.js`) — no entry-registration edit is required. F-02 is a
verification action on an existing, already-wired test file; nothing new needs registering.

## 2b. File and Module Plan (SRF-01-FR-3 amendment)

| ID   | Action | Path                                                          | Reason                                                                                     |
|------|--------|------------------------------------------------------------------|----------------------------------------------------------------------------------------------|
| F-07 | modify | `frontend/src/pages/Dashboard.jsx`                                | Add "User Status" / "Users by Role" breakdown panels, "Recent Users" table + "View All Users →" link; accept new `onNavigate` prop |
| F-08 | create | `frontend/src/components/StatBreakdownPanel.jsx`                  | Small reusable presentational component for a labeled 2-row proportional-bar breakdown (used by both "User Status" and "Users by Role") — extracted rather than duplicated inline, per `reusability-baseline` ("three similar lines" — here two near-identical inline blocks would otherwise exist) |
| F-09 | create | `frontend/src/components/RecentUsersTable.jsx`                    | Compact table (Name/Email/Role/Status/Created) reusing `UserTable.jsx`'s `formatDate` convention and `.data-table`/`.table-scroll` classes; no per-row actions |
| F-10 | modify | `frontend/src/styles/index.css`                                   | Add a `.dashboard-breakdown-row` two-column grid rule (stacks to one column ≤1100px, matching existing `.stats-grid` breakpoints) for the side-by-side panels; no change to existing `.stats-grid`, `.panel`, `.stat-card__bar*`, or `.data-table` rules |
| F-11 | modify | `frontend/src/App.jsx`                                            | Pass `onNavigate={() => setActiveView("users")}` to `<Dashboard />` (mirrors the existing prop already passed to `<Sidebar />`) |
| F-12 | modify | `frontend/src/pages/__tests__/Dashboard.search.test.jsx`          | Extend the existing file with SRF-01-TC-16..21 (no new test file, same convention as F-06) |

### Wiring

F-07/F-10/F-11 are edits to already-registered, already-imported modules (same reasoning as F-03/F-05
above). F-08 and F-09 are new leaf presentational components consumed only by `Dashboard.jsx`
(F-07) — the import is added in the same F-07 edit that introduces their usage, satisfying
`plan-validation` § Wiring (new module + its call site land together, not orphaned). F-12 is a
leaf test file edit, exempt per the same rubric exception as F-01/F-06.

**Shared-class risk**: none. F-10's `.dashboard-breakdown-row` is a new class, not a change to
the existing `.stats-grid`/`.panel` rules `Users.jsx` also relies on — no re-verification of
`Users.jsx`'s rendering is required for this amendment (unlike F-05's FR-2 change).

## 3. Module Hierarchy

No new production module is introduced. The single new node is a test module whose subject
under test is the existing `Dashboard` component:

```
frontend/src/pages/__tests__/
└── Dashboard.search.test.jsx
    - input:   rendered <Dashboard /> (via React Testing rendering already available through
               react-dom, mocked `../services/userApi.js` module — `vi.mock`), simulated user
               keystrokes into the search input (frontend/src/pages/Dashboard.jsx:263-266),
               and Vitest fake timers (`vi.useFakeTimers()`)
    - output:  assertions against the mocked `getUsers` call — argument shape
               (`{ search, role, status, page, pageSize }`) and call timing (300ms vs 0ms)
    - subject: frontend/src/pages/Dashboard.jsx:104-111 (debounce effect,
               `search ? 300 : 0`) and frontend/src/pages/Dashboard.jsx:263-266 (search
               input, aria-label="Search users")
    - public:  none — this is a leaf test module, not consumed by other code
```

### 3a. Module Hierarchy (SRF-01-FR-3 amendment)

Two new leaf presentational components, both consumed only by `Dashboard.jsx`:

```
frontend/src/components/
├── StatBreakdownPanel.jsx
│   - input:   { title, rows: [{ label, value, color }], total } props
│   - output:  a `.panel`-style section with N rows, each a label + proportional
│              bar (`width: ${value/total*100}%`) + count — same math as `StatsCard`
│   - subject: none (pure presentational, no side effects)
│   - public:  props above; consumed by Dashboard.jsx (F-07) for both "User Status"
│              and "Users by Role" (two instances, different `rows`)
└── RecentUsersTable.jsx
    - input:   { users, onViewAll } props (users = pre-sorted/sliced top-5 array)
    - output:  compact `.data-table` (Name/Email/Role/Status/Created) + a
               "View All Users →" control that calls `onViewAll`
    - subject: none (pure presentational; sorting/slicing happens in Dashboard.jsx,
               not in this component, so it stays a dumb renderer)
    - public:  props above; consumed by Dashboard.jsx (F-07)
```

## 4. State and Data Management

No new persistent state, no new client-side state, and no new cache. This story adds test
coverage only:

- **Backend state**: unchanged. `users` table schema, pagination columns/params
  (`page`/`page_size`, ADR-0003), and search matching (`ilike` on `name`/`email`/`phone`) are
  frozen per REQUIREMENTS.md § Constraints.
- **Frontend state**: unchanged. `search`, `roleFilter`, `statusFilter`, `page` remain local
  `useState` in `Dashboard.jsx` (per `react-patterns` § State management — no global store).
  The new test observes this existing state machine; it does not add to it.
- **Cache**: none exists today (no client-side cache layer per `react-patterns`); none is
  added.

### 4a. State and Data Management (SRF-01-FR-3 amendment)

- **Backend state**: unchanged — no new query, param, or field.
- **Frontend state**: `Dashboard.jsx` adds one existing-pattern `useState`/derived-value pair:
  a `users` list from a new (Dashboard-local) call to `getUsers({ page: 1, pageSize: 50 })`, and
  a derived `recentUsers` value (`[...users].sort(...).slice(0, 5)`) computed inline — same
  "plain `useState`, no global store" convention as the rest of this file (`react-patterns`
  § State management). No new persisted or shared state.
- **Cache**: none added — the `getUsers()` call is fetched once on mount alongside the existing
  `getDashboardStats()` call, not on every render.

## 5. Task Breakdown

| #    | Title                                                          | Complexity | [P] | Predecessors | Files | Notes                                                                 |
|------|-----------------------------------------------------------------|------------|-----|--------------|-------|------------------------------------------------------------------------|
| T-01 | Author `Dashboard.search.test.jsx` debounce/clear/a11y spec      | M          | [P] | —            | F-01  | Covers TC-01 (300ms debounce), TC-02 (0ms clear refetch), TC-09 (aria-label static assertion, executed under the same existing Vitest/jsdom runner — no new e2e runner needed). Mocks `../services/userApi.js` per `react-patterns` (components/pages never call Axios directly — mock at the service boundary, not Axios). Uses `vi.useFakeTimers()` / `vi.advanceTimersByTime()`. |
| T-02 | Re-verify backend regression suite stays green (no code edits)  | S          | [P] | —            | F-02  | Runs `pytest` per `docs/config/project-commands.yaml test_unit`; confirms 15/15 pass including `test_search_filters_by_name_email_phone`, closing C-1 (test-infra fix holds) and C-2 (pagination, ADR-0003, remains intact) traceability for this PRD's rollout plan |

Both tasks are `[P]`: disjoint files (F-01 vs F-02), no predecessors, no shared mutable
state (one touches only a new frontend test file, the other only runs — does not edit — an
existing backend test file).

## 5a. Task Breakdown (SRF-01-FR-2 amendment)

| #    | Title                                                          | Complexity | [P] | Predecessors | Files | Notes                                                                 |
|------|-----------------------------------------------------------------|------------|-----|--------------|-------|------------------------------------------------------------------------|
| T-03 | Add "User Overview" panel + Inactive-stat derivation to `Dashboard.jsx`; extend `StatsCard.jsx` COLOR_MAP with `neutral` | S | [P] | — | F-03, F-04 | ACs: story AC #4. Implements SRF-01-FR-2 items 1, 2, 4. Inline comment documents the `total - active` assumption per REQUIREMENTS.md. |
| T-04 | Adjust `.stats-grid` base rule to `auto-fit, minmax(160px,1fr)`  | S          | [P] | —             | F-05  | Implements FR-2 item 5. Must visually verify `Users.jsx`'s existing 4-card grid still renders correctly (shared class) |
| T-05 | Add SRF-01-TC-10..14 to `Dashboard.search.test.jsx`              | M          | —   | T-03, T-04    | F-06  | Covers FR-2 items 1-4. Mocks `getDashboardStats` per existing `react-patterns` service-boundary convention |
| T-06 | Re-run full frontend + backend suites — regression gate          | S          | —   | T-05          | —     | Closes SRF-01-TC-14. Verifies no regression to `Users.jsx` CRUD/search/filter/pagination or backend behavior |

T-03 and T-04 are `[P]` (disjoint files: `Dashboard.jsx`/`StatsCard.jsx` vs `index.css`). T-05
depends on both (it tests the combined result). T-06 is the final regression gate.

## 5b. Task Breakdown (SRF-01-FR-3 amendment)

| #    | Title                                                          | Complexity | [P] | Predecessors | Files       | Notes                                                                 |
|------|-----------------------------------------------------------------|------------|-----|--------------|-------------|--------------------------------------------------------------------------|
| T-07 | Author `StatBreakdownPanel.jsx` and `RecentUsersTable.jsx`       | M          | [P] | —            | F-08, F-09  | Pure presentational leaf components, no service calls. Implements SRF-01-FR-3 items 1 and 3-4 (rendering only) |
| T-08 | Wire "User Status" / "Users by Role" panels + Recent Users + `onNavigate` into `Dashboard.jsx`; wire `App.jsx` | M | — | T-07 | F-07, F-11 | Implements FR-3 items 1, 3, 5. Adds the single new `getUsers({ page: 1, pageSize: 50 })` call and the `created_at`-descending client-side sort/slice, with an inline comment documenting the assumption |
| T-09 | Add `.dashboard-breakdown-row` responsive grid rule to `index.css` | S | [P] | — | F-10 | Implements FR-3 item 2. Reuses the existing 1100px/640px breakpoint values — no new breakpoint constants |
| T-10 | Add SRF-01-TC-16..21 to `Dashboard.search.test.jsx`; re-run full frontend + backend suites | M | — | T-08, T-09 | F-12 | Covers all FR-3 items. Mocks `getUsers`/`getDashboardStats` per existing `react-patterns` service-boundary convention. Closes SRF-01-TC-21 (regression gate: no change to `Users.jsx` or backend behavior) |

T-07 and T-09 are `[P]` (disjoint files, no shared state). T-08 depends on T-07 (consumes the new
components). T-10 depends on both T-08 and T-09 (tests the combined result) and is the final
regression gate for this amendment.

## 6. Carry-Forward Risks and Conditions

Risks from `docs/research/SRF-01.md` § Risk register. Risks #1 and #2 were HIGH and are
already `~~HIGH~~ RESOLVED` (test-infra fix; pagination via ADR-0003) prior to this PRD; no
HIGH/CRITICAL risk remains open for this story.

### Risks addressed by tasks

| Risk id | Severity          | Addressed by                                                                 |
|---------|-------------------|-------------------------------------------------------------------------------|
| R-1     | ~~HIGH~~ RESOLVED | T-02 (regression re-verification confirms the `test_users.py` import-shadowing fix holds) |
| R-2     | ~~HIGH~~ RESOLVED | T-02 (regression re-verification confirms pagination test coverage remains green, ADR-0003) |
| R-5     | LOW               | T-01 (adds the missing frontend unit test for debounce/immediate-clear logic — this is the primary risk this story closes) |

### Risks accepted (carry-forward)

| Risk id | Severity | Rationale                                                                                                    |
|---------|----------|----------------------------------------------------------------------------------------------------------------|
| R-3     | MED      | accepted — 300ms debounce constant documented as a design constant in `Dashboard.jsx`; per-network tuning deferred until a real p95 measurement exists (see Conditions/perf note below) |
| R-4     | MED      | accepted — fuzzy matching / field-weighting is explicitly out of scope for this story (REQUIREMENTS.md § Scope Out); tracked as future work under SRF-05 |
| R-6     | LOW      | accepted — downstream stories SRF-02/03/04 extend the same `get_all()` query and `Dashboard.jsx` filter state; ADR-0003's pagination contract is the shared seam they must plan against together |

Additionally carried forward (not in the numbered risk register, but flagged in research
§ Score and verdict / § Recommendations #3): the server-side p95 < 300ms @ 50 RPS performance
budget stated in REQUIREMENTS.md § Non-functional requirements is **unmeasured** — no
load-testing runner (k6 or equivalent) exists in this repo
(`docs/config/project-commands.yaml` `test_e2e: (n/a — no e2e suite configured)`, and there is
no analogous `test_performance` entry either). REQUIREMENTS.md § Scope explicitly lists this
as **Out**: "Measuring/tuning the server-side p95 latency budget under real load — tracked as
a follow-up profiling task, not blocking this PRD." Per that approved scope-out, this PLAN
does not add a load-testing runner (introducing one would be disproportionate new
infrastructure for a one-test-file story and outside REQUIREMENTS.md's approved scope). This
item is written to `pending_carry_forward[]` (see state write below) and requires
`--accept-pending` at commit-PR time.

### Conditions for GO (research_verdict GO-WITH-CONDITIONS)

| Cond | Condition (verbatim)                                                                                          | Addressed by |
|------|-------------------------------------------------------------------------------------------------------------|--------------|
| C-1  | Fix broken test infrastructure (import-shadowing bug in `test_users.py`)                                      | T-02 (already applied prior to this PRD; T-02 re-verifies it holds) |
| C-2  | Add pagination to `GET /api/users`                                                                             | T-02 (already implemented via ADR-0003 prior to this PRD; T-02's full-suite re-run re-verifies pagination tests stay green) |
| C-3  | Add a frontend unit test for the search-input debounce logic (`Dashboard.jsx`)                                 | T-01 |

### Carry-forward (SRF-01-FR-2 amendment)

No new HIGH/MED risks introduced. One disclosed, deferred item (consistent with the original
plan's TC-07 pattern, not a silently dropped gap):

| Item | Severity | Rationale |
|------|----------|-----------|
| SRF-01-TC-15 (responsive reflow, real-browser) | LOW | jsdom cannot evaluate CSS layout/media queries; visual verification of the 5-card responsive reflow is deferred to manual/real-browser check, same disclosed-deferral pattern as SRF-01-TC-07's performance measurement. Not written to `pending_carry_forward[]` by this document — that state write is the implementation-agent's responsibility at `/arh-implement` time, per this session's instruction not to hand-edit state files. |

### Carry-forward (SRF-01-FR-3 amendment)

No new HIGH/MED risks introduced. One disclosed, deferred item, same pattern as TC-15 above:

| Item | Severity | Rationale |
|------|----------|-----------|
| SRF-01-TC-19 (side-by-side → stacked responsive reflow, real-browser) | LOW | jsdom cannot evaluate CSS layout/media queries; visual verification that the two breakdown panels stack to one column ≤1100px is deferred to manual/real-browser check. Not written to `pending_carry_forward[]` by this document — that state write is the implementation-agent's responsibility at `/arh-implement` time, per this session's instruction not to hand-edit state files. |

### Cross-Feature Dependency Notes

SRF-02 (role filter), SRF-03 (status filter), and SRF-04 (combined filters) all extend the
same `UserRepository.get_all()` query and the same `Dashboard.jsx` filter state
(`search`/`roleFilter`/`statusFilter`) that this story documents and tests. Per research
§ Recommendations #4, those three stories should be planned together as a family once
researched, treating this story's frozen search contract (case-insensitive `ilike` across
`name`/`email`/`phone`, paginated per ADR-0003) as their shared baseline. No task in this
PLAN depends on artefacts from those stories, and no task here is a blocking predecessor for
them beyond the already-frozen contract.

## 7. Test Strategy

| Layer                        | Test path                                                        | TCs covered              | Notes                                                                                                  |
|-------------------------------|--------------------------------------------------------------------|---------------------------|-----------------------------------------------------------------------------------------------------------|
| Unit                          | `frontend/src/pages/__tests__/Dashboard.search.test.jsx` (T-01)     | SRF-01-TC-01, SRF-01-TC-02 | Fake timers assert 300ms delay while typing and 0ms immediate refetch on clear, mocking `getUsers` from `../services/userApi.js` |
| Unit (static markup assertion) | `frontend/src/pages/__tests__/Dashboard.search.test.jsx` (T-01)     | SRF-01-TC-09              | Asserts the rendered search input carries `aria-label="Search users"` (`Dashboard.jsx:266`); executed under the existing Vitest/jsdom runner — the JSON's `type: e2e` label doesn't require a browser-automation runner because the assertion is a static DOM-attribute check reachable via jsdom render, not a real-browser interaction |
| Integration (existing, re-verified) | `backend/tests/test_users.py::test_search_filters_by_name_email_phone` (T-02) | SRF-01-TC-03, SRF-01-TC-04 | Pre-existing test, unmodified; T-02 re-runs the full suite to confirm it stays green post test-infra fix |
| Integration (existing, re-verified) | `backend/tests/test_users.py` (T-02)                                | SRF-01-TC-05              | Pre-existing negative-case coverage (no-match search returns empty set, 200 OK); confirmed green by T-02's full-suite run |
| Integration (existing, re-verified) | `backend/tests/test_users.py` (T-02)                                | SRF-01-TC-06              | Regression check that the already-applied import-shadowing fix (`test_users.py:13`) holds; confirmed by T-02 (15/15 pass) |
| Performance                   | manual / deferred (no task in this PLAN)                            | SRF-01-TC-07              | Execution deferred — reason: no load-testing runner configured in this repo (`project-commands.yaml` `test_e2e: n/a`, no `test_performance` entry) and REQUIREMENTS.md § Scope explicitly lists p95 measurement as **Out** ("tracked as a follow-up profiling task, not blocking this PRD"). Carried forward via `pending_carry_forward[]`, requires `--accept-pending` at commit-PR time |
| Security                      | manual checklist                                                    | SRF-01-TC-08              | Endpoint is intentionally unauthenticated in the current build per REQUIREMENTS.md § Non-functional requirements (documented known gap, not in scope for this story); covered in `/arh-security-review` |

### 7a. Test Strategy (SRF-01-FR-2 amendment)

| Layer                        | Test path                                                        | TCs covered              | Notes                                                                                                  |
|-------------------------------|--------------------------------------------------------------------|---------------------------|-----------------------------------------------------------------------------------------------------------|
| Unit                          | `frontend/src/pages/__tests__/Dashboard.search.test.jsx` (T-05)     | SRF-01-TC-10, TC-11, TC-12, TC-13 | Extends the existing file's `describe` block; mocks `getDashboardStats` per existing convention |
| Integration (regression)      | full `npm run test` + `pytest` (T-06)                               | SRF-01-TC-14              | Confirms no regression to `Users.jsx` or backend after the Dashboard change |
| Manual / deferred             | real-browser viewport check (no task in this PLAN)                  | SRF-01-TC-15              | Deferred — no CSS-layout-evaluating runner exists in this repo; disclosed via `pending_carry_forward[]` at implementation time, same pattern as TC-07 |

### 7b. Test Strategy (SRF-01-FR-3 amendment)

| Layer                        | Test path                                                        | TCs covered              | Notes                                                                                                  |
|-------------------------------|--------------------------------------------------------------------|---------------------------|-----------------------------------------------------------------------------------------------------------|
| Unit                          | `frontend/src/pages/__tests__/Dashboard.search.test.jsx` (T-10)     | SRF-01-TC-16, TC-17, TC-18, TC-20 | Extends the existing file's `describe` block; mocks `getUsers`/`getDashboardStats` per existing convention |
| Manual / deferred             | real-browser viewport check (no task in this PLAN)                  | SRF-01-TC-19              | Deferred — no CSS-layout-evaluating runner exists in this repo; disclosed via `pending_carry_forward[]` at implementation time, same pattern as TC-07/TC-15 |
| Integration (regression)      | full `npm run test` + `pytest` (T-10)                               | SRF-01-TC-21              | Confirms no regression to `Users.jsx` or backend after the Dashboard restructure |

### Coverage gates

- Unit coverage threshold: per `harness.yaml` (fallback 80% if unset) applies to the new
  `Dashboard.search.test.jsx` file's own statements.
- `npm run test` (frontend, includes the new spec) and `pytest` (backend, T-02's re-run) must
  both be green pre-commit per `docs/config/project-commands.yaml` `test:` command, matching
  REQUIREMENTS.md § Rollout plan's success signal.

### Deferred execution — author-time smoke (TC-07)

Even though TC-07's execution is deferred (no runner exists and it is out of scope per
REQUIREMENTS.md), no new spec file is authored for it in this PLAN, so there is no
author-time artifact requiring a parse/dry-run smoke — the deferral is of *measurement*, not
of an authored-but-unexecuted spec. This distinguishes it from the "authored but never
executed" anti-pattern the `plan-authoring` skill warns about.

### No-placeholder check

`grep -nEi "TBD|to be determined|TODO|FIXME|as appropriate|as needed|add error handling|similar to|details to follow|lorem ipsum|placeholder text"` against this file: zero hits (verified before Phase 5 handoff).

## Plan validation

- Date: 2026-08-14T14:05:00Z
- Verdict: PASS
- Wiring: PASS (F-01 is a leaf test file — exempt per rubric; F-02 is a verify-only action on an already-wired existing file, nothing new to register)
- Docs: PASS (no T1–T4 trigger fires: no new runnable surface, no new HTTP route, no new env var, no new service/port — REQUIREMENTS.md § Documentation requirements confirms "README updates: none")
- Runner-setup: PASS-with-documented-exception (TC-01/TC-02/TC-09 run under the existing Vitest/jsdom runner, already configured, no new setup needed. TC-07 (performance) is the one TC of a runner-setup-triggering type without a runner task in this PLAN; this is a deliberate, disclosed exception grounded in REQUIREMENTS.md's approved § Scope (Out) exclusion of p95 load measurement for this story, tracked via `pending_carry_forward[]` rather than silently dropped or fabricated as new infrastructure. Flagged explicitly to the orchestrator/reviewer rather than asserted as an unconditional PASS.)
- Cross-section: PASS (every file table row (F-01, F-02) is referenced by a task's Files column (T-01, T-02); every task's Files column entries exist in the file table; every TC in `docs/test-cases/SRF-01.json` appears in § 7's table, none silently omitted)
- Config drift: PASS (no new runtime dependency, service, or port introduced — no edit needed to `docs/config/project-commands.yaml preflight:` or `docs/config/stack-smoke.md`)
- Rounds: 1

### Plan validation rounds

| Round | Verdict | Failing dimensions | Action                                                             |
|-------|---------|---------------------|----------------------------------------------------------------------|
| 1     | PASS    | —                   | Runner-setup carries one disclosed, PRD-approved exception (TC-07 performance); all other dimensions clean. Proceeding to hand-off. |

### Plan validation (SRF-01-FR-2 amendment, 2026-08-14)

- Wiring: PASS (F-03/F-04/F-05 edit already-registered modules; F-06 is a leaf test-file exception, same rubric exception as F-01)
- Docs: PASS (no new runnable surface, HTTP route, env var, service, or port — REQUIREMENTS.md § Documentation requirements confirms no README update needed)
- Runner-setup: PASS-with-documented-exception (SRF-01-TC-15 responsive-reflow check has no CSS-layout-evaluating runner in this repo; same disclosed pattern as the original plan's TC-07)
- Cross-section: PASS (every amendment file-table row (F-03..F-06) is referenced by a task's Files column (T-03..T-06); every new TC in `docs/test-cases/SRF-01.json` appears in § 7a, none silently omitted)
- Config drift: PASS (no new runtime dependency, service, or port — no `docs/config/project-commands.yaml` or `docs/config/stack-smoke.md` edit needed)
- Rounds: 1

### Plan validation (SRF-01-FR-3 amendment, 2026-08-17)

- Wiring: PASS (F-07/F-10/F-11 edit already-registered modules; F-08/F-09 are new modules whose
  only call site lands in the same F-07 task, not orphaned; F-12 is a leaf test-file exception,
  same rubric exception as F-01/F-06)
- Docs: PASS (no new runnable surface, HTTP route, env var, service, or port — REQUIREMENTS.md
  § Documentation requirements confirms no README structural update needed)
- Runner-setup: PASS-with-documented-exception (SRF-01-TC-19 side-by-side→stacked responsive
  check has no CSS-layout-evaluating runner in this repo; same disclosed pattern as TC-07/TC-15)
- Cross-section: PASS (every amendment file-table row (F-07..F-12) is referenced by a task's
  Files column (T-07..T-10); every new TC in `docs/test-cases/SRF-01.json` appears in § 7b, none
  silently omitted)
- Config drift: PASS (no new runtime dependency, service, or port — no
  `docs/config/project-commands.yaml` or `docs/config/stack-smoke.md` edit needed)
- Rounds: 1
