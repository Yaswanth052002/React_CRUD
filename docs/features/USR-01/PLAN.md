# PLAN: USR-01 — Dedicated Users Management Page

- Status: Accepted
- Story: `docs/stories/USR-01.md` (Validated, 100/100)
- Requirements: `docs/features/USR-01/REQUIREMENTS.md` (Product Gate: APPROVE, 2026-08-14)
- Research: `docs/research/USR-01.md` (Verdict: GO, 89/100)
- Design: n/a (`integrations.design: none`)

## 1. Architecture Decisions

### ADR-1: Dedicated `Users.jsx` page vs. splitting `Dashboard.jsx` in place · Accepted · 2026-08-14 · impl-planning-agent

**Context**: `frontend/src/pages/Dashboard.jsx` (375 lines) currently owns both the stats-overview
rendering AND the full search/filter/pagination/CRUD toolkit built by SRF-01. USR-01 needs a
purpose-built Users management surface without further overloading Dashboard, and without every
future Dashboard-only change (e.g. a new overview widget) having to thread through CRUD state.

**Decision**: Extract the search/filter/pagination/CRUD state, effects, and handlers into a new
`frontend/src/pages/Users.jsx` page component. `Dashboard.jsx` retains only the overview
responsibility (stats cards + description) that remains after extraction. All shared
presentational components (`Header`, `StatsCard`, `UserTable`, `Modal`, `UserForm`,
`UserDetails`, `DeleteConfirmation`, `Notification`) are imported by both pages unchanged, per
story Decision log (Component placement, 2026-08-14).

**Alternatives considered**:
- Keep everything in `Dashboard.jsx` and toggle CRUD-tooling visibility via a `mode`/`view` prop:
  rejected — forks the call graph behind a config switch, violating
  `.claude/rules/reusability-baseline.md` ("avoid feature flags... that fork the call graph") and
  single-responsibility.

**Consequences**:
- Positive: each page has one clear responsibility; matches the story's explicit Decision log
  entry on component placement; unblocks Dashboard from future CRUD-unrelated growth.
- Negative: extraction requires a careful line-by-line trace of every state var/effect/handler in
  `Dashboard.jsx` to avoid silently dropping a dependency (research risk #2, owned by T-01/T-06).
  Reversible mechanically — revert the two file diffs (`Users.jsx` removal, `Dashboard.jsx`
  restore) to return to the pre-extraction monolith.

### ADR-2: Routing mechanism — extend conditional branch vs. router library · Accepted · 2026-08-14 · impl-planning-agent

**Context**: `App.jsx`'s `activeView` state currently remaps the `"users"` sidebar key onto
`"dashboard"` (`App.jsx:43`), so there is no real third view yet. The story constraint forbids
introducing a routing library for what remains a three-view admin console (dashboard / users /
settings).

**Decision**: Replace the remap with a genuine third conditional branch in `App.jsx` rendering
`Users.jsx`, mirroring the existing `"settings"` → `SettingsPlaceholder` pattern
(`App.jsx:50-53`). No router library is added.

**Alternatives considered**:
- Adopt `react-router-dom`: rejected — three static, non-URL-addressable views do not justify a
  new dependency, its bundle-size and test-surface increase, or a rewrite of `Sidebar.jsx`'s
  `onNavigate` contract; also violates `.claude/rules/surgical-changes.md` ("touch only what the
  task requires").

**Consequences**:
- Positive: minimal diff (single conditional branch added), zero new dependencies, matches the
  file's existing idiom exactly.
- Negative: if a 5th+ view is added in a future story, the conditional chain could become
  unwieldy and warrant revisiting router-library adoption then. Reversible mechanically — the
  conditional branch can be swapped for router-based rendering later without changing
  `Users.jsx`'s or `Dashboard.jsx`'s internals.

### ADR-3: Inactive-stat source — client-side derivation vs. backend field · Accepted · 2026-08-14 · impl-planning-agent

**Context**: `GET /api/dashboard/stats` (`backend/app/schemas/user.py:69-73`,
`backend/app/repositories/user_repository.py:92-117`) returns exactly `total_users`,
`active_users`, `admin_users`, `regular_users` — there is no `inactive_users` field, and the
story's Constraints section explicitly freezes the backend contract (no new field, no schema
change) for this story.

**Decision**: Compute the Inactive stats-card value as `total_users - active_users` inside
`Users.jsx`, from the existing `GET /api/dashboard/stats` response. The computation carries an
inline code comment stating the derivation and its assumption: it holds only while `Active` and
`Inactive` are the sole two status values; if a third status (e.g. `Archived`) is introduced
later, this formula must be revisited.

**Alternatives considered**:
- Add `inactive_users` to `DashboardStats` / `UserRepository.stats()`: rejected — violates the
  story's explicit "no backend changes" constraint and `.claude/rules/surgical-changes.md`; the
  value is a strict, always-consistent function of two fields already returned, so a backend
  round-trip adds a query for no new information.

**Consequences**:
- Positive: zero backend/schema/repository churn; the value is always internally consistent with
  the two fields it derives from (no possibility of the two numbers drifting out of sync across
  a network round-trip).
- Negative: the derivation silently breaks if a future status enum value is introduced without
  updating this formula (research risk #3) — mitigated by the inline comment and a dedicated
  verification test (T-06). Reversible mechanically — a one-line formula change (or swapping to
  a real backend field, once added) is the entire undo cost.

### ADR-4: Test-relocation strategy for `Dashboard.search.test.jsx` · Accepted · 2026-08-14 · impl-planning-agent

**Context**: `frontend/src/pages/__tests__/Dashboard.search.test.jsx` currently asserts
search/debounce/aria-label behavior (`describe("Dashboard search debounce (SRF-01-FR-1)")`,
TC-01/TC-02/TC-09-equivalent cases) against `Dashboard.jsx`. That behavior is being physically
relocated into `Users.jsx` under ADR-1. AC#16 / USR-01-FR-5 forbid both deleting the file and
leaving it asserting against behavior no longer present in the (now-trimmed) `Dashboard.jsx`.

**Decision**: This is resolved as a two-file split, not a rename:
1. `frontend/src/pages/__tests__/Dashboard.search.test.jsx` is **adapted in place** (same path,
   same file — never deleted) to assert only against the overview behavior that remains in the
   trimmed `Dashboard.jsx` post-extraction: stats-cards render (Total/Active/Admins/Regular
   Users), the `loadingStats` skeleton state, and the absence of a search input — the
   `describe()` label is corrected from the stale `"SRF-01-FR-1"` to reflect current scope. The
   three original debounce/clear/aria-label test bodies are removed from this file (they no
   longer describe real `Dashboard.jsx` behavior after T-02).
2. A new file, `frontend/src/pages/__tests__/Users.search.test.jsx`, is created that relocates
   those exact three assertions (300ms debounce, 0ms-on-clear, `aria-label="Search users"`) onto
   `Users.jsx`, plus new coverage for filter-reset-to-page-1 and Previous/Next pagination
   (USR-01-TC-08, USR-01-TC-16).

**Alternatives considered**:
- Delete `Dashboard.search.test.jsx` and rely solely on the new `Users.search.test.jsx`:
  rejected — explicitly forbidden by AC#16 / USR-01-FR-5 ("must not be deleted").
- Leave `Dashboard.search.test.jsx` completely untouched: rejected — once T-02 removes the
  search input/debounce effect from `Dashboard.jsx`, the untouched file's three tests fail
  (asserting against behavior that no longer exists), which is the exact outcome AC#16 forbids
  ("left asserting against behavior no longer present").

**Consequences**:
- Positive: zero net coverage loss (verified case-by-case in T-05 against the original three
  tests), the file survives at its original path per the explicit constraint, and both files'
  `describe()` blocks accurately name the FR ids they now cover.
- Negative: two test files must be kept mentally in sync if the debounce/pagination contract
  ever changes again post-launch. Reversible mechanically — the split can be re-merged into one
  file later without any production-code change.

## 2. File and Module Plan

| ID   | Action | Path                                                          | Reason                                                                 |
|------|--------|----------------------------------------------------------------|-------------------------------------------------------------------------|
| F-01 | create | `frontend/src/pages/Users.jsx`                                 | New dedicated Users page (ADR-1); owns search/filter/pagination/CRUD    |
| F-02 | create | `frontend/src/pages/__tests__/Users.search.test.jsx`           | Relocated debounce/clear/aria-label tests + new filter/pagination tests (ADR-4) |
| F-03 | create | `frontend/src/pages/__tests__/Users.crud.test.jsx`             | New CRUD/stats/loading/empty/error coverage for `Users.jsx`             |
| F-04 | modify | `frontend/src/pages/Dashboard.jsx`                              | Trim to overview-only: remove search/filter/table/CRUD/pagination state and JSX (ADR-1) |
| F-05 | modify | `frontend/src/App.jsx`                                          | Import and render `Users.jsx` on a real `"users"` branch (ADR-2); entry-registration site for F-01 |
| F-06 | modify | `frontend/src/pages/__tests__/Dashboard.search.test.jsx`        | Adapt in place to test remaining Dashboard overview behavior only (ADR-4) |
| F-07 | modify | `README.md`                                                     | §4 Project Structure: add `Users.jsx`; §11 CRUD Usage: CRUD/search/filter/pagination now live on Users page |
| F-08 | create | `frontend/src/pages/__tests__/App.routing.test.jsx`             | Covers routing/nav-highlight/header/a11y TCs at the jsdom component level (no e2e runner exists) |

**Wiring**: `Users.jsx` (F-01) is imported and rendered by `App.jsx` (F-05) on the `"users"`
branch — F-05 is listed as `modify` above for exactly this registration. No other new module
requires a separate consumer edit (F-02/F-03/F-08 are leaf test files; F-06/F-07 are leaf
edits with no further consumer).

## 3. Module Hierarchy

```
pages/
├── Users.jsx                              (NEW)
│   - input:  none (page-level; owns its own state)
│   - output: rendered Users management UI; calls userApi.js functions
│   - public: default export `Users({ onMenuClick, onUserCountChange })`
│   - internal state: search, roleFilter, statusFilter, page, totalUsers,
│     users, stats, loadingUsers, loadingStats, loadError, modalMode,
│     editingUser, viewingUser, deletingUser, submitting, deleting,
│     formError, toasts (all relocated verbatim from Dashboard.jsx)
│   - reuses: Header, StatsCard, UserTable, Modal, UserForm, UserDetails,
│     DeleteConfirmation, Notification (components/, unchanged)
│   - calls: getUsers, getUser (via UserDetails' data), createUser,
│     updateUser, deleteUser, getDashboardStats (services/userApi.js,
│     unchanged)
└── Dashboard.jsx                          (TRIMMED)
    - input:  { onMenuClick, onUserCountChange }
    - output: overview UI — stats cards (Total/Active/Admins/Regular Users)
      + page header/description only
    - public: default export `Dashboard({ onMenuClick, onUserCountChange })`
    - internal state (post-trim): stats, loadingStats, toasts (for the
      stats-fetch-failure toast only)
    - calls: getDashboardStats only (search/filter/CRUD calls removed)

App.jsx                                     (MODIFIED)
- input:  none (top-level)
- output: renders Sidebar + one of {Dashboard, Users, SettingsPlaceholder}
  based on `activeView`
- public: default export `App()`
- change: `activeView === "users" ? "dashboard" : activeView` remap (old
  App.jsx:43) replaced with a third conditional branch:
  `activeView === "settings" ? <SettingsPlaceholder/> : activeView ===
  "users" ? <Users/> : <Dashboard/>`
- `onUserCountChange` continues to be passed to whichever of
  Dashboard/Users is currently rendered, since both pages call
  `getUsers` and both need to update the sidebar's record count.
```

## 4. State and Data Management

- No new persistent state, no new DB columns, no migration — this story is purely a frontend
  extraction. Backend contracts (`GET /api/users`, `GET /api/dashboard/stats`) are frozen as-is
  per the story's Constraints section.
- No new caching layer — both `Dashboard.jsx` and `Users.jsx` continue the existing pattern of
  re-fetching from `userApi.js` on mount and after every mutation (`refreshAll()`-style), with no
  client-side cache between them (per `react-patterns` § State management: "no client-side cache
  layer").
- Client-side state boundary: all search/filter/pagination/CRUD/toast state that currently lives
  in `Dashboard.jsx` moves to local `useState`/`useRef` inside `Users.jsx` (no `Context`, no
  global store — consistent with the existing project convention of zero global state).
  `Dashboard.jsx` retains only the subset of state needed for its own stats-cards render
  (`stats`, `loadingStats`) plus its own `toasts` state for the stats-fetch-failure toast.
- The Inactive-stat value (`total_users - active_users`) is a derived, non-persisted render-time
  computation in `Users.jsx` — never stored in state, so it can never drift from its inputs (see
  ADR-3).

## 5. Task Breakdown

| #    | Title                                                              | Complexity | [P] | Predecessors | Files      | Notes                                                                 |
|------|---------------------------------------------------------------------|------------|-----|---------------|------------|-------------------------------------------------------------------------|
| T-01 | Create `Users.jsx` — extract search/filter/pagination/CRUD from Dashboard | L    | —   | —             | F-01       | Byte-for-byte parity per USR-01-FR-3/FR-4; add Inactive-stat comment per ADR-3. ACs: #1-#15. Owns research risk #2 (careful extraction trace) and #3 (documented derivation). |
| T-02 | Trim `Dashboard.jsx` to overview-only                              | M          | [P] | T-01          | F-04       | Remove search/filter/table/CRUD/pagination state+JSX; keep stats cards + description. ACs: #16. |
| T-03 | Wire `App.jsx` — replace `"users"` remap with real `<Users/>` branch | S        | [P] | T-01          | F-05       | ACs: #1. Passes `onMenuClick`/`onUserCountChange` to `Users` the same way Dashboard receives them today. |
| T-04 | Adapt `Dashboard.search.test.jsx` to remaining overview behavior    | M          | —   | T-02          | F-06       | ACs: #16, USR-01-FR-5. Removes stale debounce/clear/aria-label assertions; asserts stats-cards render + no search input present. Owns research risk #1 (file preserved, not deleted). |
| T-05 | Create `Users.search.test.jsx` — relocate debounce/filter/pagination coverage | L | [P] | T-01    | F-02       | ACs: #5, #6, #11. Covers USR-01-TC-06, TC-07, TC-08, TC-16 (relocates the 3 original Dashboard.search.test.jsx cases verbatim onto `Users.jsx`, plus filter-reset-to-page-1 and pagination Previous/Next). Owns research risk #1 (relocation, parity-verified). |
| T-06 | Create `Users.crud.test.jsx` — CRUD, stats, loading/empty/error states | L       | [P] | T-01          | F-03       | ACs: #2, #3, #4, #7-#10, #12-#15. Covers USR-01-TC-03, TC-04, TC-05, TC-09, TC-10-TC-15, TC-18, TC-19, TC-20. Owns research risk #2 (extraction-coupling caught by exercising full CRUD flow) and #3 (dedicated Inactive-derivation assertion: 8 total, 5 active → 3 inactive). |
| T-07 | Create `App.routing.test.jsx` — nav-click/active-state/header/a11y   | M         | —   | T-03          | F-08       | ACs: #1, #2. Covers USR-01-TC-01, TC-02, TC-17 (loading-state render check at App-mount level), TC-25 (toolbar control accessible labels), as jsdom component tests — see § 7 Test Strategy for why this substitutes for the TCs' declared `type: e2e`. |
| T-08 | Docs: update `README.md` §4 and §11 for the new Users page          | S         | —   | T-01, T-02, T-03 | F-07    | Per REQUIREMENTS.md Documentation requirements. Adds `Users.jsx` to the Project Structure listing; notes CRUD/search/filter/pagination now live on the dedicated Users page. |

## 6. Carry-Forward Risks and Conditions

Risks from `docs/research/USR-01.md` § Risk register.

### Risks addressed by tasks

| Risk id | Severity | Addressed by |
|---------|----------|---------------|
| R-01    | HIGH     | T-04, T-05    |
| R-02    | MED      | T-01, T-06    |
| R-03    | MED      | T-01, T-06    |

R-04 (MED, backend pagination contract stability), R-05 (LOW, pagination performance at scale),
and R-06 (LOW, Dashboard backward-compat) are not re-addressed here — per `plan-authoring` §
Task breakdown, MED/LOW risks inherit their mitigation from the research doc and need no
re-statement when no PLAN task specifically owns them beyond what research already covers (R-04:
backend untouched by this story; R-05: pagination contract unchanged from SRF-01; R-06: Dashboard
route is not removed, only simplified, per T-02/T-04).

### Risks accepted (carry-forward)

None — all HIGH/MED risks called out in research are owned by a task above; no risk is deferred
past this story.

### Conditions for GO (research_verdict == GO-WITH-CONDITIONS)

Not applicable — `research_verdict` for USR-01 is a plain `GO` (89/100), not
`GO-WITH-CONDITIONS`. `docs/research/USR-01.md` § Conditions for GO states "None." This
sub-section is intentionally omitted per `plan-authoring`.

### Cross-Feature Dependency Notes

None. USR-01's only upstream dependency, SRF-01, is already merged and security-reviewed
(`docs/state/features.json` SRF-01: `phase: security-reviewed`, `gate: APPROVE`) — no in-flight
concurrent work is depended upon.

## 7. Test Strategy

| Layer       | Test path                                                        | TCs covered                                    | Notes                                                                 |
|-------------|-------------------------------------------------------------------|-------------------------------------------------|-------------------------------------------------------------------------|
| Unit        | `frontend/src/pages/__tests__/Users.search.test.jsx`              | TC-06, TC-07                                    | 300ms debounce / 0ms-on-clear, relocated verbatim from `Dashboard.search.test.jsx` per ADR-4 |
| Unit        | `frontend/src/pages/__tests__/Users.crud.test.jsx`                | TC-04                                           | Inactive-stat arithmetic: total_users=8, active_users=5 → Inactive=3 (ADR-3) |
| Integration | `frontend/src/pages/__tests__/Users.search.test.jsx`              | TC-08, TC-16                                    | Role/Status filter resets to page 1 (no debounce); Previous/Next pagination + boundary-disable |
| Integration | `frontend/src/pages/__tests__/Users.crud.test.jsx`                | TC-03, TC-05, TC-09, TC-10, TC-11, TC-12, TC-13, TC-14, TC-15, TC-18, TC-19, TC-20 | Stats-cards render, UserTable columns, view-detail flow, add/edit/delete success+failure paths, empty/no-results/error states |
| Integration | `frontend/src/pages/__tests__/Dashboard.search.test.jsx`          | TC-21, TC-22                                    | File exists post-extraction (not deleted) and asserts only against remaining Dashboard overview behavior — proves parity-without-loss per ADR-4 |
| Integration | `frontend/src/pages/__tests__/App.routing.test.jsx`               | TC-01, TC-02, TC-17, TC-25                      | Declared `type: e2e` in test-case JSON, but this repo has no e2e runner configured (`docs/config/project-commands.yaml`: `test_e2e: (n/a — no e2e suite configured)`). These four TCs describe component-visible, non-network behavior (nav click → active-state + correct page render; header button presence; initial loading skeletons; toolbar `aria-label`s) that is fully verifiable in jsdom via React Testing Library-style rendering of `App.jsx` — implemented here rather than deferred, so no coverage gap exists despite the absent e2e runner. Manual click-through (per story Test mapping) remains the pre-launch sanity check. |
| Performance | manual / structural assertion (no k6 or load-test harness exists) | TC-23                                           | The declared behavior ("requests stay paginated and search stays rate-bounded by 300ms") is a request-shape contract, not a load-test — it is verified structurally by the same assertions in TC-06/TC-07/TC-16 (exact `page`/`pageSize`/debounce-timing params sent to `getUsers`). No new perf runner is warranted; `docs/config/project-commands.yaml design_check:`/`test_e2e:` already documents this repo has no perf harness for either declared stack (pre-existing, intentional gap, not new drift introduced by this story). |
| Security    | manual checklist                                                   | TC-24                                           | Verified by code review confirming `Users.jsx` imports only from `services/userApi.js` (no direct `axios` import) — covered in `/arh-security-review`, consistent with the `plan-authoring` test-strategy template's own "Security: manual checklist... covered in /arh-security-review" pattern. |

**E2E**: NA — no e2e runner configured in this repo (`docs/config/project-commands.yaml`
`test_e2e: (n/a — no e2e suite configured)`), a pre-existing, documented gap for both declared
stacks (see the file's own header comment: "do not treat as accidental omissions"). All TCs
tagged `type: e2e` in `docs/test-cases/USR-01.json` are instead satisfied by jsdom-level
component tests in `App.routing.test.jsx` (T-07) that exercise the identical user-visible
behavior without requiring a browser-automation runner, plus the manual click-through named in
`docs/stories/USR-01.md` § Test mapping as the pre-launch sanity pass.

**Coverage gate**: `npm run test` (frontend) must be green with zero regressions in the
relocated `Dashboard.search.test.jsx` coverage — this is the story's own stated Success signal.

## Plan validation

- Date: 2026-08-14T20:00:00Z
- Verdict: PASS
- Wiring:                PASS  (F-01 `Users.jsx` is registered as consumed by F-05 `App.jsx`, listed `modify` in the same file table; F-02/F-03/F-08 are leaf test files, F-06/F-07 are leaf edits — no consumer required)
- Docs:                  PASS  (no T1-T4 trigger fires: no new runnable surface, no new HTTP route, no new env var, no new service/port — this is a pure frontend page-extraction against an already-frozen backend contract; T-08/F-07 README task included regardless, per REQUIREMENTS.md Documentation requirements, exceeding the minimum bar)
- Runner-setup:          PASS  (TC-01/02/17/25 declared `type: e2e` and TC-23 declared `type: performance` require no NEW runner: T-07 implements the e2e-labeled TCs as jsdom component tests using the already-configured Vitest runner, and the performance-labeled TC is satisfied structurally by existing unit-test assertions on request shape/timing — no test of `type: e2e | performance | contract` in this story's test-case JSON needs browser-automation or load-test infrastructure that doesn't already exist)
- Cross-section:         PASS  (every file-table row F-01..F-08 is referenced in a task's Files column: F-01→T-01, F-02→T-05, F-03→T-06, F-04→T-02, F-05→T-03, F-06→T-04, F-07→T-08, F-08→T-07; every task's Files column entries exist in the file table; every TC type in § 7 has a producing task: unit/integration→T-01/T-04/T-05/T-06/T-07, performance/security→documented manual/structural equivalents matching the plan-authoring template's own precedent)
- Config drift:          PASS  (no new runtime dependency, no new service, no new port introduced by this story — `docs/config/project-commands.yaml` `preflight:` and `docs/config/stack-smoke.md` require no edits; explicitly confirmed, not left unaddressed)
- Rounds:                1

### Plan validation rounds

| Round | Verdict | Failing dimensions | Action                    |
|-------|---------|---------------------|----------------------------|
| 1     | PASS    | —                   | Proceed to tracker push / `/arh-implement` |
