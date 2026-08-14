# Feature: USR-01 — Dedicated Users Management Page

## Problem

Today, clicking the "Users" nav item in the sidebar just re-renders the Dashboard
(`frontend/src/App.jsx:43` remaps `activeView === "users"` back onto `"dashboard"`) — there is
no dedicated Users page. All search/filter/pagination/CRUD tooling from SRF-01 lives inside the
monolithic `Dashboard.jsx` (`frontend/src/pages/Dashboard.jsx:20-375`), which is meant to be an
overview, not the primary management surface. Admins have no page that is purpose-built for
managing the full user roster, and the Dashboard is overloaded with CRUD logic it wasn't
designed to own long-term.

## Outcome

An Admin clicking "Users" in the sidebar lands on a new, dedicated Users page (with the "Users"
nav item correctly highlighted) that reuses SRF-01's proven search/filter/pagination/CRUD
behavior verbatim — no regressions, no behavior drift. The Dashboard continues to render as a
lighter overview. The pre-existing `Dashboard.search.test.jsx` coverage is preserved (relocated
or adapted, never deleted), so the search/debounce/filter/pagination contract stays
regression-protected across the extraction.

## Constraints

- No backend changes. `GET /api/users` (pagination, search, role/status filters) and `GET
  /api/dashboard/stats` (`total_users`, `active_users`, `admin_users`, `regular_users`) are
  frozen as-is; no `inactive_users` field is added to the backend or schema.
- No new routing library. `App.jsx`'s existing ternary/conditional `activeView` state machine
  (`frontend/src/App.jsx:36, 43, 50-53`) is extended with a third branch, following the same
  pattern already used for `"settings"` → `SettingsPlaceholder`.
- All existing shared components (`Header`, `StatsCard`, `UserTable`, `Modal`, `UserForm`,
  `UserDetails`, `DeleteConfirmation`, `Notification`) are reused as-is by both `Dashboard.jsx`
  and the new `Users.jsx` — not duplicated or forked.
- `frontend/src/services/userApi.js` is the sole HTTP boundary; no new API client functions are
  needed and no component may call Axios directly.
- `Dashboard.search.test.jsx` must not be deleted; its search/debounce/filter/pagination
  coverage must be preserved at parity in the post-extraction test suite (per story AC#16 and
  research risk #1).
- Upstream dependency SRF-01 is already implemented, merged, and security-reviewed
  (`docs/state/features.json` SRF-01: `phase: security-reviewed`, `gate: APPROVE`) — this story
  extracts and relocates that logic, it does not modify SRF-01's contracts.

## Solution sketch

Extract the search/filter/pagination/CRUD state, effects, and handlers currently living in
`Dashboard.jsx` into a new `frontend/src/pages/Users.jsx` page component, reusing all existing
presentational components unchanged. Wire a real third branch in `App.jsx`'s `activeView`
conditional so the "Users" nav item renders `Users.jsx` instead of remapping onto `Dashboard`.
Dashboard is simplified to retain only the overview responsibilities that remain after
extraction. The pre-existing `Dashboard.search.test.jsx` suite is migrated (adapted or
relocated) onto the new page so no test coverage is lost in the move.

## Scope

- In: New `frontend/src/pages/Users.jsx` page — page header with "+ Add User", four stats cards
  (Total/Active/Inactive/Admin, with Inactive computed client-side as `total_users -
  active_users`), `UserTable` with existing column set, debounced search (300ms), Role/Status
  filters that reset to page 1, pagination (`PAGE_SIZE = 50`, Previous/Next), and full CRUD
  (view/add/edit/delete) with toast/inline-error conventions.
- In: `App.jsx` routing change — replace the `"users"` → `"dashboard"` remap with a real
  conditional branch rendering `Users.jsx`.
- In: Migrating `Dashboard.search.test.jsx` coverage (adapt in place, relocate to a
  `Users`-scoped test file, or both) so no search/debounce/filter/pagination assertions are
  lost, per AC#16.
- In: Documenting (code comment) and verifying (test) the `inactive = total - active` derivation.
- Out: Any backend/schema/repository change (no `inactive_users` field, no new endpoints).
- Out: Introducing a routing library (React Router or similar) — the existing conditional
  `activeView` pattern is retained.
- Out: Changing SRF-01's search/filter/pagination semantics (case-insensitivity, debounce
  timing, page size) — reused verbatim, not altered.
- Out: Adding authentication/authorization — unchanged from current (unauthenticated) behavior.

## Functional requirements

FRs trace 1:1 to story ACs; see `docs/stories/USR-01.md` for canonical wording.
New impl constraints introduced below (when any):

**USR-01-FR-1** — Dedicated Users page shell, routing, and read-only surfaces *(extends AC #1, #2, #4, #7, #12, #13, #14, #15 with: the concrete App.jsx routing mechanism, and the loading/empty/no-results/error state contract carried over unchanged from Dashboard.jsx)*

`App.jsx`'s `activeView === "users" ? "dashboard" : activeView` remap (`App.jsx:43`) is replaced
with a genuine conditional branch rendering `Users.jsx`, mirroring the existing `"settings"` →
`SettingsPlaceholder` branch (`App.jsx:50-53`) — no router library. `Users.jsx` renders: a page
header (reusing `Header`) with a "+ Add User" button; `UserTable` with columns ID, Name, Email,
Phone, Role, Status, Created, Actions; a view-detail flow via `UserDetails` backed by `GET
/api/users/{id}`; `loadingStats`/`loadingUsers` skeleton states on initial render (mirroring
Dashboard's existing pattern); `UserTable`'s existing `hasActiveFilters`-driven empty vs.
no-results states; and an inline error banner for list-fetch failures plus a non-blocking toast
for stats-fetch failures (mirroring `Dashboard.jsx:83-86`, `:182-192`) — never a raw stack trace.

**USR-01-FR-2** — Client-derived Inactive stat, documented and verified *(extends AC #3 with: an explicit code comment and a dedicated verification test for the `total - active` derivation, per research risk #2)*

The Inactive stats card value is computed as `total_users - active_users` from the existing `GET
/api/dashboard/stats` response (no new backend field). The computation carries an inline code
comment in `Users.jsx` stating the derivation and its assumption (`inactive_users` does not
exist as a first-class backend field; if archived/other statuses are introduced later, this
formula must be revisited). A test verifies the arithmetic against a known dataset (e.g. 5
active, 3 inactive, 8 total).

**USR-01-FR-3** — Search/filter/pagination parity, extracted unchanged *(extends AC #5, #6, #11 with: exact behavioral parity to the Dashboard.jsx implementation being replaced)*

The 300ms-typing / 0ms-clear debounce (`Dashboard.jsx:104-111`), the filter-change-resets-page-1
effect (`Dashboard.jsx:98-101`), and the `PAGE_SIZE = 50` Previous/Next pagination contract
(`Dashboard.jsx:32`) are relocated to `Users.jsx` byte-for-byte in behavior (not just
approximately) — any deviation (different debounce ms, different page size, filters not
resetting to page 1) is a regression, not an enhancement.

**USR-01-FR-4** — CRUD mutation flows reused verbatim *(extends AC #8, #9, #10 with: the exact success/failure UX contract — `refreshAll()`-style refresh, toast on success, inline non-stack-trace error on failure — carried over from Dashboard.jsx to Users.jsx)*

Add/Edit/Delete on the Users page follow the same contract as `Dashboard.jsx`: on success, the
relevant modal closes, a success toast fires, and both the user list and stats cards refresh
(mirroring `refreshAll()`, `Dashboard.jsx:113-115`); on failure (e.g. 409 duplicate email on
add/edit, or a failed delete), a readable error is shown inline in the form or dialog — never a
raw stack trace, never a silent failure — and the modal/dialog does not close.

**USR-01-FR-5** — Test coverage relocation, not deletion *(extends AC #16 with: the concrete migration obligation flagged as research risk #1)*

`frontend/src/pages/__tests__/Dashboard.search.test.jsx` is not deleted. Its
search/debounce/filter/pagination assertions are migrated to be at parity (not less coverage)
with a new Users-page-scoped suite (e.g. `Users.test.jsx`), either by adapting the existing file
to target `Users.jsx` or by writing new tests that replicate every existing test case, while
Dashboard retains its own test coverage for whatever overview behavior remains in it. The
migration is verified by running the full frontend suite and confirming no test case from the
original file was silently dropped.

## Non-functional requirements

- Performance: Per `.claude/rules/performance-baseline.md`: the Users page list call stays on
  the existing paginated contract (`page`, `pageSize`, default `PAGE_SIZE = 50`) — no unbounded
  fetch of the full user set. Search input stays debounced at exactly 300ms
  (`Dashboard.jsx:104-111`) to bound request rate while typing (at most one `getUsers` call per
  300ms of continuous typing).
- Security: Per `.claude/rules/security-baseline.md`: applies to the new Users page and its
  toolbar/pagination surfaces. No new PII fields are introduced beyond what Dashboard already
  displays (name/email/phone/role/status). All requests continue to route exclusively through
  `frontend/src/services/userApi.js` — no direct Axios calls from `Users.jsx` or any new
  component. Server-side validation and 409-on-duplicate-email are unchanged (reused, not
  reimplemented).
- Accessibility: Per `.claude/rules/accessibility-baseline.md`: applies to all new UI surfaces
  in this story (Users page container, search input, Role/Status filter selects, pagination
  controls, and any newly-extracted toolbar/header wrapper). Reused components (`UserTable`,
  `Modal`, `UserForm`, `UserDetails`, `DeleteConfirmation`) keep their existing accessibility
  affordances (labels, `aria-label`s, live regions) unweakened through the relocation.
- Observability: Errors surface via the existing toast/inline-banner conventions
  (`Dashboard.jsx:83-86`, `:182-192`); no new logging or metrics requirements beyond what
  `userApi.js` already provides.
- Testability: Frontend Vitest coverage for `Users.jsx` must reach parity with (not less than)
  the pre-existing `Dashboard.search.test.jsx` coverage of search/debounce/filter/pagination
  behavior (tracked as USR-01-FR-5), plus new coverage for the Inactive-stat derivation
  (USR-01-FR-2).

## Visual spec

Not applicable — `integrations.design = none`. Backend / API / data feature.

## Rollout plan

- **Strategy**: bang-bang — this is a purely additive frontend page extraction with a
  three-line routing change; both the old and new code paths reuse the exact same, already
  security-reviewed backend contracts, so there is no meaningful blast radius to stage.
- **Feature flag**: none — the `"users"` nav item already exists and currently resolves to
  Dashboard; shipping this story simply changes what it resolves to. No flag needed to gate a
  conditional render branch this small.
- **Backout plan**: revert the `App.jsx` conditional-branch commit (restoring the `"users" ?
  "dashboard" : activeView` remap) and/or revert the `Users.jsx` addition — no backend or data
  migration is involved, so backout is a pure code revert.
- **Success signal**: `npm run test` in `frontend/` passes with the new/migrated Users-page
  suite included and zero regressions in the relocated `Dashboard.search.test.jsx` coverage;
  manual click-through confirms the "Users" nav item renders the new page (not Dashboard) with
  correct active-state highlighting.

## Documentation requirements

- **README updates**: `README.md` §4 (Project Structure) and §11 (CRUD Usage) — add
  `frontend/src/pages/Users.jsx` to the structure listing and note that CRUD/search/filter/
  pagination now live on the dedicated Users page (accessed via the "Users" sidebar item) while
  Dashboard remains an overview.
- **Runbook**: none.
- **API reference**: none — no API contract change; existing Swagger UI at `/docs` is unaffected.
- **Inline code comments**: required on the Inactive-stat computation in `Users.jsx` (per
  USR-01-FR-2), explaining the `total - active` derivation and its assumption.
- **Examples / how-to**: none.

## Open questions

None. Story validated at 100/100 with zero `[NEEDS CLARIFICATION]` markers and an empty
Clarifications section; both implementation-detail ambiguities identified during story drafting
(Inactive-stat source, App.jsx routing scope) were resolved in `docs/stories/USR-01.md` §
Decision log. Research verdict is a plain GO (89/100, `## Conditions for GO`: None) — no
`## Addressing Research Conditions` section is required.

Decisions logged in `docs/stories/USR-01.md` § Decision log.

## Approvals

- 2026-08-14 — Product Owner (yaswanth.panthangi@apexon.com): **Approve** — Product Gate passed.
  All automated checks green (no-placeholder, ≤3 clarifications, coverage audit uncovered=[],
  every test case traces to a real FR/NFR id). No design review required
  (`integrations.design = none`).
