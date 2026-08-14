# Code Review — USR-01 (c2ed94df...HEAD, standalone re-run)

- Date: 2026-08-14T21:15:00Z
- Mode: branch (story USR-01), standalone re-run of `/arh-review` requested directly by the user
- Base ref: `c2ed94df` (last commit before USR-01 work began) — chosen over `main`, which is
  stale (pinned at SRF-01's implementation commit and never advanced, so `main...HEAD` would
  also sweep in SRF-01's unrelated later validate/review/security-review commits).
- Target ref: `HEAD` (`3c071a9d`)
- Files reviewed (18 changed): `README.md`, `docs/activity/2026-08.jsonl`,
  `docs/features/USR-01/{EVIDENCE-ROUNDS.md,FLAGS.md,PLAN.md,REQUIREMENTS.md,REVIEW.md,
  VALIDATION-20260814-1900.md,VALIDATION-20260814-1940.md,evidence/*,state.json}`,
  `docs/requirements/RTM.md`, `docs/research/USR-01.md`, `docs/state/features.json`,
  `docs/stories/USR-01.md`, `docs/test-cases/USR-01.json`, `frontend/src/App.jsx`,
  `frontend/src/pages/Dashboard.jsx`, `frontend/src/pages/Users.jsx` (new),
  `frontend/src/pages/__tests__/{App.routing,Dashboard.search,Users.crud,Users.search}.test.jsx`
- Verdict: **PASS**

Note: this is an independent second-pass review, separate from `/arh-implement` Step 4's own
review (same report path, PASS, 0/0/0/1 with the same F-1 finding below). Findings here were
re-derived from the diff and context rather than copied from that report; the prior report is
referenced only where the same underlying issue was independently confirmed.

## Context loaded

- Rules active: reusability-baseline, surgical-changes, performance-baseline, context-economy,
  accessibility-baseline, security-baseline (path-scoped over the frontend diff)
- Patterns skill: react-patterns (fastapi-patterns loaded but not applicable — no backend files
  in this diff)
- Story id: USR-01
- PLAN.md: `docs/features/USR-01/PLAN.md` (4 mini-ADRs: ADR-1 Users.jsx extraction, ADR-2
  conditional-branch routing, ADR-3 client-derived Inactive stat, ADR-4 test-file split)
- REQUIREMENTS.md: `docs/features/USR-01/REQUIREMENTS.md`
- Research: `docs/research/USR-01.md` (risk register R-01..R-06)
- Validation: `docs/features/USR-01/VALIDATION-20260814-1940.md` (round 2, 25/25 PASS)

## File categorisation

| Category      | Files                                                                 | Count |
|----------------|------------------------------------------------------------------------|-------|
| Screens/pages  | `Users.jsx` (new), `Dashboard.jsx`, `App.jsx`                          | 3     |
| Tests          | `App.routing`, `Dashboard.search`, `Users.crud`, `Users.search` (`.test.jsx`) | 4 |
| Docs           | `README.md`, PLAN/REQUIREMENTS/REVIEW/VALIDATION/story/research/state docs | 11 |

## Six-dimension + scoped-category assessment

1. **Module structure & boundaries** — clean. `Users.jsx` owns all search/filter/pagination/CRUD
   state; `Dashboard.jsx` retains only `stats`/`loadingStats`/`toasts`. No cross-page state
   leakage, no new shared module needed.
2. **Design patterns** — matches `react-patterns`: pages own state and call `services/userApi.js`
   directly; components receive props/callbacks only; no direct `axios` import anywhere in the
   diff. One LOW finding below (F-1).
3. **Component/module architecture** — `App.jsx`'s new `"users"` branch mirrors the existing
   `"settings"` conditional idiom exactly (ADR-2); no router library introduced, matching the
   ADR's explicit rejection of that alternative.
4. **Integration points** — no backend/API changes in this diff; `Users.jsx` calls the same
   `getUsers`/`createUser`/`updateUser`/`deleteUser`/`getDashboardStats` functions with unchanged
   contracts. N/A for retry/timeout/idempotency (frontend-only story, backend frozen).
5. **Testability** — deterministic: fake timers for debounce, mocked `userApi.js` at the module
   boundary (no network in tests), no hidden globals besides the pre-existing
   `IS_REACT_ACT_ENVIRONMENT` flag pattern already used before this story. One LOW finding below
   (F-2, test-helper duplication).
6. **Safety & security** — no `eval`/`innerHTML`/`dangerouslySetInnerHTML`/`console.log` of PII
   introduced anywhere in the diff (grepped the full diff for the SAST pattern set); no new
   trust-boundary code (pure frontend page extraction, backend untouched). Clean.
7. **scope-creep** — none. Every changed file maps to PLAN.md's F-01..F-08 table or is expected
   harness bookkeeping (`state.json`, `docs/state/features.json`, `docs/activity/*.jsonl`,
   `docs/requirements/RTM.md`, `docs/test-cases/USR-01.json`, evidence logs, VALIDATION/FLAGS
   reports). No adjacent-code refactor, no unrelated formatting change.
8. **adr-violation** — none. Verified against all four PLAN.md ADRs:
   - ADR-1 (dedicated `Users.jsx`): confirmed byte-for-byte extraction (`diff` against the
     pre-story `Dashboard.jsx` shows only the expected additions — component rename, page
     title/eyebrow text, and the new Inactive stats card/derivation).
   - ADR-2 (conditional branch, no router): confirmed — `App.jsx` diff is exactly the two-line
     change described (remap deleted, new branch added), zero new dependencies.
   - ADR-3 (client-derived Inactive stat): confirmed — inline comment present verbatim with the
     stated caveat, formula matches `total_users - active_users`, and a dedicated test
     (`Users.crud.test.jsx`, 8 total/5 active → 3 inactive) verifies it.
   - ADR-4 (test-file split): confirmed — `Dashboard.search.test.jsx` survives at its original
     path (not deleted) with new TC-21/TC-22 assertions against remaining overview behavior only;
     the three original debounce/clear/aria-label assertions are relocated verbatim into
     `Users.search.test.jsx`. Independently confirmed the `Regular Users`/`Inactive Users` stats
     card change is intentional per REQUIREMENTS.md FR-2 (four cards: Total/Active/Inactive/
     Admin on `Users.jsx`; Dashboard keeps its original Total/Active/Admins/Regular Users set),
     not a silent drop.

## Findings summary

| Severity | Count | Category distribution                    |
|----------|-------|-------------------------------------------|
| CRITICAL |   0   | —                                           |
| HIGH     |   0   | —                                           |
| MEDIUM   |   0   | —                                           |
| LOW      |   2   | design-patterns (1), testability (1)       |

Scope-creep findings: 0
ADR-violation findings: 0

## Detailed findings

### LOW

#### F-1 — design-patterns: `onUserCountChange` source changed silently from `getUsers().total` to `getDashboardStats().total_users`
- Category: design-patterns
- Path: `frontend/src/pages/Dashboard.jsx:30` (compare `frontend/src/pages/Users.jsx:70`)
- Source: PLAN.md § Module Hierarchy ("`Dashboard.jsx` ... calls: `getDashboardStats` only
  (search/filter/CRUD calls removed)") — the knock-on effect on `onUserCountChange`'s data
  source is not called out anywhere in PLAN.md or the ADRs.
- Description: Pre-extraction, `Dashboard.jsx` updated the sidebar's user count from
  `getUsers().total`. Post-trim it now sources the same callback from
  `getDashboardStats().total_users` instead, since `getUsers` was removed from `Dashboard.jsx`
  entirely. The two values were always equal on the (unfiltered-by-default) Dashboard view, so
  there is no behavior regression, but the substitution is not documented as a deliberate
  decision.
- Suggested fix: No code change needed. Add a one-line note to PLAN.md § State and Data
  Management (or the PR body) documenting the new data source for `onUserCountChange` on the
  trimmed Dashboard, so a future reader doesn't mistake it for an accidental side effect.

#### F-2 — testability: `setInputValue` DOM-value-setter helper duplicated verbatim across two new test files
- Category: testability
- Path: `frontend/src/pages/__tests__/Users.search.test.jsx:22-29`,
  `frontend/src/pages/__tests__/Users.crud.test.jsx:18-24`
- Source: `.claude/rules/reusability-baseline.md` ("DRY across modules of the same concern...
  Extract on the third repetition, not the first.")
- Description: Both new test files (introduced together by this same task, T-05/T-06) define an
  identical 6-line `setInputValue(input, value)` helper (native-setter + dispatched `input`
  event) rather than sharing one. This is the second live copy (the original single copy in
  `Dashboard.search.test.jsx` was removed by T-04's adaptation), so per the rule's own
  "third repetition" threshold this is not yet a violation, but a third occurrence in a future
  test file would cross it, and both copies here were written in the same change so extracting
  now would have cost nothing.
- Suggested fix: Extract `setInputValue` (and `Users.search.test.jsx`'s analogous
  `setSelectValue`) into a small shared test utility (e.g.
  `frontend/src/pages/__tests__/testUtils.js`) imported by both files, the next time either file
  is touched. Not blocking.

## What went well

- `Users.jsx` (F-01) is a verified byte-for-byte-faithful extraction of the pre-story
  `Dashboard.jsx`: diffing the two files directly shows only the expected deltas (component
  name, page title/eyebrow copy, and the new Inactive stats card + derivation) — no dropped
  state, effect, or handler.
- `Dashboard.jsx` (F-04/T-02) trim leaves no dead code: `useRef`, `UserTable`, `Modal`,
  `UserForm`, `UserDetails`, `DeleteConfirmation`, and the `getUsers`/`createUser`/`updateUser`/
  `deleteUser` imports are all removed along with the state/effects/handlers that used them.
- `App.jsx` (F-05/T-03) diff is exactly the minimal two-line change PLAN.md predicted, with zero
  new dependencies (ADR-2 honored).
- ADR-3's Inactive-stat derivation carries the required inline comment and caveat, and is
  covered by a dedicated arithmetic test.
- ADR-4's test-file split was verified directly against the diff: zero net coverage loss, no
  file deleted, `Dashboard.search.test.jsx` survives at its original path.
- No component reaches into `axios` directly anywhere in the diff — all data flows through
  `services/userApi.js`.
- Full SAST-pattern grep (`eval`, `innerHTML`, `dangerouslySetInnerHTML`, `console.log` of PII,
  etc.) over the diff returned zero hits.
- File-level scope discipline: every touched file traces to a PLAN.md F-01..F-08 row or expected
  harness bookkeeping — no adjacent-code refactors, no unrelated formatting changes.

## Recommendation

**PASS.** No critical, high, or medium findings; two low-severity, non-blocking notes (one
documentation gap, one test-helper duplication below the DRY rule's own repetition threshold).
Proceed to `/arh-security-review` or address the two LOW notes as convenient follow-up.
