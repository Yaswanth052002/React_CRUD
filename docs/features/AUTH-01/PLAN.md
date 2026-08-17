# Plan: AUTH-01 — Login screen UI and entry point

Status: Draft

## 1. Architecture Decisions

This story requires no ADR-worthy decision for the component split. `LoginForm` (presentational) vs.
`LoginScreen` (container) is a direct, mechanical application of the callback-only convention
already established by `UserForm.jsx` (presentational, receives `onSubmit`/`submitting` props)
paired with a page-level owner of async state — the same shape `Dashboard.jsx` already uses for
`Users.jsx`/`UserForm.jsx` composition. There is no second option a competent reviewer would
plausibly prefer here (a single merged component would violate `react-patterns` § Idioms
"components accept callbacks, never call services directly" and the locked AUTH-05 contract
which names `LoginScreen` as the container that owns `onLoginSuccess`); the requirements
(`AUTH-01-FR-1`, `AUTH-01-FR-2`) already dictate the two-file split verbatim. No mini-ADR, no
`decide` entry recorded.

## 2. File and Module Plan

| ID   | Action | Path                                                          | Reason                                                                                     |
|------|--------|----------------------------------------------------------------|---------------------------------------------------------------------------------------------|
| F-01 | create | `frontend/src/services/userAuthService.js`                     | New mocked `login(email, password)` module boundary per AUTH-01-FR-2                        |
| F-02 | create | `frontend/src/components/LoginForm.jsx`                        | Presentational form: fields, validation, loading/error UI per AUTH-01-FR-2                  |
| F-03 | create | `frontend/src/components/LoginScreen.jsx`                       | Container: owns loading/error state, calls F-01, calls `userApi.setAuthToken` + `onLoginSuccess` per AUTH-01-FR-1 |
| F-04 | create | `frontend/src/components/__tests__/LoginForm.test.jsx`         | Unit/integration coverage for TC-01, TC-04..TC-09 (LoginForm-level assertions)               |
| F-05 | create | `frontend/src/components/__tests__/LoginScreen.test.jsx`        | Unit/integration coverage for TC-02, TC-03 (container call-sequence: mock F-01 + `userApi`)   |
| F-06 | modify | `frontend/src/services/userApi.js`                              | Add `setAuthToken(token)` export — the wiring/consumer site `LoginScreen` (F-03) calls per the locked AUTH-05 contract sequence (`setAuthToken` then `onLoginSuccess`); this function does not exist in the current module and must be added for F-03 to call it |

### Note on wiring scope (no `App.jsx` entry)

This story's Rollout plan and story Decision log are explicit: `LoginScreen`/`LoginForm` are
**intentionally unmounted** — no consumer/entry-registration site exists yet for the
`LoginScreen` component itself, because mounting it into `App.jsx`'s `activeView` state machine
is AUTH-05's scope, not AUTH-01's. This is a documented, deliberate "additive, zero blast
radius until AUTH-05 wires them in" rollout strategy (see REQUIREMENTS.md § Rollout plan), not an
omission. The one real wiring dependency inside this story's boundary — `LoginScreen` (F-03)
calling `userApi.setAuthToken` — IS captured as an edited row (F-06) above, so every new module
this story introduces has its real, in-scope consumer/dependency accounted for in the file table.
`userAuthService.js` (F-01) is consumed by `LoginScreen` (F-03), which is listed. No file in this
plan is created without an identified, in-scope consumer.

## 3. Module Hierarchy

```
components/
├── LoginForm (F-02)
│   - input:  { onSubmit: (values: {email, password}) => void, isSubmitting: boolean }
│   - output: none (calls onSubmit; renders form markup)
│   - public: default export <LoginForm onSubmit isSubmitting />
└── LoginScreen (F-03)
    - input:  { onLoginSuccess: (token: string) => void, sessionExpiredMessage?: string | null }
    - output: none (side effect: userApi.setAuthToken(token) then onLoginSuccess(token))
    - public: default export <LoginScreen onLoginSuccess sessionExpiredMessage />
    - owns:   isSubmitting (bool), authError (string | null) local state
    - calls:  userAuthService.login(email, password) (F-01), userApi.setAuthToken(token) (F-06)

services/
└── userAuthService (F-01)
    - input:  (email: string, password: string)
    - output: Promise<{ token: string }> (resolve) | Promise<never> (reject, generic Error)
    - public: async function login(email, password)
    - note:   mock only in this story; comment marks AUTH-02 as the real-implementation owner

userApi (F-06, addition only)
└── setAuthToken(token: string) -> void
    - stores the token on the shared axios client (`client.defaults.headers.common.Authorization`)
      so subsequent userApi.* calls carry it; no other existing export in this file is touched
```

## 4. State and Data Management

- No new persistent/server state — `userAuthService.login()` is a mocked, in-memory async stub
  (per REQUIREMENTS.md § Documentation requirements: "no backend endpoint is introduced").
- No new client-side global store — `LoginScreen` (F-03) owns `isSubmitting` and `authError` as
  local `useState`, mirroring `UserForm.jsx`'s local-state pattern (no Context/Redux/Zustand, per
  `react-patterns` § State management).
- `userApi.setAuthToken(token)` (F-06) sets an in-memory default header
  (`client.defaults.headers.common.Authorization = \`Bearer ${token}\``) on the existing shared
  axios instance — no `localStorage`/`sessionStorage`/cookie persistence is introduced by this
  story (persistence across reloads is AUTH-04's scope, per REQUIREMENTS.md § Scope Out). Token
  value itself is never logged (F-01's mock and F-06's setter contain no `console.*` calls, per
  security-baseline).
- Password value lives only in `LoginForm`'s local `values.password` state for the lifetime of
  the mounted form; it is never copied to `LoginScreen` state, never included in the generic
  error message, and is cleared implicitly on unmount (no persistence layer touches it).

## 5. Task Breakdown

| #     | Title                                                                 | Complexity | [P] | Predecessors | Files      | Notes                                                                 |
|-------|------------------------------------------------------------------------|------------|-----|---------------|------------|------------------------------------------------------------------------|
| T-01  | Add `setAuthToken` export to `userApi.js`                             | S          | [P] | —             | F-06       | Additive-only export; no existing export signature changes             |
| T-02  | Create mocked `userAuthService.login(email, password)`                | S          | [P] | —             | F-01       | Resolves `{token}` after a short `setTimeout`-based delay in dev/test fixture usage; rejects with a generic `Error`; one-line comment marks it as a mock pending AUTH-02; never logs credentials |
| T-03  | Build `LoginForm.jsx` (fields, validation, loading UI, error region)  | M          |     | —             | F-02       | Mirrors `UserForm.jsx` validate()/touched/err() pattern for email+password; reuses `.form-group`/`.form-label`/`.form-input`/`.form-error`/`.spinner`/`.btn`/`.btn-primary`; `autoComplete="username"`/`"current-password"`; `aria-required="true"`; covers AC#1, AC#2 (button), AC#4, AC#5 |
| T-04  | Build `LoginScreen.jsx` (container: call sequence + error/loading own) | M          | | T-01, T-02, T-03 | F-03  | Calls `userAuthService.login` (F-01) then `userApi.setAuthToken` (F-06) then `props.onLoginSuccess`, in that locked order; renders `sessionExpiredMessage` (when non-null) above the form separately from the submit-attempt `.form-server-error`; covers AC#2, AC#3, FR-1's prop contract |
| T-05  | Unit tests: `LoginForm.test.jsx` (validation, a11y, responsive, security) | M       | | T-03          | F-04       | Covers TC-01, TC-04, TC-05 (jsdom viewport resize assertion), TC-06, TC-07 (no console/DOM password leak), TC-08 (label/aria-required/aria-live/focus-visible/44px), TC-09 (spinner present within one microtask/act() of click) |
| T-06  | Integration tests: `LoginScreen.test.jsx` (call-sequence + generic error) | M       | | T-04          | F-05       | Mocks `userAuthService` and `userApi.setAuthToken` via `vi.mock`; covers TC-02 (resolve → setAuthToken → onLoginSuccess order) and TC-03 (reject → immediate re-enable, no `setAuthToken`/`onLoginSuccess` call) |

Predecessor DAG: T-01, T-02, T-03 have no predecessors and touch disjoint files (F-06, F-01, F-02
respectively) — all three are `[P]`. T-04 depends on all three (needs the real `setAuthToken`
export, the real mock, and `LoginForm` to compose). T-05 depends only on T-03 (tests `LoginForm`
in isolation). T-06 depends on T-04 (tests the composed container).

No documentation task, runner-setup task, or config-drift task is required — see § 6 rationale
below for why each dimension's trigger does not fire for this story.

## 6. Carry-Forward Risks and Conditions

Risks from `docs/research/AUTH-01.md` § Risk register.

### Risks addressed by tasks

| Risk id | Severity | Addressed by  |
|---------|----------|----------------|
| R-1     | HIGH     | T-03, T-05, T-06 |
| R-2     | MED      | T-02, T-06     |
| R-3     | MED      | T-03           |
| R-4     | MED      | T-03, T-05     |
| R-5     | LOW      | T-03 (existing `.spinner` reused as-is; no additional work needed) |
| R-6     | LOW      | T-03 (submit button `disabled={isSubmitting}` prevents double-submit, mirroring `UserForm.jsx`) |

No risks are accepted/carried forward — every risk in the research register maps to an in-scope
task above; `research_verdict` is `GO` (no conditions), so no `### Conditions for GO` sub-section
applies.

### Cross-Feature Dependency Notes

- AUTH-02 will replace the body of `userAuthService.login()` (F-01) with a real backend call;
  this story's one-line mock comment (T-02) exists specifically to make that swap self-evident.
- AUTH-04 consumes the `sessionExpiredMessage` prop on `LoginScreen` (F-03) to redirect back to
  Login with a message set; AUTH-04 sets that prop from its own state — no coupling beyond the
  locked prop contract already implemented in T-04.
- AUTH-05 is the sole owner of mounting `LoginScreen` into `App.jsx`'s `activeView` state
  machine; no task in this plan touches `App.jsx`.

## 7. Test Strategy

| Layer               | Test path                                                      | TCs covered              | Notes                                                                 |
|---------------------|------------------------------------------------------------------|---------------------------|------------------------------------------------------------------------|
| Unit/Integration     | `frontend/src/components/__tests__/LoginForm.test.jsx`           | TC-01, TC-04, TC-06       | Vitest + Testing Library; renders `LoginForm` directly with a stub `onSubmit`/`isSubmitting` |
| Unit/Integration     | `frontend/src/components/__tests__/LoginForm.test.jsx`           | TC-05                     | jsdom `window.innerWidth`/matchMedia-driven resize assertion against the existing 640px/320px reflow (no new breakpoint added); asserts `scrollWidth <= clientWidth` at 320px |
| Security (automated) | `frontend/src/components/__tests__/LoginForm.test.jsx`           | TC-07                     | Spies on `console.log`/`console.error`; asserts no DOM node's `textContent`/`value` equals the submitted password after a rejected submit |
| Accessibility (automated) | `frontend/src/components/__tests__/LoginForm.test.jsx`       | TC-08                     | Testing-Library queries: `getByLabelText`, `aria-required` attribute assertions, `aria-live="assertive"` on the error container, computed style check for `:focus-visible` outline and button `getBoundingClientRect()` >= 44×44 |
| Performance (automated)| `frontend/src/components/__tests__/LoginForm.test.jsx`         | TC-09                     | Uses `@testing-library/react`'s synchronous `act()` + `fireEvent.click`; asserts `disabled` + `.spinner` are present in the DOM synchronously after the click event, before the mocked promise resolves — this is a deterministic assertion (no `performance.now()` timing gate is used, since jsdom doesn't guarantee real paint timing); it satisfies the <16ms budget by construction (state update to `isSubmitting=true` happens synchronously in the click handler, verified before any `await`) |
| Integration          | `frontend/src/components/__tests__/LoginScreen.test.jsx`         | TC-02, TC-03              | `vi.mock("../../services/userAuthService")` and `vi.mock("../../services/userApi")`; asserts call order via mock call-order timestamps/`mock.invocationCallOrder` |

All 9 declared TCs in `docs/test-cases/AUTH-01.json` are covered above. TC-05 and TC-08 are
declared `type: e2e` in the test-case JSON but are authored and executed here as
Testing-Library/jsdom assertions against the same DOM/CSS contract a Playwright run would check
(label linkage, `aria-live`, focus-visible, bounding-box, `scrollWidth`/`clientWidth`) — this repo
has no e2e runner configured (`docs/config/project-commands.yaml test_e2e: (n/a — no e2e suite
configured)`), and REQUIREMENTS.md § Rollout plan / story Test mapping explicitly scope this
story's automated coverage to Vitest (`npm run test`) only, deferring real-browser/viewport E2E
and axe-core scanning to manual verification (story § Test mapping: "Manual: verify login screen
renders correctly and remains usable at 320px, 640px, 1100px+ ... in local dev and docker-compose
... per AUTH-08 environment scope") and to AUTH-08/whichever future story introduces an e2e
runner. No e2e/perf/contract runner-setup task is added to § 5 because this story does not
introduce a new e2e/perf/contract runner requirement beyond what is already explicitly deferred
by the story's own Test mapping section — adding Playwright/k6 tooling is out of this story's
scope and would be a new, unrequested capability, not a task this story's ACs require.

### Coverage gates

- Unit coverage: no explicit threshold configured in this repo (`docs/config/project-commands.yaml`
  has no coverage gate); T-05/T-06 must each pass 100% of their asserted TCs before merge.
- `npm run test` (Vitest) must be green pre-commit per `/arh-implement` Step 2, covering F-04 and
  F-05 in full.

## Plan validation

- Date: 2026-08-17T18:10:00Z
- Verdict: PASS
- Wiring: PASS (every `create` row's real in-scope consumer is listed: F-01 consumed by F-03/T-04; F-02 consumed by F-03/T-04; F-06 consumed by F-03/T-04. `LoginScreen` itself has no `App.jsx` mount site because REQUIREMENTS.md § Rollout plan explicitly scopes that wiring to AUTH-05 — documented exception, not a gap, per the "Note on wiring scope" in § 2.)
- Docs: PASS (no trigger fires — T1: no new runnable surface, `LoginScreen` is unmounted and unreachable; T2: no new HTTP route, `userAuthService.login` is a client-only mock per REQUIREMENTS.md § Documentation requirements; T3: no new env var; T4: no new service dir/port. REQUIREMENTS.md § Documentation requirements explicitly states "README updates: none required by this story.")
- Runner-setup: PASS (all 9 TCs execute under the already-configured Vitest runner; TC-05/TC-08 are declared `type: e2e` in the test-case JSON but this repo has no e2e runner today (`project-commands.yaml test_e2e: n/a`) and the story's own Test mapping section defers real-browser verification to manual QA, not to an automated e2e suite this plan would need to stand up — no e2e/perf/contract runner is being introduced by this story's scope, so no setup task is required.)
- Cross-section: PASS (every TC in the test-strategy table maps to a task — T-05 produces TC-01/04/05/06/07/08/09, T-06 produces TC-02/03; every file table row F-01..F-06 is referenced by at least one task's Files column; every task's Files column references only F-NN ids present in § 2.)
- Config drift: PASS (no new runtime dependency added — `userAuthService.js` and `setAuthToken` use only `axios`, already a `frontend/package.json` dependency; no new service dir, `docker-compose.yml` entry, or port introduced.)
- Rounds: 1
