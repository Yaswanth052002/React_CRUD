# PLAN: AUTH-06 — Settings screen with user info and logout action

- Status: Accepted
- Story: AUTH-06
- Research verdict: GO-WITH-CONDITIONS (84/100)

## 1. Architecture Decisions

This story requires no ADR-worthy decision. Every contract it consumes is already locked by
upstream research/PLAN artefacts (AUTH-04's `GET /api/auth/me` response shape, AUTH-05's route
guard placement, AUTH-07's `logout()` export shape, and the loading/error UX). The work here is
wiring already-decided contracts together behind a new, minimal page component — no competent
reviewer would pick a materially different shape for "fetch on mount, render read-only fields,
call two already-defined functions on button click." No mini-ADR, no `decide` entry recorded.

### Cross-plan sequencing dependency 1 — `App.jsx` after AUTH-04 and AUTH-05 (not an ADR — a build-order constraint)

`frontend/src/App.jsx` is edited by three stories in this epic, in a specific required order:

1. **AUTH-04** (`docs/features/AUTH-04/PLAN.md` F-02/T-03, Plan validation: PASS) adds
   `isAuthenticated`/`sessionExpiredMessage` state and the `handleLoginSuccess`/`handleLogout`
   handler functions to `App.jsx`. AUTH-04 does not touch the `activeView` render switch.
2. **AUTH-05** (`docs/features/AUTH-05/PLAN.md` F-01/T-01, Plan validation: PASS) adds the
   `isAuthenticated`-gated conditional render branch (Login vs. protected tree) around the
   existing `Sidebar`+`Header`+`activeView` tree, and threads `handleLogout` as the eventual
   `onLogout` callback source. AUTH-05 does not touch the `SettingsPlaceholder`/`activeView`
   branch itself.
3. **AUTH-06** (this PLAN, F-03/T-03) makes the ONLY remaining edit to the `activeView` switch:
   replacing the `SettingsPlaceholder` branch with `<Settings onMenuClick={...} onLogout={handleLogout} />`.
   This task does not re-declare `isAuthenticated`, does not touch the outer conditional render
   branch AUTH-05 added, and does not touch `handleLogout`'s definition — it consumes
   `handleLogout` exactly as AUTH-04 defined it and AUTH-05 threaded it, passing it down as the
   `onLogout` prop per AUTH-06-FR-2.

T-03 below is sequenced with `Predecessors: T-02` in-plan; the cross-plan constraint (must merge
after AUTH-04's T-03 and AUTH-05's T-01) is recorded in T-03's Notes column and in § 6 Cross-Feature
Dependency Notes, following the same pattern AUTH-05's PLAN.md used for its own AUTH-04/AUTH-01
sequencing constraint.

### Cross-plan sequencing dependency 2 — `userApi.logout()` after AUTH-07 (not an ADR — an upstream-contract dependency)

`docs/features/AUTH-07/` has only `REQUIREMENTS.md` and `state.json` as of this PLAN's authoring —
AUTH-07 has not yet reached `/arh-plan-implementation`, so no `docs/features/AUTH-07/PLAN.md`
exists to confirm `logout()`'s final file location or implementation. Per the locked cross-story
contract restated in `docs/research/AUTH-06.md` condition #2 (RESOLVED) and REQUIREMENTS.md
AUTH-06-FR-2, `logout()` is a plain, stateless, synchronous function exported from
`frontend/src/services/userApi.js` (mirrors the `getCurrentUser()` export pattern; no backend call).
This PLAN's `Settings.jsx` (F-02/T-02) calls `userApi.logout()` by that already-locked contract
name and signature — it does NOT add the `logout()` export itself (that remains AUTH-07's file-table
responsibility). **This is a hard implementation-order dependency**: `Settings.jsx`'s Logout handler
will throw a `TypeError: userApi.logout is not a function` at runtime until AUTH-07's PLAN.md is
written and its `logout()` export lands in `userApi.js`. This dependency is NOT modeled as an
in-plan task predecessor (AUTH-07 is a separate feature with its own PLAN/tracker item); it is
recorded here, in T-02's Notes column, and in § 6 Cross-Feature Dependency Notes, so
`/arh-implement` and reviewers do not mistake T-02 for mergeable-and-shippable in isolation ahead of
AUTH-07. `Settings.jsx`'s own unit tests (F-04/T-04) mock `userApi.logout()` directly (per condition
#10 / TC-04), so T-02/T-04 can be authored and unit-tested before AUTH-07 merges — only the
end-to-end Logout flow is blocked until AUTH-07 ships.

## 2. File and Module Plan

| ID   | Action | Path                                                    | Reason                                                                                                     |
|------|--------|-----------------------------------------------------------|----------------------------------------------------------------------------------------------------------|
| F-01 | modify | `frontend/src/services/userApi.js`                          | Add `export async function getCurrentUser()` per AUTH-06-FR-1                                              |
| F-02 | create | `frontend/src/pages/Settings.jsx`                            | New Settings page: fetch current user on mount, render read-only fields + Logout button per AUTH-06-FR-1..4 |
| F-03 | modify | `frontend/src/App.jsx`                                       | Replace `SettingsPlaceholder` branch with `<Settings onMenuClick={...} onLogout={handleLogout} />`; consumer/entry-registration site for F-02, sequenced after AUTH-04's F-02/T-03 and AUTH-05's F-01/T-01 land |
| F-04 | create | `frontend/src/pages/__tests__/Settings.test.jsx`             | Unit coverage for AUTH-06-TC-01..TC-12                                                                     |
| F-05 | modify | `README.md`                                                  | § 11 (CRUD Usage) — add a short note that Settings is a read-only profile + Logout screen, no editing, per REQUIREMENTS.md § Documentation requirements |

### Wiring note

F-02 (`create`, `Settings.jsx`) has its consumer/entry-registration site listed explicitly as F-03
(`App.jsx`'s `activeView === "settings"` branch) — the only place any page component is mounted in
this app (there is no router). F-04 is a test-file leaf per the `plan-validation` wiring-dimension
exception. F-01 and F-05 are `modify` rows against already-wired files (`userApi.js` is the sole
HTTP entry point; `README.md` is the project's root documentation).

## 3. Module Hierarchy

```
services/
└── userApi (F-01, modify)
    └── getCurrentUser() -> Promise<{ name: string, email: string }>
        - input:  none
        - output: exactly { name, email } (no id, role, or other field read/exposed)
        - public: export async function getCurrentUser() {
            try {
              const res = await client.get("/api/auth/me");
              return res.data;
            } catch (err) {
              throw normalizeError(err);
            }
          }
          — mirrors the existing getUser/getDashboardStats pattern verbatim (single client.get,
          try/catch, normalizeError on failure, return res.data directly, no response wrapper).
          JSDoc comment above the function documents the exact return shape, per REQUIREMENTS.md
          § Documentation requirements — Inline code comments.

pages/
└── Settings (F-02, create)
    - props:   { onMenuClick: () => void, onLogout: () => void }
      - NO isAuthenticated prop is accepted, read, or destructured (per AUTH-06-FR-3/TC-06)
    - state:
      - currentUser: useState(null)              // { name, email } | null
      - loadingUser: useState(true)               // true until the mount fetch settles either way
      - error: useState(null)                     // string | null; set on fetch rejection
    - effect: useEffect(() => { ... }, [])         // empty-dependency array, runs exactly once
      - input:  none (calls userApi.getCurrentUser())
      - output: on resolve -> setCurrentUser(data), setLoadingUser(false), error stays null
                on reject  -> setError(err.message), setLoadingUser(false), currentUser stays null
                no retry, no polling, no cleanup needed (single one-shot async call)
    - handleLogout() -> void
      - input:  none
      - output: calls userApi.logout() FIRST, then props.onLogout() SECOND (per AUTH-06-FR-2);
                issues no navigation/redirect call itself (per TC-05); button has no loading
                state — logout() is synchronous per locked condition #8
    - render tree:
      - <Header title="Settings" onMenuClick={onMenuClick} />
      - <div className="page">
          page__header (eyebrow "Workspace", title "Settings", desc)
          <div className="panel">
            {loadingUser && !error &&
              <div className="details-header">
                <div className="details-item"><span className="details-item__label">Name</span>
                  <span className="details-item__value"><span className="spinner" /></span></div>
                <div className="details-item"><span className="details-item__label">Email</span>
                  <span className="details-item__value"><span className="spinner" /></span></div>
              </div>}
            {error &&
              <div className="banner banner-error" role="alert">{error}</div>}
            {!loadingUser && !error && currentUser &&
              <div className="details-grid">
                <div className="details-item">
                  <span className="details-item__label">Name</span>
                  <span className="details-item__value">{currentUser.name}</span>
                </div>
                <div className="details-item">
                  <span className="details-item__label">Email</span>
                  <span className="details-item__value">{currentUser.email}</span>
                </div>
              </div>}
            <button className="btn btn-secondary" onClick={handleLogout}>Logout</button>
          </div>
        </div>
      - NO `details-avatar` element anywhere (per RESOLVED condition #7 — no avatar; `getCurrentUser()`
        never returns `role`, so no avatar-color logic is possible or needed)
    - public: export default function Settings({ onMenuClick, onLogout })
```

## 4. State and Data Management

- **No new persistent/browser storage.** `Settings.jsx` reads no `localStorage`; token handling is
  entirely AUTH-04's `userApi.js` surface, unchanged by this story.
- **No global store.** `currentUser`/`loadingUser`/`error` are local `useState` in `Settings.jsx`,
  consistent with `react-patterns` § State management (no Redux/Zustand/Context in this repo) —
  matches the same page-level local-state pattern used by `Dashboard.jsx`/`Users.jsx`.
- **No cache/TTL.** The current-user fetch is a single bounded request per mount with no
  client-side cache; a fresh mount always re-fetches (acceptable per NFR — bounded, not
  unbounded, per research risk #4/MED, accepted as-is with no polling or retry).
- **No new backend schema or migration.** `GET /api/auth/me` is entirely AUTH-04/AUTH-02 scope;
  this story adds no backend code.

## 5. Task Breakdown

| #    | Title                                                                 | Complexity | [P] | Predecessors | Files | Notes                                                                                                                                    |
|------|--------------------------------------------------------------------------|------------|-----|---------------|-------|-------------------------------------------------------------------------------------------------------------------------------------------|
| T-01 | Add `getCurrentUser()` export to `userApi.js`                          | S          | [P] | —             | F-01  | Single `client.get("/api/auth/me")` call, `normalizeError` on failure, returns `res.data` directly — mirrors `getUser`/`getDashboardStats` verbatim; addresses condition #5/C-5 |
| T-02 | Build `Settings.jsx` page component                                    | M          |     | T-01          | F-02  | Implements the full component contract in § 3 (props, state, effect, `handleLogout`, render tree); addresses conditions #6/C-6, #9/C-9. **Calls `userApi.logout()` by its already-locked name/signature — does NOT add the `logout()` export itself; that export is AUTH-07's file-table responsibility and has not yet landed (no `docs/features/AUTH-07/PLAN.md` exists as of this PLAN). The end-to-end Logout flow is blocked on AUTH-07 shipping — see § 1 sequencing dependency 2.** |
| T-03 | Swap `SettingsPlaceholder` for `Settings` in `App.jsx`                  | S          |     | T-02          | F-03  | Replaces the `activeView === "settings"` branch; passes `onLogout={handleLogout}` (AUTH-04's handler, threaded per AUTH-05's already-landed guard). **Cross-plan: must merge after AUTH-04's T-03 and AUTH-05's T-01 land — see § 1 sequencing dependency 1.** |
| T-04 | Unit tests: `Settings.test.jsx`                                        | M          |     | T-02          | F-04  | Covers AUTH-06-TC-01..TC-12 (see § 7); mocks `userApi.getCurrentUser`/`userApi.logout` directly per condition #10/C-10 — no dependency on AUTH-04/AUTH-05's session-state implementation, no unauthenticated-case coverage (AUTH-05 owns that) |
| T-05 | Docs: update `README.md` § 11 with the Settings read-only note         | S          |     | T-02          | F-05  | Per REQUIREMENTS.md § Documentation requirements — one short paragraph under CRUD Usage stating Settings is read-only profile + Logout, no editing |

Predecessor DAG: T-01 has no predecessor and is `[P]` (touches only F-01, no other `[P]` task
shares F-01). T-02 depends on T-01 (imports the real `getCurrentUser` export) and is not `[P]`
because it shares no independently-mergeable-in-parallel batch with T-01 at dispatch time (T-01 is
its direct predecessor, not a sibling). T-03, T-04, and T-05 all depend on T-02 and touch disjoint
files (F-03, F-04, F-05 respectively) but are not marked `[P]` because T-02 (their shared
predecessor) is not guaranteed merged at dispatch time within this plan's own batch —
`/arh-implement` sequences them strictly after T-02 per the Predecessors column, mirroring the
identical caution AUTH-05's PLAN.md applied to its own T-02/T-03 pair.

## 6. Carry-Forward Risks and Conditions

Risks from `docs/research/AUTH-06.md` § Risk register.

### Risks addressed by tasks

| Risk id | Severity | Addressed by |
|---------|----------|---------------|
| #4      | MED      | T-02 (empty-dependency `useEffect`, no retry/poll logic in `handleLogout` or the mount effect) |
| #6      | MED      | T-04 (mocks `getCurrentUser`/`logout` directly, no AUTH-04/AUTH-05 session-state dependency) |
| #9      | MED      | T-01 (identity derived server-side by `GET /api/auth/me`, out of this story's code — confirmed, no client-supplied id param is ever sent) |

### Risks accepted (carry-forward)

None. No risk in the register is accepted-without-a-task; risks #1, #2, #3, #5, #7, #8, #10 are
RESOLVED in research (locked cross-story contracts) and need no re-statement here — #8 additionally
inherits its "no loading state on Logout button" mitigation directly into T-02's component contract
(§ 3), and #7 into T-02's "NO details-avatar element" render-tree note (§ 3).

### Conditions for GO (research_verdict GO-WITH-CONDITIONS)

| Cond | Condition (verbatim, abbreviated)                                                                                                   | Addressed by |
|------|------------------------------------------------------------------------------------------------------------------------------------------|---------------|
| C-1  | AUTH-04 `GET /api/auth/me` response schema — exactly `{name, email}`, no `role`/`id`, restated for implementer reference                | T-01          |
| C-2  | AUTH-07 `logout()` export — plain stateless function on `userApi.js`; Settings calls `userApi.logout()` then `props.onLogout()`         | T-02 (consumes the contract; export itself is AUTH-07's responsibility — see § 1 dependency 2) |
| C-3  | AUTH-05 route guard placement — lives in `App.jsx` before the `activeView` switch, not in `Settings.jsx`; no `isAuthenticated` prop needed | T-02 (no such prop accepted), T-03 (guard unmodified) |
| C-4  | Loading/error UX — spinner reusing `.spinner` class next to fields; inline persistent banner (not toast) on error                        | T-02          |
| C-5  | `getCurrentUser()` function signature and export — `export async function getCurrentUser()`, `client.get("/api/auth/me")`, `normalizeError` | T-01          |
| C-6  | `Settings.jsx` component structure — props, state, render tree, Logout handler wiring per the full component contract                   | T-02          |
| C-7  | No avatar in the details-header — plain text name/email only                                                                             | T-02          |
| C-8  | Logout button needs no loading state — `logout()` is synchronous, no backend call                                                        | T-02          |
| C-9  | Current-user identity derived server-side from the caller's Bearer token, never client-supplied; no client-side identity check in `Settings.jsx` | T-01 (confirms server-side derivation is AUTH-04/AUTH-02 scope), T-02 (no identity param ever sent), T-04 (TC-10) |
| C-10 | Test isolation — `Settings.jsx` unit tests mock `getCurrentUser()`/`logout()` directly, no AUTH-04/AUTH-05 session-state dependency, no unauthenticated-case coverage | T-04          |

### Cross-Feature Dependency Notes

- **AUTH-04** (`docs/features/AUTH-04/PLAN.md` F-02/T-03, Plan validation: PASS): supplies
  `handleLogout` (the function ultimately threaded as this story's `onLogout` prop) and the
  `GET /api/auth/me`-backed auth-state surface this story's `getCurrentUser()` (T-01) reads
  identity from. No code changes required in AUTH-04 beyond what it already ships.
- **AUTH-05** (`docs/features/AUTH-05/PLAN.md` F-01/T-01, Plan validation: PASS): supplies the
  `isAuthenticated`-gated conditional render branch that gates the entire `Sidebar`/`Header`/
  `activeView` tree — including this story's `Settings` page — before it can ever mount. T-03's
  `App.jsx` edit must merge after AUTH-05's T-01. See § 1 sequencing dependency 1.
- **AUTH-07** (`docs/features/AUTH-07/` — `REQUIREMENTS.md` and `state.json` only, no `PLAN.md` as
  of this PLAN's authoring): owns the `logout()` export this story's T-02 calls by name/contract.
  T-02 can be implemented and unit-tested (mocking `logout()`) ahead of AUTH-07, but the end-to-end
  Logout flow is non-functional until AUTH-07's `PLAN.md` is written and its `logout()` export
  lands in `userApi.js`. See § 1 sequencing dependency 2. This is a hard runtime dependency, not
  an accepted risk — no `accepted` carry-forward entry is written for it because it is not a risk
  being knowingly deferred, it is a known, documented sequencing gate on a sibling feature's
  delivery.

## 7. Test Strategy

| Layer                           | Test path                                          | TCs covered                    | Notes                                                                                                                          |
|-----------------------------------|-------------------------------------------------------|-----------------------------------|------------------------------------------------------------------------------------------------------------------------------|
| Integration                      | `frontend/src/pages/__tests__/Settings.test.jsx`       | AUTH-06-TC-01, TC-02, TC-04, TC-05 | Vitest + React Testing Library; mocks `../../services/userApi.js` (`getCurrentUser`, `logout`); TC-01/TC-02 exercise `getCurrentUser()`'s resolve/reject paths directly against the mocked module; TC-04/TC-05 click the Logout button and assert call order (`logout()` then `onLogout()`) and that no router/navigation call is made |
| Contract                         | `frontend/src/pages/__tests__/Settings.test.jsx`       | AUTH-06-TC-03, TC-06               | TC-03: asserts the rendered output only reads `name`/`email` off a mocked `getCurrentUser()` result that also includes extraneous `role`/`id` fields, proving they are never rendered; TC-06: renders `<Settings onMenuClick={fn} onLogout={fn} />` with no `isAuthenticated` prop and asserts identical output to a render that also passes an arbitrary `isAuthenticated` value — proving the prop is never read; runs under the existing Vitest runner, matching AUTH-04/AUTH-05's precedent for their own contract-typed TCs |
| Accessibility (declared `e2e`)   | `frontend/src/pages/__tests__/Settings.test.jsx`       | AUTH-06-TC-07, TC-08, TC-12        | Declared `type: e2e` in `docs/test-cases/AUTH-06.json`, executed under the already-configured Vitest/jsdom runner — this repo has no browser-automation e2e runner (`docs/config/project-commands.yaml test_e2e: n/a`), matching the identical precedent AUTH-01/AUTH-04/AUTH-05's PLANs applied to their own declared-`e2e` TCs. TC-07: asserts a `.spinner` element is present next to the name/email fields while the mocked `getCurrentUser()` promise is pending (using an unresolved promise). TC-08: asserts an inline `role="alert"` banner (not a toast) renders and remains present (no auto-dismiss timer) once the mocked promise rejects. TC-12: asserts the resolved fields use `details-item`/`details-item__label`/`details-item__value` classes matching `UserDetails.jsx`'s pattern |
| Performance (declared)           | `frontend/src/pages/__tests__/Settings.test.jsx`       | AUTH-06-TC-09                      | Asserts the mocked `getCurrentUser` spy is called exactly once after mount settles, and remains called exactly once after forcing a re-render (no re-mount) — proving the empty-dependency effect and absence of any retry/poll loop; executed under Vitest, no k6/browser perf runner needed since the assertion is a call-count check, not a load/latency benchmark, matching AUTH-05's identical precedent for its own declared-`performance` TC-09 |
| Security                         | `frontend/src/pages/__tests__/Settings.test.jsx`       | AUTH-06-TC-10, TC-11               | TC-10: asserts the mocked `getCurrentUser()` call is invoked with no arguments/params (proving no client-supplied identity is ever sent) — the server-side Bearer-token derivation itself is verified by AUTH-04/AUTH-02's own backend test suite, out of this story's file-table scope. TC-11: spies on `console.log`/`console.error` across both the success and failure paths and asserts the captured output never contains the mocked `name`/`email` values or raw error/stack-trace text |

Every TC in `docs/test-cases/AUTH-06.json` (TC-01 through TC-12) appears in the table above; none
are flagged `manual: true`. No new test runner is introduced: TC-03/TC-06 (`contract`), TC-07/
TC-08/TC-12 (`e2e`), and TC-09 (`performance`) all execute under the already-configured Vitest/
jsdom runner per the rationale in their rows above, consistent with AUTH-01/AUTH-04/AUTH-05's PLAN
precedent for declared-but-runner-less TC types in this repo — no Playwright/k6 install or config
task is added because no new runner requirement is introduced beyond what those sibling stories
already established as this repo's convention. Coverage gate: frontend unit/integration coverage
follows the repo's existing threshold (no `harness.yaml` override present -> 80% default, per
`docs/config/project-commands.yaml`).

### Plan validation rounds

| Round | Verdict | Failing dimensions | Action                  |
|-------|---------|---------------------|--------------------------|
| 1     | PASS    | —                   | Continue to tracker push |

## Plan validation

- Date: 2026-08-17T23:45:00Z
- Verdict: PASS
- Wiring: PASS (the sole new production module, `Settings.jsx` (F-02, `create`), has its
  consumer/entry-registration site — `App.jsx`'s `activeView === "settings"` branch — listed
  explicitly as `edited` at F-03 in the same file table; F-04 is a test-file leaf per the
  wiring-dimension exception; F-01 and F-05 are `modify` rows against already-wired files.)
- Docs: PASS (no T1/T2/T3/T4 rubric trigger fires — no new runnable surface, no new HTTP route
  authored by this story, no new env var, no new service dir/port. REQUIREMENTS.md §
  Documentation requirements explicitly names a README §11 update as in-scope for this story
  regardless of rubric-trigger status; T-05/F-05 addresses it directly rather than deferring it
  as carry-forward.)
- Runner-setup: PASS (AUTH-06-TC-03/TC-06 are `contract`-typed, TC-07/TC-08/TC-12 are
  `e2e`-typed, and TC-09 is `performance`-typed in `docs/test-cases/AUTH-06.json`; none require a
  new runner — all five execute under the already-configured Vitest/jsdom runner per the
  rationale in § 7's table rows, matching the identical precedent AUTH-01's, AUTH-04's, and
  AUTH-05's PLANs established for their own declared-`contract`/`e2e`/`performance` TCs in this
  repo, which has no browser-automation or load-test runner configured
  (`docs/config/project-commands.yaml test_e2e: n/a`).)
- Cross-section: PASS (every TC AUTH-06-TC-01..TC-12 in `docs/test-cases/AUTH-06.json` appears in
  § 7's table; every file table row F-01..F-05 is referenced by at least one task's Files column
  in § 5 — F-01 by T-01, F-02 by T-02, F-03 by T-03, F-04 by T-04, F-05 by T-05; every task's
  Files column references only F-NN ids present in § 2; all 10 research conditions C-1..C-10
  appear in § 6's Conditions for GO sub-section with non-empty Addressed-by cells; all three
  open-risk register entries (#4, #6, #9) appear in the Risks-addressed-by-tasks sub-table.)
- Config drift: PASS (no new runtime dependency, service directory, `docker-compose.yml` entry,
  or port is introduced by this story — F-01/F-03 modify existing files with existing imports;
  F-02 is a new page component using only already-installed React/existing CSS classes; F-04 uses
  only already-installed Vitest/Testing-Library tooling; F-05 is a documentation-only edit.)
- Rounds: 1
