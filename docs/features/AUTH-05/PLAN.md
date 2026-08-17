# PLAN: AUTH-05 — Navigation and routing for authenticated/unauthenticated views

- Status: Accepted
- Story: AUTH-05
- Research verdict: GO-WITH-CONDITIONS (83/100)

## 1. Architecture Decisions

This story requires no ADR-worthy decision. The change is a single conditional-render wrapper
around already-decided, cross-story-locked contracts: `isAuthenticated`/`sessionExpiredMessage`
(a plain `useState` boolean and a `string | null`, per AUTH-04's ADR-1, restated in condition C-1
below) and `LoginScreen`'s `onLoginSuccess`/`sessionExpiredMessage` props (per AUTH-01's locked
contract, condition C-2 below). No competent reviewer would pick a materially different shape for
"wrap the existing Sidebar+Header+activeView tree in an `isAuthenticated ? … : <LoginScreen …/>`
branch" — the codebase's existing conditional-render pattern (already used for `activeView`
switching) extends one level up with no new abstraction, no router, and no new state-management
primitive. No mini-ADR, no `decide` entry recorded.

### Cross-plan sequencing dependency (not an ADR — a build-order constraint)

`frontend/src/App.jsx` is edited by three stories in this epic. This PLAN's own F-01 task (T-01)
is a `modify` against a file that two OTHER stories' PLANs also modify, in a specific required
order:

1. **AUTH-04 (`docs/features/AUTH-04/PLAN.md` F-02/T-03, already Accepted/PASS)** adds the
   `isAuthenticated`/`sessionExpiredMessage` state, the mount-time expiry check, the
   `registerUnauthorizedHandler` wiring, and the `handleLoginSuccess`/`handleLogout` handler
   functions to `App.jsx`. AUTH-04's PLAN.md explicitly states it does NOT add the conditional
   Login-vs-protected-view render branch — that is out of AUTH-04's scope and is this story's
   scope.
2. **AUTH-01 (`docs/features/AUTH-01/PLAN.md` F-03/T-04, already Accepted/PASS)** creates the
   `LoginScreen` component this story mounts. AUTH-01's PLAN.md explicitly states no `App.jsx`
   mount site exists yet because wiring `LoginScreen` into `App.jsx` is this story's scope.
3. **AUTH-05 (this PLAN, F-01/T-01)** builds the conditional-render wrapper ON TOP of AUTH-04's
   already-landed state declarations, importing AUTH-01's already-landed `LoginScreen` component.
   This task does not re-declare `isAuthenticated`/`sessionExpiredMessage`/`handleLoginSuccess` —
   it consumes them exactly as AUTH-04 defined them, and does not modify `LoginScreen`'s internals
   — it consumes it exactly as AUTH-01 defined it.

Both AUTH-04's PLAN.md and AUTH-01's PLAN.md have `Plan validation: PASS`
(`docs/features/AUTH-04/state.json` / `docs/features/AUTH-01/state.json`), satisfying research
condition C-6 ("AUTH-04 conditions verification") — both upstream PLANs are confirmed complete and
their conditions addressed as of this PLAN's authoring, so T-01 below is unblocked at the planning
level; the remaining gate is implementation-order merge sequencing, tracked as T-01's predecessor
note in § 5.

## 2. File and Module Plan

| ID   | Action | Path                                                          | Reason                                                                                                       |
|------|--------|-----------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------|
| F-01 | modify | `frontend/src/App.jsx`                                          | Add the `isAuthenticated`-gated conditional render branch (Login-only vs. Sidebar+Header+activeView tree) per AUTH-05-FR-1; override `onLoginSuccess` to call `setActiveView("dashboard")` per AUTH-05-FR-2; pass `sessionExpiredMessage` through to `LoginScreen` unchanged per AUTH-05-FR-3; sequenced after AUTH-04's F-02 state/handlers and AUTH-01's F-03 `LoginScreen` component land |
| F-02 | modify | `frontend/src/pages/__tests__/App.routing.test.jsx`             | C-3 audit fix: this existing test (from USR-01) renders `<App />` with a `vi.mock("../../services/userApi.js")` that does not stub `getStoredToken`/`registerUnauthorizedHandler`; once F-01 lands, `App.jsx`'s `isAuthenticated` initializer calls `userApi.getStoredToken()` on the mocked module, which is `undefined` and throws. Add `getStoredToken: vi.fn(() => "mock.jwt.token")` (a token shaped so the real `jwt-decode` import in `App.jsx` decodes it as unexpired — a base64url-encoded header/payload/signature triple with a far-future `exp`) and `registerUnauthorizedHandler: vi.fn()` to the existing mock object so this test's nav-click assertions keep exercising the authenticated Sidebar/Header/activeView tree |
| F-03 | create | `frontend/src/__tests__/App.authGate.test.jsx`                  | New coverage for AUTH-05-TC-01 through AUTH-05-TC-11 (auth-gated mount/unmount, post-login `activeView` reset, `sessionExpiredMessage` pass-through, no-`authError`-prop contract check, no-added-network-call check, focus-order check) |

### Wiring note (no new production module created)

F-01 is a `modify` against `App.jsx`, which is already the root-mounted entry point (via
`frontend/src/main.jsx`, unchanged by this story) — no new consumer/entry-registration row is
needed because `App.jsx` itself IS the consumer/entry-registration site for `LoginScreen`
(AUTH-01's F-03) and for AUTH-04's `isAuthenticated`/`sessionExpiredMessage` state (AUTH-04's
F-02); this story's F-01 row is that registration. F-02 and F-03 are test-file leaves per the
`plan-validation` wiring-dimension exception (test files require no consumer/entry-registration
site).

## 3. Module Hierarchy

```
App.jsx (F-01, modify)
├── (unchanged, owned by AUTH-04) isAuthenticated: useState(() => Boolean(userApi.getStoredToken()))
├── (unchanged, owned by AUTH-04) sessionExpiredMessage: useState(null)
├── (unchanged, owned by AUTH-04) mount-time expiry check, registerUnauthorizedHandler wiring
├── (modified by this story) handleLoginSuccess(token: string) -> void
│   - input:  token string (from LoginScreen's onLoginSuccess callback)
│   - output: setIsAuthenticated(true) (AUTH-04's existing call, unchanged) PLUS
│     setActiveView("dashboard") (added by this story, unconditional override per AUTH-05-FR-2)
└── (new) render branch
    - input:  isAuthenticated (bool), sessionExpiredMessage (string | null)
    - output: isAuthenticated === false -> exactly one element,
      <LoginScreen onLoginSuccess={handleLoginSuccess} sessionExpiredMessage={sessionExpiredMessage} />,
      with no Sidebar/Header/Dashboard/Users/SettingsPlaceholder in the tree;
      isAuthenticated === true -> the existing Sidebar+Header+activeView tree, unchanged,
      with no LoginScreen in the tree
    - public: this is App's own render output; no new public contract, no new prop, no new export
```

No changes to `Sidebar.jsx` or `Header.jsx` — both are omitted from the tree (not CSS-hidden) when
`isAuthenticated` is false, and receive the same props as today when `isAuthenticated` is true.

## 4. State and Data Management

- **No new state introduced by this story.** `isAuthenticated` and `sessionExpiredMessage` are
  owned and set by AUTH-04 (F-02 in `docs/features/AUTH-04/PLAN.md`); this story only reads them
  to decide which branch to render and threads `sessionExpiredMessage` to `LoginScreen` verbatim,
  per AUTH-05-FR-3 (no local copy, no transformation, no `authError` state or prop anywhere in
  this story's code).
- **`activeView` state (pre-existing, owned by this story's parent scope in `App.jsx`)**: no new
  state variable — the existing `useState("dashboard")` declaration in `App.jsx` is unchanged.
  This story adds exactly one new call site: `handleLoginSuccess` now also calls
  `setActiveView("dashboard")`, unconditionally overriding whatever value `activeView` held before
  the auth state most recently went false (per AUTH-05-FR-2).
- **No persistent/browser storage change**: this story reads `isAuthenticated`/
  `sessionExpiredMessage` as props/state already materialized by AUTH-04; it performs no
  `localStorage` reads or writes itself.
- **No cache or TTL concern**: no data fetching is added by this story; the render-branch decision
  is synchronous and local to `App.jsx`.

## 5. Task Breakdown

| #    | Title                                                                                   | Complexity | [P] | Predecessors | Files | Notes                                                                                                                          |
|------|-------------------------------------------------------------------------------------------|------------|-----|---------------|-------|-------------------------------------------------------------------------------------------------------------------------------|
| T-01 | Add the `isAuthenticated`-gated conditional render branch to `App.jsx`                    | M          |     | —             | F-01  | In-plan: no predecessor. Cross-plan (not represented in this DAG, tracked here): must merge after AUTH-04's T-03 (`App.jsx` state/handlers) and AUTH-01's T-04 (`LoginScreen` component) land, per § 1 sequencing note. Adds the inline comment at the conditional (per REQUIREMENTS.md § Documentation requirements) noting the locked `isAuthenticated`/`LoginScreen` contracts so future edits don't reintroduce an `authError` prop or a `null`/loading tri-state. Addresses conditions C-1, C-2, C-4, C-5 (restated contracts) and C-6 (sequencing gate) below |
| T-02 | Audit-and-fix existing `App.routing.test.jsx` for the new auth gate (condition C-3)       | S          |     | T-01          | F-02  | Adds `getStoredToken`/`registerUnauthorizedHandler` stubs to the existing `userApi` mock so USR-01's nav-click/loading-state/toolbar-label assertions keep rendering the authenticated tree under the new gate; no assertion logic in the existing tests changes, only the mock surface grows |
| T-03 | New test file `App.authGate.test.jsx` covering AUTH-05-TC-01..TC-11                       | M          |     | T-01          | F-03  | Mocks `../services/userApi.js` (`getStoredToken`, `registerUnauthorizedHandler`, `clearAuthToken`) to control `isAuthenticated`'s initial value and to capture/invoke the registered unauthorized-handler callback for the true→false transition (TC-06); mocks `../components/LoginScreen.jsx` with a stub that renders a button invoking the received `onLoginSuccess` prop and displays the received `sessionExpiredMessage` prop, and asserts (via `vi.fn` call inspection) that no `authError` prop is ever passed (TC-08, contract); asserts mocked API call counts are unchanged across an `isAuthenticated` toggle (TC-09, performance); asserts Tab-order and `:focus-visible` on `nav-item` buttons in the authenticated branch (TC-11, declared `e2e`, executed under Vitest/jsdom per the same rationale AUTH-01/AUTH-04 applied to their own declared-`e2e` TCs — no browser-automation runner exists in this repo) |

Predecessor DAG (this plan): T-01 has no in-plan predecessor. T-02 and T-03 both depend on T-01
(both need the real conditional-render branch to test against) and touch disjoint files (F-02,
F-03 respectively) — they may be worked in parallel by separate subagents once T-01 has merged,
but neither is marked `[P]` because T-01 (their shared predecessor) is not guaranteed merged at
dispatch time within this plan's own batch; `/arh-implement` sequences T-02/T-03 strictly after
T-01 per the Predecessors column.

## 6. Carry-Forward Risks and Conditions

Risks from `docs/research/AUTH-05.md` § Risk register.

### Risks addressed by tasks

| Risk id | Severity | Addressed by |
|---------|----------|---------------|
| #3      | HIGH     | T-02          |

No CRITICAL or additional HIGH risks exist in the research risk register; risks #4/#5/#6 (MED) and
#7/#8 (LOW) inherit their mitigation from `docs/research/AUTH-05.md` and need no re-statement here
— #4 and #5 are additionally covered by T-01 (post-login `activeView` reset, `sessionExpiredMessage`
threading) as documented in the Conditions table below, and #8 is covered by T-03 (TC-09).

### Risks accepted (carry-forward)

None. No risk in the register is accepted-without-a-task; every applicable risk maps to T-01, T-02,
or T-03 above, or inherits its mitigation from the research doc per the skill's MED/LOW exemption.

### Conditions for GO (research_verdict GO-WITH-CONDITIONS)

| Cond | Condition (verbatim, abbreviated)                                                                                                   | Addressed by |
|------|------------------------------------------------------------------------------------------------------------------------------------------|---------------|
| C-1  | AUTH-04 `isAuthenticated` signal contract — plain `useState` boolean, never `null`/loading, restated for implementer reference           | T-01          |
| C-2  | AUTH-01 `LoginScreen` props contract — `onLoginSuccess`/`sessionExpiredMessage` only, no `authError`, restated for implementer reference | T-01          |
| C-3  | Existing test compatibility — audit and fix tests rendering `App.jsx` that assume Sidebar/Header always render                          | T-02          |
| C-4  | `sessionExpiredMessage` pass-through only — no local ownership, transformation, or default substitution                                 | T-01          |
| C-5  | Post-login `activeView` reset — `onLoginSuccess` calls `setActiveView("dashboard")` unconditionally                                     | T-01          |
| C-6  | AUTH-04 conditions verification — confirm AUTH-04's PLAN.md conditions are resolved before AUTH-05 implementation                        | T-01 (gated by the § 1 sequencing note; verified during this PLAN's authoring — `docs/features/AUTH-04/PLAN.md` § Plan validation reads PASS with all 10 conditions addressed, and `docs/features/AUTH-01/PLAN.md` § Plan validation reads PASS) |

### Cross-Feature Dependency Notes

- **AUTH-04** (`docs/features/AUTH-04/PLAN.md` F-02/T-03): supplies `isAuthenticated`,
  `sessionExpiredMessage`, and the `handleLoginSuccess`/`handleLogout` handler shells this story's
  T-01 extends. T-01 must merge after AUTH-04's T-03.
- **AUTH-01** (`docs/features/AUTH-01/PLAN.md` F-03/T-04): supplies the `LoginScreen` component
  this story's T-01 imports and mounts. T-01 must merge after AUTH-01's T-04.
- **AUTH-06**: depends on the Settings nav entry this story keeps available to authenticated users
  (unchanged by this story — `Sidebar`'s `NAV_ITEMS` are not modified).
- **AUTH-07**: depends on this story's fallback-to-Login behavior (AC #4 / TC-06) when
  `isAuthenticated` flips to false; this story implements the render-branch reaction, not the
  logout trigger itself.

## 7. Test Strategy

| Layer                         | Test path                                                     | TCs covered                                  | Notes                                                                                                                          |
|--------------------------------|------------------------------------------------------------------|-------------------------------------------------|------------------------------------------------------------------------------------------------------------------------------|
| Integration                    | `frontend/src/__tests__/App.authGate.test.jsx`                    | AUTH-05-TC-01, TC-02, TC-03, TC-04, TC-05, TC-06, TC-07 | Vitest + `react-dom/client`; mocks `userApi.getStoredToken`/`registerUnauthorizedHandler` to control the initial `isAuthenticated` value and to simulate the true→false transition; mocks `LoginScreen` to a stub exposing its received props for assertion |
| Contract                       | `frontend/src/__tests__/App.authGate.test.jsx`                    | AUTH-05-TC-08                                    | Structural assertion on the mocked `LoginScreen`'s received props — asserts no `authError` key is ever present; runs under the existing Vitest runner, no separate contract tool, matching AUTH-04's precedent for its own contract-typed TC-15 |
| Performance (declared)         | `frontend/src/__tests__/App.authGate.test.jsx`                    | AUTH-05-TC-09                                    | Asserts the mocked `userApi.*` call counts are identical immediately before and after an `isAuthenticated` false→true→false toggle; executed under Vitest, no k6/browser perf runner needed since the assertion is a call-count comparison, not a load/latency benchmark |
| Security                       | `frontend/src/__tests__/App.authGate.test.jsx`                    | AUTH-05-TC-10                                    | DOM query under jsdom asserting no Sidebar/Header/Dashboard/Users/Settings DOM nodes exist when `isAuthenticated` is false, and that no protected-endpoint mock (`getUsers`, `getDashboardStats`) is called in that state |
| Accessibility (declared `e2e`) | `frontend/src/__tests__/App.authGate.test.jsx`                    | AUTH-05-TC-11                                    | Testing-Library-style Tab-order simulation and `:focus-visible` computed-style assertion on the three `nav-item` buttons in the authenticated branch; declared `type: e2e` in `docs/test-cases/AUTH-05.json` but executed under the already-configured Vitest/jsdom runner — this repo has no browser-automation e2e runner (`docs/config/project-commands.yaml test_e2e: n/a`), matching the identical precedent AUTH-01's and AUTH-04's PLAN.md applied to their own declared-`e2e` TCs |
| Regression                     | `frontend/src/pages/__tests__/App.routing.test.jsx` (modified, F-02) | USR-01's existing TC-01/TC-02/TC-17/TC-25        | No new TCs; existing USR-01 nav/loading/a11y-label assertions continue to pass once the `userApi` mock is extended per C-3 (T-02) |

Every TC in `docs/test-cases/AUTH-05.json` (TC-01 through TC-11) appears in the table above; none
are flagged `manual: true`. No new test runner is introduced: TC-09 (performance) and TC-11
(declared `e2e`) both execute under the already-configured Vitest/jsdom runner per the rationale in
their rows above, consistent with AUTH-01's and AUTH-04's PLAN.md precedent for declared-but-
runner-less TC types in this repo — no Playwright/k6 install or config task is added because no new
runner requirement is introduced beyond what AUTH-01/AUTH-04 already established as this repo's
convention. Coverage gate: frontend unit/integration coverage follows the repo's existing threshold
(no `harness.yaml` override present, 80% default per `docs/config/project-commands.yaml`).

### Plan validation rounds

| Round | Verdict | Failing dimensions | Action                  |
|-------|---------|---------------------|--------------------------|
| 1     | PASS    | —                   | Continue to tracker push |

## Plan validation

- Date: 2026-08-17T23:10:00Z
- Verdict: PASS
- Wiring: PASS (no new production module is `create`d — F-01 is a `modify` row against `App.jsx`, which is itself the consumer/entry-registration site for AUTH-01's `LoginScreen` and AUTH-04's `isAuthenticated`/`sessionExpiredMessage` state; F-02/F-03 are test-file leaves per the wiring-dimension exception. Both cross-plan wiring dependencies — AUTH-04's `App.jsx` state and AUTH-01's `LoginScreen` component — are resolved explicitly by the § 1 sequencing note and § 6 Cross-Feature Dependency Notes rather than left implicit.)
- Docs: PASS (no trigger fires — T1: no new runnable surface; T2: no new HTTP route, this story makes no backend change; T3: no new env var; T4: no new service dir/port. REQUIREMENTS.md § Documentation requirements explicitly states "README updates: none required" for this story; the one documentation obligation it does name — an inline code comment at the auth-gate conditional — is captured in T-01's Notes column, not a README task.)
- Runner-setup: PASS (AUTH-05-TC-09 is `performance`-typed and AUTH-05-TC-11 is `e2e`-typed in `docs/test-cases/AUTH-05.json`; neither requires a new runner — TC-09 is a mocked-call-count comparison executable under the already-configured Vitest runner, and TC-11 is a Tab-order/focus-visible DOM assertion executable under the already-configured Vitest/jsdom runner, matching the identical precedent AUTH-01's PLAN.md and AUTH-04's PLAN.md established for their own declared-`e2e`/`performance`/`contract` TCs in this repo, which has no browser-automation or load-test runner configured (`docs/config/project-commands.yaml test_e2e: n/a`).)
- Cross-section: PASS (every TC AUTH-05-TC-01..TC-11 in `docs/test-cases/AUTH-05.json` appears in § 7's table; every file table row F-01..F-03 is referenced by at least one task's Files column in § 5 — F-01 by T-01, F-02 by T-02, F-03 by T-03; every task's Files column references only F-NN ids present in § 2; all 6 research conditions C-1..C-6 appear in § 6's Conditions for GO sub-section with non-empty Addressed-by cells; the sole HIGH risk (#3) appears in the Risks-addressed-by-tasks sub-table.)
- Config drift: PASS (no new runtime dependency, service directory, `docker-compose.yml` entry, or port is introduced by this story — F-01 modifies an existing file with existing imports; F-02/F-03 are test files using only already-installed Vitest/Testing-Library tooling.)
- Rounds: 1
