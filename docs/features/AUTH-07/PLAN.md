# PLAN: AUTH-07 — Logout and session/token invalidation

- Status: Accepted
- Story: AUTH-07
- Research verdict: GO-WITH-CONDITIONS (89/100)

## 1. Architecture Decisions

This story requires no ADR-worthy decision. `logout()`'s signature, call sequence, and payload
shape are all RESOLVED locked cross-story contracts per research conditions #1, #2, #3, #9, #10
and REQUIREMENTS.md FR-1..FR-4 — no competent reviewer would pick a materially different shape
for "call an existing clear-token export, log a fixed-shape event, return undefined." No mini-ADR,
no `decide` entry recorded.

### Cross-plan sequencing dependency 1 — `userApi.js` after AUTH-04's F-01 (not an ADR — a build-order constraint)

`frontend/src/services/userApi.js` is edited by two stories in this epic, in a specific required
order:

1. **AUTH-04** (`docs/features/AUTH-04/PLAN.md` F-01/T-02, Plan validation: PASS) adds the
   request/response interceptor pair and the `getStoredToken()` / `setAuthToken(token)` /
   `clearAuthToken()` / `registerUnauthorizedHandler(callback)` exports to `userApi.js`. This is
   the file's baseline auth-token surface that this story's `logout()` calls into.
2. **AUTH-07** (this PLAN, F-01/T-01) makes an ADDITIVE edit on top of AUTH-04's already-landed
   surface: a new, separate `export function logout()` that calls AUTH-04's `clearAuthToken()`
   exactly once and logs the `auth:logout` observability event. This task does not redefine, wrap,
   or modify `clearAuthToken()`, `getStoredToken()`, `setAuthToken()`, or
   `registerUnauthorizedHandler()` — it is a pure new export appended alongside them.

T-01 below is sequenced with `Predecessors: —` in-plan (it has no in-plan predecessor because this
story does not itself re-implement AUTH-04's surface), but the cross-plan constraint — T-01 must
merge after AUTH-04's T-02 lands in `userApi.js` — is recorded here and in § 6 Cross-Feature
Dependency Notes, following the identical pattern AUTH-06's PLAN.md used for its own
`App.jsx`-after-AUTH-04/AUTH-05 sequencing constraint. Until AUTH-04's `clearAuthToken()` export
exists in `userApi.js`, this story's `logout()` implementation has nothing to call and cannot be
authored against real code (only against a mock in isolated unit tests).

### Cross-plan sequencing dependency 2 — AUTH-06 is a downstream runtime consumer of this story's `logout()` export (not an ADR — a downstream-dependency note)

`docs/features/AUTH-06/PLAN.md` (already written, Plan validation: PASS) § 1 "Cross-plan
sequencing dependency 2" and T-02's Notes column both record a **hard runtime dependency** on this
story's `logout()` export: AUTH-06's `Settings.jsx` (`docs/features/AUTH-06/PLAN.md` F-02/T-02)
calls `userApi.logout()` by the already-locked name and signature this story's FR-1 defines, but
does not add the export itself — that responsibility belongs entirely to this story's F-01/T-01.
AUTH-06's own component unit tests mock `userApi.logout()` directly (per AUTH-06 condition #10),
so AUTH-06's `Settings.jsx` can be authored and unit-tested ahead of this story landing — but the
end-to-end Logout button click (AUTH-06-TC-04/TC-05) remains non-functional until this story's
`logout()` export actually lands in `userApi.js`. This PLAN does not re-edit AUTH-06's PLAN.md or
files — AUTH-06's Settings Logout button `onClick` wiring (`userApi.logout()` then
`props.onLogout()`) is entirely AUTH-06's file-table responsibility and is already correctly
specified there. This story's obligation is solely to deliver the `logout()` export with the exact
contract AUTH-06 already assumes.

## 2. File and Module Plan

| ID   | Action | Path                                                         | Reason                                                                                                    |
|------|--------|-----------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------|
| F-01 | modify | `frontend/src/services/userApi.js`                               | Add `export function logout()` per FR-1/FR-3/FR-4; additive edit sequenced after AUTH-04's F-01/T-02 (see § 1 dependency 1); calls AUTH-04's `clearAuthToken()` only, no redefinition of the AUTH-04 surface |
| F-02 | create | `frontend/src/services/__tests__/userApi.logout.test.js`          | New sibling test file (not an extension of AUTH-04's `userApi.auth.test.js` — see rationale below) covering TC-02, TC-03, TC-05, TC-06, TC-07, TC-08, TC-10 |
| F-03 | modify | `README.md`                                                       | § 11 (CRUD Usage) — add the one-line note that Logout (Settings screen) clears the client-side session and redirects to Login with no server-side call, per REQUIREMENTS.md § Documentation requirements |

### Test-file naming decision (documented per REQUIREMENTS.md, not ADR-worthy)

This story creates a new sibling test file, `userApi.logout.test.js`, rather than extending
AUTH-04's `userApi.auth.test.js`. Rationale: AUTH-04's `userApi.auth.test.js` (F-04 in
`docs/features/AUTH-04/PLAN.md`) is scoped to the interceptor pair and the four token-storage
exports (`getStoredToken`/`setAuthToken`/`clearAuthToken`/`registerUnauthorizedHandler`); appending
`logout()`-specific coverage (idempotency, double-invocation, the micro-benchmark harness, and the
`auth:logout` event-shape assertions) to that file would grow an already-focused test file with a
second, unrelated concern (single-responsibility per `.claude/rules/reusability-baseline.md`).
A sibling file keeps each test file's failure surface mapped 1:1 to one exported function's
concern, matching this repo's existing per-concern test-file convention (e.g. `Settings.test.jsx`
is its own file rather than folded into an existing page test).

### Wiring note

`logout()` (F-01) is a new named export added to an already-wired file — `userApi.js` is the sole
HTTP/auth-surface entry point per `CLAUDE.md` and is already imported wherever needed; no new
consumer-registration site is required within this story's own scope. The one downstream consumer
of this new export — AUTH-06's `Settings.jsx` — already exists as an approved, PASS-validated PLAN
(`docs/features/AUTH-06/PLAN.md` F-02/T-02) that calls `userApi.logout()` by contract; per the
`plan-validation` wiring dimension, that consumer is a sibling feature's already-documented
file-table row, not a new module this PLAN must itself list as `edited` (this PLAN introduces no
new production module requiring a new consumer inside AUTH-07's own file table). F-02 is a
test-file leaf per the wiring-dimension exception. F-03 is a `modify` row against an already-wired
root documentation file.

## 3. Module Hierarchy

```
services/
└── userApi (F-01, modify — additive export alongside AUTH-04's existing surface)
    └── logout() -> undefined
        - input:  none
        - output: undefined (synchronous; no Promise, no async work, no HTTP call)
        - side effects, in exact order:
            1. calls userApi's own `clearAuthToken()` (AUTH-04's export) exactly once —
               removes the `auth_token` localStorage key and resets the axios
               `Authorization` default header; wrapped internally by AUTH-04's own
               try/catch around `localStorage.removeItem` (per condition C-7/FR-4 — this
               story does not re-wrap clearAuthToken's internals, it relies on AUTH-04's
               existing error tolerance)
            2. logs `console.log("auth:logout", { timestamp: new Date().toISOString() })`
               — payload contains exactly `{ timestamp }`, no user id, no token value
               (per FR-3/condition C-9)
        - public: exported function; synchronous; idempotent (calling twice produces no
          thrown errors — `clearAuthToken()`'s underlying `removeItem` is a no-op on an
          absent key, and the console.log call has no shared mutable state to corrupt)
        - inline code comment above the function body notes the stateless-JWT tradeoff
          (token remains cryptographically valid until its 60-minute TTL expires; no
          server-side revocation exists) per REQUIREMENTS.md § Documentation
          requirements — Inline code comments
```

No new React component or hook is introduced. `App.jsx`'s `registerUnauthorizedHandler` wiring and
`handleLogout` definition already exist as AUTH-04's F-02/T-03 (Plan validation: PASS) — this story
does not re-touch `App.jsx`; FR-2's App.jsx-side contract is already fully satisfied by AUTH-04's
already-landed `handleLogout() { userApi.clearAuthToken(); setIsAuthenticated(false);
setSessionExpiredMessage(null); }` and `registerUnauthorizedHandler(() =>
setIsAuthenticated(false))` wiring — both flip the same `isAuthenticated` boolean, satisfying FR-2's
"no duplicate mechanism" requirement with zero new code in `App.jsx`. Settings' Logout button
`onClick` (calling `userApi.logout()` then `props.onLogout()`) is AUTH-06's file-table
responsibility (`docs/features/AUTH-06/PLAN.md` F-02/T-02), not re-implemented here.

## 4. State and Data Management

- **No new persistent/browser storage.** `logout()` clears the existing `auth_token` `localStorage`
  key via AUTH-04's `clearAuthToken()`; it introduces no new key, no new storage mechanism.
- **No new client-side state.** `isAuthenticated` and `sessionExpiredMessage` already exist as
  `App.jsx` `useState` values from AUTH-04 (F-02/T-03); this story adds no new state variable.
- **No cache/TTL introduced.** The cleared JWT's server-side validity window (60-minute TTL) is
  unchanged and unaffected by client-side logout — this is the accepted stateless-JWT tradeoff
  (condition #5/C-5, restated in § 6 below), not a cache-invalidation event this story manages.
- **No new backend schema, endpoint, or migration.** `logout()` performs zero HTTP calls (per
  FR-1/TC-03) — this story adds no backend code and touches no backend file.

## 5. Task Breakdown

| #    | Title                                                                 | Complexity | [P] | Predecessors  | Files | Notes                                                                                                                                     |
|------|--------------------------------------------------------------------------|------------|-----|----------------|-------|-------------------------------------------------------------------------------------------------------------------------------------------|
| T-01 | Implement `logout()` export in `userApi.js`                            | S          |     | —              | F-01  | Calls `clearAuthToken()` exactly once, then logs `console.log("auth:logout", { timestamp })`; returns `undefined`; no HTTP call; inline comment documents the stateless-JWT tradeoff per REQUIREMENTS.md § Documentation requirements. **Cross-plan: must merge after AUTH-04's F-01/T-02 (`clearAuthToken()` export) lands — see § 1 sequencing dependency 1.** Addresses FR-1, FR-3, FR-4, conditions #1/C-1, #7/C-7 (relies on AUTH-04's existing try/catch), #8/C-8, #9/C-9, #10/C-10 |
| T-02 | Unit/integration tests: `userApi.logout.test.js` (functional coverage) | M          |     | T-01           | F-02  | Covers TC-02 (`clearAuthToken()` called exactly once, `auth_token` key removed, axios `Authorization` default unset), TC-03 (zero HTTP requests, synchronous `undefined` return), TC-05 (no residual localStorage/sessionStorage/cookie artifacts), TC-06 (console.log spy asserts exact `{ timestamp }` payload, no user id/email/token), TC-07 (double-invocation idempotency, no thrown errors), TC-08 (mocks `localStorage.removeItem` to throw via `clearAuthToken`, asserts `logout()` still completes and still logs the event) |
| T-03 | Integration test: in-flight-request race scenario                      | S          |     | T-01, T-02     | F-02  | Covers TC-09 (`AUTH-07-TC-09`, `Should` priority, `type: integration`): appends a new `describe` block to the same `userApi.logout.test.js` file created by T-02; mocks an API call with a 500ms delay via `userApi`'s axios `client`, calls `logout()` while it is in flight, asserts the token is cleared immediately (synchronous return), then asserts the delayed request's eventual 401 response is handled by AUTH-04's already-registered unauthorized handler (no new handler is added by this task — it asserts the existing AUTH-04 dedup-guarded interceptor path fires); documents condition #4/C-4 in the describe-block comment restating the race-condition acceptance from REQUIREMENTS.md § Constraints |
| T-04 | Performance micro-benchmark: `logout()` p95 latency                    | S          |     | T-01, T-02, T-03 | F-02  | Covers TC-10: appends a new `describe` block to the same `userApi.logout.test.js` file; calls `logout()` in a loop of 100+ iterations, re-seeding a fresh `auth_token` value into `localStorage` before each iteration (per TC-10's `given`), measures per-call latency via `performance.now()`, computes p95, asserts p95 < 10ms per condition #6/C-6 |
| T-05 | Docs: update `README.md` § 11 with the Logout behavior note            | S          | [P] | T-01           | F-03  | Per REQUIREMENTS.md § Documentation requirements — one-line note under CRUD Usage that Logout (Settings screen) clears the client-side session and redirects to Login, with no server-side call; disjoint from F-02, so mergeable independently once T-01 lands |

Predecessor DAG: T-01 has no in-plan predecessor (its cross-plan predecessor, AUTH-04's T-02, is
external to this PLAN's own DAG and is recorded in § 1/§ 6 instead of the Predecessors column,
matching AUTH-06's PLAN.md precedent for its own cross-plan `App.jsx` dependency). T-02, T-03, and
T-04 all append sequential `describe` blocks to the same F-02 test file, so each depends on the
prior task landing first to avoid a same-file write race (T-02 → T-03 → T-04, reflected directly
in their Predecessors cells). T-05 depends only on T-01 and touches the disjoint F-03 file, so it
is marked `[P]` — it can be dispatched in parallel with T-02 once T-01 has merged.

## 6. Carry-Forward Risks and Conditions

Risks from `docs/research/AUTH-07.md` § Risk register.

### Risks addressed by tasks

| Risk id | Severity | Addressed by |
|---------|----------|---------------|
| #1      | HIGH     | T-03          |
| #3      | HIGH     | T-04          |
| #4      | MED      | T-02 (TC-08 — relies on AUTH-04's existing try/catch in `clearAuthToken()`)  |
| #8      | LOW      | T-02 (TC-07)  |

### Risks accepted (carry-forward)

| Risk id | Severity | Rationale                                                                                                                                                                                                    |
|---------|----------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| #2      | HIGH     | accepted (documented in REQUIREMENTS.md § Constraints and § Non-functional requirements — Security; restated in condition #5/C-5 below) — the stateless-JWT mechanism means a logged-out token remains cryptographically valid until its 60-minute TTL naturally expires; no server-side revocation/blacklist exists in this story, consistent with AUTH-04's finalized architecture. Appropriate for this internal, non-regulated admin tool per CLAUDE.md § Target platforms. Revisit only if a future story requires immediate server-side denial (would need a refresh-token + blacklist redesign). |
| #5      | MED      | accepted (documented in § 1 dependency 2 above) — AUTH-06's `Settings.jsx` depends on this story's `logout()` export landing with the exact locked contract; both PLANs already lock the interface (name, no-arg signature, call order), so no code-level mitigation is needed beyond the sequencing note already recorded in both PLANs. |
| #6      | MED      | accepted (documented in REQUIREMENTS.md § Constraints — "Desktop web browsers only... `localStorage` availability is assumed, no mobile/legacy fallback required") — this is a desktop-only internal admin tool per CLAUDE.md § Target platforms; no fallback storage mechanism is implemented. |
| #7      | LOW      | accepted — `clearAuthToken()`'s contract is owned and already shipped by AUTH-04 (`docs/features/AUTH-04/PLAN.md` F-01/T-02, Plan validation: PASS); this story's tests (T-02) verify `logout()` calls it exactly once, providing regression coverage without re-implementing or re-testing AUTH-04's internals. |

### Conditions for GO (research_verdict GO-WITH-CONDITIONS)

| Cond | Condition (verbatim, abbreviated)                                                                                                          | Addressed by |
|------|--------------------------------------------------------------------------------------------------------------------------------------------------|---------------|
| C-1  | `logout()` function signature and location — synchronous, no-arg, exported from `userApi.js`, calls `clearAuthToken()` only, no backend call    | T-01          |
| C-2  | Logout callback registration in `App.jsx` — `registerUnauthorizedHandler(() => setIsAuthenticated(false))` on mount; no second callback mechanism | (already shipped by AUTH-04 F-02/T-03; restated in § 3 above — no new task, this story adds no `App.jsx` code) |
| C-3  | Settings screen logout button `onClick` handler — calls `userApi.logout()` then `props.onLogout()`, no loading state, no error handling          | (AUTH-06's file-table responsibility, `docs/features/AUTH-06/PLAN.md` F-02/T-02 — restated in § 1 dependency 2; no task in this PLAN, since this story owns only the `logout()` export, not the button) |
| C-4  | Race-condition acceptance — in-flight request during logout arrives without a valid header, gets 401, routed through the same unauthorized handler | T-03          |
| C-5  | Stateless-JWT-validity-after-logout tradeoff — cleared token remains valid until 60-minute TTL expires, accepted, no revocation implemented       | T-01 (inline code comment), risk #2 accepted-carry-forward row above |
| C-6  | Performance benchmark — `logout()` measured over 100+ iterations, p95 < 10ms                                                                     | T-04          |
| C-7  | `localStorage.removeItem` error handling — `clearAuthToken()` wraps removal in try/catch, logs console warning (no PII), proceeds                | T-02 (TC-08 — verifies the already-existing AUTH-04 behavior from `logout()`'s call site) |
| C-8  | Idempotency — calling `logout()` twice produces no errors, `removeItem` on absent key is a no-op, repeated state-flip calls are idempotent        | T-02 (TC-07)  |
| C-9  | Observability event shape — `{ timestamp }` only, no user id, no token value, mirrors AUTH-04's `auth_session_expired` precedent                  | T-01, T-02 (TC-06) |
| C-10 | `localStorage` key name — exactly `auth_token` (AUTH-04's key); tests verify this exact key is removed                                            | T-02 (TC-02)  |

### Cross-Feature Dependency Notes

- **AUTH-04** (`docs/features/AUTH-04/PLAN.md` F-01/T-02, Plan validation: PASS): supplies
  `clearAuthToken()`, the `auth_token` localStorage key, and the already-shipped
  `registerUnauthorizedHandler`/`App.jsx` state-flip wiring this story's `logout()` calls into and
  relies on. This story's T-01 must merge after AUTH-04's T-02. See § 1 sequencing dependency 1.
  No code changes required in AUTH-04 beyond what it already ships.
- **AUTH-06** (`docs/features/AUTH-06/PLAN.md` F-02/T-02, Plan validation: PASS): is a **hard
  runtime downstream consumer** of this story's `logout()` export — `Settings.jsx`'s Logout button
  calls `userApi.logout()` by the contract this PLAN's F-01/T-01 delivers. AUTH-06's PLAN.md
  already documents this dependency from its own side (its § 1 "Cross-plan sequencing dependency
  2") and requires no re-edit here; this PLAN's obligation is solely to ship `logout()` with the
  exact locked signature AUTH-06 already assumes. See § 1 sequencing dependency 2.
- **AUTH-05**: the Login-vs-protected-view conditional render that makes the post-logout redirect
  visible is entirely AUTH-05's already-shipped scope (`docs/features/AUTH-05/PLAN.md`); this story
  only ensures `isAuthenticated` flips to `false`, which AUTH-05's existing render switch already
  reacts to. No code changes required in AUTH-05.
- **AUTH-01** (`docs/features/AUTH-01/PLAN.md` F-02, `LoginForm.jsx`): validation of this story's
  TC-11 (keyboard-operable Logout + focus moves to Login's primary field after redirect) found no
  PLAN assigned an owner for the focus-management half. AUTH-01's `LoginForm.jsx` gained a small
  mount-time `.focus()` addition to close it (documented in AUTH-01's PLAN.md Addendum,
  2026-08-18); this story's new `App.logoutFocus.test.jsx` proves the end-to-end behavior since it
  spans both `Settings.jsx`'s Logout control and `LoginForm.jsx`'s focus target.

## 7. Test Strategy

| Layer                          | Test path                                                     | TCs covered                | Notes                                                                                                                              |
|----------------------------------|-------------------------------------------------------------------|-------------------------------|--------------------------------------------------------------------------------------------------------------------------------------|
| Integration                    | `frontend/src/services/__tests__/userApi.logout.test.js`           | TC-02, TC-03, TC-05           | Vitest; mocks `localStorage` and the axios `client` default headers directly, mirroring AUTH-04's `userApi.auth.test.js` mocking pattern; asserts `clearAuthToken()` called exactly once, zero HTTP requests dispatched, no residual `auth_token`/session artifacts |
| Security                       | `frontend/src/services/__tests__/userApi.logout.test.js`           | TC-06                         | `console.log` spy asserts the `auth:logout` event payload is exactly `{ timestamp }` — no user id, email, or token value present, per `.claude/rules/security-baseline.md` |
| Integration (edge-case)        | `frontend/src/services/__tests__/userApi.logout.test.js`           | TC-07, TC-08                  | TC-07: calls `logout()` twice synchronously, asserts no thrown error and a cleared end state. TC-08: mocks `localStorage.removeItem` to throw inside `clearAuthToken()`, asserts `logout()` still completes and still logs the event |
| Integration (declared `e2e`)   | `frontend/src/services/__tests__/userApi.logout.test.js`           | TC-01, TC-04                  | Declared `type: e2e` in `docs/test-cases/AUTH-07.json`, executed under the already-configured Vitest/jsdom runner — this repo has no browser-automation e2e runner (`docs/config/project-commands.yaml test_e2e: n/a`), matching the identical precedent AUTH-01/AUTH-04/AUTH-05/AUTH-06's PLANs applied to their own declared-`e2e` TCs. TC-01 (Settings-screen click-through) and TC-04 (post-logout protected-route redirect) are exercised as module-level assertions against `userApi.logout()`'s observable effects (token cleared, header unset, event logged) plus a mocked-`App`-state assertion that `isAuthenticated` flips via the already-tested AUTH-04 callback path — not a live browser click simulation, since the Settings button itself is AUTH-06's component under AUTH-06's own test file (`Settings.test.jsx` already covers the click-order assertion per AUTH-06-TC-04/TC-05) |
| Integration (race condition)   | `frontend/src/services/__tests__/userApi.logout.test.js`           | TC-09                         | Mocked 500ms-delayed API call in flight during `logout()`; asserts synchronous immediate clear plus eventual 401-driven unauthorized-handler firing, per condition C-4 |
| Performance                    | `frontend/src/services/__tests__/userApi.logout.test.js`           | TC-10                         | 100+ iteration benchmark using `performance.now()`; budget: p95 < 10ms, re-seeding `auth_token` before each iteration |
| Accessibility (declared `e2e`) | `frontend/src/pages/__tests__/Settings.test.jsx` (AUTH-06's file)   | TC-11                         | TC-11 (keyboard-operability + post-redirect focus move to Login's primary field) is authored and owned entirely by AUTH-06's already-existing test file — the Logout *control* (button markup, tab order, focus management after redirect) is AUTH-06's UI concern per REQUIREMENTS.md § Scope -> Out ("AUTH-06's Settings screen UI... AUTH-07 only defines the contract"). This story adds no new test file for TC-11; it is listed here for coverage-completeness only, matching `docs/test-cases/AUTH-07.json`'s declaration of the TC under this story's id. No `manual: true` flag is set because AUTH-06's existing suite already exercises it |

Every TC in `docs/test-cases/AUTH-07.json` (TC-01 through TC-11) appears in the table above; none
are flagged `manual: true`. TC-11 is the sole TC whose authoring/execution site is a sibling
feature's already-existing, already-PASS-validated test file (`AUTH-06`'s `Settings.test.jsx`) —
this is documented explicitly rather than silently omitted, because the control under test
(the Logout button) is that story's file-table responsibility, not this story's. No new test
runner is introduced: TC-01/TC-04 (`e2e`) execute under the already-configured Vitest/jsdom runner
per the rationale in their row above, consistent with AUTH-01/AUTH-04/AUTH-05/AUTH-06's PLAN
precedent for declared-but-runner-less TC types in this repo — no Playwright/k6 install or config
task is added because no new runner requirement is introduced beyond what those sibling stories
already established as this repo's convention. Coverage gate: frontend unit/integration coverage
follows the repo's existing threshold (no `harness.yaml` override present -> 80% default, per
`docs/config/project-commands.yaml`). Performance test (T-04/F-02) runs as part of the default
`npm run test` invocation (no `perf`-label gating is declared for this story, matching AUTH-04's
identical precedent for its own in-process DOM/logic micro-benchmark, as opposed to a sustained-load
test).

### Plan validation rounds

| Round | Verdict | Failing dimensions | Action                  |
|-------|---------|---------------------|--------------------------|
| 1     | PASS    | —                   | Continue to tracker push |

## Plan validation

- Date: 2026-08-17T22:15:00Z
- Verdict: PASS
- Wiring: PASS (no new production module is `create`d by this story — F-01 is a `modify` row
  adding a new named export to an already-wired file (`userApi.js` is the sole HTTP/auth-surface
  entry point per `CLAUDE.md`); F-02 is a test-file leaf per the wiring-dimension exception; F-03
  is a `modify` row against the already-wired root `README.md`. The one cross-story wiring concern
  — AUTH-06's `Settings.jsx` calling this story's new `logout()` export — is resolved explicitly by
  § 1 sequencing dependency 2 and § 6 Cross-Feature Dependency Notes, mirroring AUTH-06's own
  treatment of its `App.jsx`-after-AUTH-04/AUTH-05 wiring concern.)
- Docs: PASS (no T1/T2/T3/T4 rubric trigger fires automatically — no new runnable surface, no new
  HTTP route, no new env var, no new service dir/port. REQUIREMENTS.md § Documentation
  requirements explicitly names a README § 11 update as in-scope for this story regardless of
  rubric-trigger status; T-05/F-03 addresses it directly rather than deferring it as carry-forward.)
- Runner-setup: PASS (TC-01/TC-04 are `e2e`-typed and TC-10 is `performance`-typed in
  `docs/test-cases/AUTH-07.json`; neither requires a new runner — TC-01/TC-04 execute as
  module-level assertions under the already-configured Vitest/jsdom runner (no browser-automation
  tool needed; this repo declares `test_e2e: n/a` repo-wide per
  `docs/config/project-commands.yaml`), matching the identical precedent set by AUTH-01/AUTH-04/
  AUTH-05/AUTH-06's PLANs for their own declared-`e2e` TCs; TC-10 is addressed by a dedicated task,
  T-04, executed as an in-process `performance.now()` benchmark under the same already-configured
  Vitest runner, matching AUTH-04's T-06 precedent for its own declared-`performance` TC.)
- Cross-section: PASS (every TC-01..TC-11 in `docs/test-cases/AUTH-07.json` appears in § 7's
  table — TC-11 explicitly documented as authored/owned by AUTH-06's sibling test file rather than
  silently omitted; every file table row F-01..F-03 is referenced by at least one task's Files
  column in § 5 — F-01 by T-01, F-02 by T-02/T-03/T-04, F-03 by T-05; every task's Files column
  references only F-NN ids present in § 2; all 10 research conditions #1..#10/C-1..C-10 appear in
  § 6's Conditions for GO sub-section with non-empty Addressed-by cells; all HIGH/MED/LOW risk
  register entries (#1, #2, #3, #4, #5, #6, #7, #8) appear in either the Risks-addressed-by-tasks
  or Risks-accepted sub-table.)
- Config drift: PASS (no new runtime dependency, service directory, `docker-compose.yml` entry, or
  port is introduced by this story — F-01 adds a function using only already-installed
  `axios`/`localStorage`/`console` APIs; F-02 uses only already-installed Vitest tooling; F-03 is a
  documentation-only edit.)
- Rounds: 1
