# Code Review — HEAD (base 58e7b5fc)

- Date: 2026-08-14T17:30:00Z
- Mode: story (SRF-01)
- Files reviewed: 14 (diff `58e7b5fc...HEAD`) + 5 untracked artefact files
- Verdict: PASS

## Executive summary

SRF-01 is a brownfield backfill story. The diff range requested by the orchestrator
(`58e7b5fc...HEAD`) spans three commits: the pre-existing pagination/test-infra hardening work
(`5daea896`, `655efaae`) that research/REQUIREMENTS.md explicitly document as an already-decided,
now-frozen baseline (`docs/adr/0003-users-list-pagination.md`), plus the harness docs commit
(`712cc9e0`) that authored PLAN.md/REQUIREMENTS.md/research on top of it, plus the current
working-tree changes that close out the one PLAN task this story actually scopes: T-01 (a new
Vitest spec, `frontend/src/pages/__tests__/Dashboard.search.test.jsx`) and T-02 (a verify-only
backend regression re-run, no edits). Cross-checking PLAN.md § File and Module Plan, REQUIREMENTS.md
§ Constraints/Scope, and the actual diff confirms the pagination/backend edits are prior, declared-frozen
work, not new scope introduced by this PLAN — so they are reviewed for correctness against ADR-0003 but
not flagged as scope-creep against T-01/T-02's file list.

The backend pagination implementation (`api/users.py`, `services/user_service.py`,
`repositories/user_repository.py`, `schemas/user.py`) correctly follows the `api → service →
repository → models` layering, matches ADR-0003's decision (envelope response, `_filtered_query`
shared-query seam avoiding duplicated filter logic between `get_all`/`count_filtered`, `limit`/`offset`
bounded by `page_size` `ge=1, le=100`), and satisfies `performance-baseline.md`'s pagination
requirement. The frontend pagination UI and the new debounce test both follow `react-patterns`
(service-boundary mocking, no direct Axios calls, local `useState`, no client-side cache). No
architecture, ADR, or scope violations found.

🟢 strengths: clean layering, ADR-0003 correctly implemented end-to-end, new test mocks at the
service boundary per convention, shared `_filtered_query` avoids duplicating filter logic (DRY).
⚠️ warnings: one minor double-effect-fire nit in `Dashboard.jsx`'s page-reset wiring (non-blocking).
🛑 blockers: none.

## Findings summary

| Severity | Count | Category distribution                                   |
|----------|-------|-----------------------------------------------------------|
| CRITICAL |   0   | —                                                           |
| HIGH     |   0   | —                                                           |
| MEDIUM   |   0   | —                                                           |
| LOW      |   2   | component-architecture (1), testability (1)                |

Scope-creep findings: 0. ADR-violation findings: 0.

## Detailed findings

### LOW

#### F-1 — component-architecture: redundant effect re-fire on filter change
- Category: component-architecture
- Path: `frontend/src/pages/Dashboard.jsx:97-101` (page-reset effect) and `:104-114` (debounce effect)
- Source: `.claude/skills/react-patterns/SKILL.md` § Idioms ("derived values computed inline, not duplicated into state")
- Description: Changing `search`/`roleFilter`/`statusFilter` triggers the page-reset effect (`setPage(1)`), which — when `page` was already `> 1` — causes a second render and re-fires the debounce effect a second time (harmless because `debounceRef` clears the prior timeout, but it is an avoidable extra effect invocation).
- Suggested fix: Fold the page reset into the same effect that fires the debounced fetch (compute the effective page inline as `search/roleFilter/statusFilter changed ? 1 : page`) rather than using a second `useState`-driven effect, or accept as a documented, harmless double-fire. Not blocking — no incorrect behavior observed.

#### F-2 — testability: new spec does not assert page-reset-to-1 behavior
- Category: testability
- Path: `frontend/src/pages/__tests__/Dashboard.search.test.jsx:76-102`
- Source: PLAN.md § 7 Test Strategy (TC-01/TC-02/TC-09 scope) — not a gap in what was promised, but a gap relative to the newly-added `page` dependency touched by this same diff.
- Description: The new test file (T-01) covers debounce timing and the static aria-label, per its narrow PLAN scope. It does not cover the interaction between search-changes and the `page` state (i.e., that typing a new search term while on page 2 resets to page 1), even though that wiring lives in the same component and was touched by the (frozen, pre-existing) pagination commit this diff also contains.
- Suggested fix: Not blocking for this PRD (out of T-01's declared scope per PLAN.md), but worth a follow-up test case in a future SRF story given SRF-02/03/04 will extend the same filter-reset wiring.

## What went well

- ADR-0003 is implemented faithfully: response envelope (`items`/`total`/`page`/`page_size`), bounded `page_size` (`ge=1, le=100`), and the `_filtered_query` seam shared between `get_all()` and the new `count_filtered()` avoid duplicating filter-building logic (DRY per `reusability-baseline.md`).
- Backend layering intact throughout: router stays thin (`api/users.py` only parses/delegates), business orchestration (offset math, envelope assembly) lives in `UserService`, all SQLAlchemy query logic stays in `UserRepository`.
- Frontend test (T-01) mocks at the `services/userApi.js` boundary, not Axios directly, per `react-patterns` convention; uses the existing Vitest/jsdom runner with no new dependency.
- Test-infra import-shadowing fix (`from app.models import user` replacing `import app.models.user`) is a minimal, correct, single-line surgical fix with no unrelated changes.
- PLAN.md, REQUIREMENTS.md, and research/SRF-01.md are internally consistent about what is frozen vs. newly delivered, making this review's scope determination straightforward and auditable.

## Recommendation

PASS. No critical/high/medium findings; the two low-severity notes are non-blocking style/coverage
observations for future stories (SRF-02/03/04 share this same filter/pagination seam). Proceed to
`/arh-security-review` — flag TC-08 (search endpoint has no authentication) for that pass, since it
is a documented, accepted, pre-existing gap in REQUIREMENTS.md § Non-functional requirements rather
than something introduced by this diff.

---

# Amendment — Code Review — SRF-01-FR-2 (Dashboard "User Overview" enhancement)

- Date: 2026-08-14T18:30:00Z
- Mode: story (SRF-01), diff range `9d433978...HEAD` (base_ref pinned per orchestrator — `main`
  is stale and was not advanced)
- Files reviewed: 9 (`docs/stories/SRF-01.md`, `docs/features/SRF-01/REQUIREMENTS.md`,
  `docs/test-cases/SRF-01.json`, `docs/features/SRF-01/PLAN.md`, `frontend/src/components/StatsCard.jsx`,
  `frontend/src/pages/Dashboard.jsx`, `frontend/src/pages/__tests__/Dashboard.search.test.jsx`,
  `frontend/src/styles/index.css`, `docs/activity/2026-08.jsonl`)
- Verdict: PASS

> This amendment section covers only the SRF-01-FR-2 amendment (a Dashboard layout enhancement
> added to the already-security-reviewed SRF-01 story, per explicit user instruction, after
> `feature/USR-01` was merged into `feature/SRF-01`). It is appended rather than overwriting the
> section above, consistent with how `PLAN.md`/`REQUIREMENTS.md` used dated `§§ Na` amendment
> sections instead of full rewrites for this same amendment.

## Executive summary

The amendment wraps the existing four Dashboard `StatsCard`s plus a new fifth ("Inactive Users",
derived client-side as `total_users - active_users`) inside a bordered `.panel`-style "User
Overview" section. It adds one additive `neutral` color entry to `StatsCard.jsx`'s `COLOR_MAP`,
widens `.stats-grid`'s base rule to `repeat(auto-fit, minmax(160px, 1fr))` to reflow five cards
cleanly, and extends the existing `Dashboard.search.test.jsx` spec with four new tests
(SRF-01-TC-10..13). The diff matches PLAN.md §2a's file table (F-03..F-06) exactly — no edits to
`Users.jsx`, `userApi.js`, or any backend file, honoring REQUIREMENTS.md § Scope (Out) for FR-2 and
`.claude/rules/surgical-changes.md`. The `Inactive Users` derivation correctly matches
REQUIREMENTS.md FR-2 item 2, is documented inline, and is additionally guarded with
`Math.max(0, ...)` (a defensive improvement beyond the literal requirement wording, not a
deviation from it). The new `<section aria-labelledby="user-overview-heading">` with an `<h2
id="user-overview-heading">` satisfies `.claude/rules/accessibility-baseline.md`'s "accessible
name via `aria-labelledby`" and "semantic heading" expectations. One MEDIUM finding: PLAN.md T-04
and REQUIREMENTS.md FR-2 item 5 both assert the shared `.stats-grid` CSS change was "manually
verified" against `Users.jsx`'s existing 4-card usage, but no evidence artifact (screenshot, visual
diff, or an assertion capable of exercising real CSS grid layout) exists for that claim anywhere in
`docs/features/SRF-01/evidence/` — unlike this same story's own honest deferral pattern for
TC-07/TC-15, which are explicitly carried forward as unverified rather than asserted as complete.

🟢 strengths: file-plan-exact diff (no scope creep), additive-only `COLOR_MAP` change, correctly
documented and defensively-guarded derivation, accessible section markup, no ADR contradictions.
⚠️ warnings: one MEDIUM finding — an unevidenced "manually verified" claim for a shared-class CSS
change (T-04).
🛑 blockers: none.

## Findings summary

| Severity | Count | Category distribution                                   |
|----------|-------|-----------------------------------------------------------|
| CRITICAL |   0   | —                                                           |
| HIGH     |   0   | —                                                           |
| MEDIUM   |   1   | testability (1)                                             |
| LOW      |   1   | adr-violation (1, non-blocking judgment note)               |

Scope-creep findings: 0. ADR-violation findings: 0 (the one LOW item below is a judgment note on
the "no mini-ADR" call, not a contradiction of an existing ADR/mini-ADR).

## Detailed findings

### MEDIUM

#### F-1 — testability: unevidenced "manually verified" claim for a shared-class CSS change
- Category: testability
- Path: `frontend/src/styles/index.css:382` (`.stats-grid` base rule); claim recorded at
  `docs/features/SRF-01/PLAN.md` T-04 and `docs/features/SRF-01/REQUIREMENTS.md` FR-2 item 5
- Source: PLAN.md task T-04 ("Must visually verify `Users.jsx`'s existing 4-card grid still
  renders correctly (shared class)") and REQUIREMENTS.md FR-2 item 5 ("verified to still render
  correctly (task T-04)")
- Description: `.stats-grid`'s `grid-template-columns` changed from a fixed `repeat(4, 1fr)` to
  `repeat(auto-fit, minmax(160px, 1fr))`, a rule shared with `Users.jsx`'s existing 4-card stats
  grid (confirmed via `grep` — `Users.jsx:201` uses the same `.stats-grid` class). Both PLAN.md and
  REQUIREMENTS.md assert this was "verified," but `docs/features/SRF-01/evidence/` contains no
  screenshot, visual-diff, or Playwright/browser-based assertion of the rendered layout — jsdom
  (the only test runner exercised, per `Users.crud.test.jsx:99` and `Dashboard.search.test.jsx`)
  does not evaluate CSS grid layout, so no existing automated test can substantiate the claim. This
  is inconsistent with the same story's own honest-deferral pattern used for TC-07 (perf) and
  TC-15 (responsive reflow), both of which are explicitly disclosed as deferred/carried-forward
  rather than asserted as verified.
- Suggested fix: Either (a) capture a screenshot or short manual-QA note as evidence under
  `docs/features/SRF-01/evidence/` substantiating the T-04 claim, or (b) soften PLAN.md/
  REQUIREMENTS.md's wording to "expected safe based on `auto-fit`'s backward-compatible reflow
  behavior for exactly-4-item grids; not verified in a real browser" and fold it into the existing
  TC-15 deferral rather than asserting completion. Non-blocking: `auto-fit` is a well-understood,
  low-risk CSS change for a 4-card grid (it will still render 4 equal columns at typical desktop
  widths), so the residual regression risk is low — but the paperwork should match reality.

### LOW

#### F-2 — adr-violation (judgment note): shared-seam CSS change relies on "no mini-ADR" call
- Category: adr-violation
- Path: `docs/features/SRF-01/PLAN.md:37-47` (§ 1a)
- Source: `plan-authoring` § Architecture decisions rubric ("if three readers would each pick a
  different solution... write the ADR")
- Description: PLAN.md §1a declines a mini-ADR for the whole FR-2 amendment, including the
  `.stats-grid` change that has a disclosed "blast radius" beyond `Dashboard.jsx` (it also affects
  `Users.jsx`'s existing 4-card grid, per PLAN.md §2a "Shared-class risk"). This is not a
  contradiction of any existing ADR or mini-ADR (no `adr-violation` in the strict sense — nothing
  in `docs/adr/` addresses `.stats-grid`), so it is recorded as a LOW judgment note rather than a
  blocking finding. The rest of the amendment (component reuse, `neutral` color token, `.panel`
  container) clears the "obviously reversible, one clear existing precedent" bar cleanly; the CSS
  grid change is a slightly closer call only because of its cross-consumer blast radius, not
  because of solution ambiguity (auto-fit/minmax is the standard idiom here — three readers would
  likely converge on it).
- Suggested fix: No action required to unblock. If a future story extends `.stats-grid` again,
  consider promoting the "shared class, verify all consumers" note into a short-form mini-ADR so
  the precedent is easy to find without re-deriving it from PLAN.md prose.

## What went well

- Diff matches PLAN.md §2a's file table (F-03..F-06) exactly: `Dashboard.jsx`, `StatsCard.jsx`,
  `index.css`, `Dashboard.search.test.jsx` — no edits to `Users.jsx`, `userApi.js`, or any backend
  file, per REQUIREMENTS.md § Scope (Out) for FR-2 and `.claude/rules/surgical-changes.md`.
- `StatsCard.jsx`'s `COLOR_MAP` change is purely additive — `accent`/`success`/`violet`/`warning`
  entries are byte-for-byte untouched; only one new `neutral` key was added.
- `Inactive Users` derivation (`Math.max(0, (stats.total_users ?? 0) - (stats.active_users ?? 0))`)
  matches REQUIREMENTS.md FR-2 item 2's formula, carries the required inline comment documenting
  the "only two status values" assumption, and adds a defensive `Math.max(0, ...)` floor beyond
  the literal requirement text.
- The new "User Overview" `<section>` is accessible per `.claude/rules/accessibility-baseline.md`:
  semantic `<h2>` heading, `aria-labelledby` wiring the section to that heading, and no new
  focusable/interactive elements introduced (stat cards remain non-interactive, so no new
  keyboard-reachability or focus-state surface was added).
- New tests (SRF-01-TC-10..13) target the actual rendered DOM structure (`.stat-card`,
  `.stat-card__value`, `section[aria-labelledby="user-overview-heading"]`) that
  `StatsCard.jsx`/`Dashboard.jsx` actually render, and TC-13 explicitly guards against scope creep
  by asserting no CRUD/user-list service functions are newly invoked.

## Recommendation

PASS. One MEDIUM (unevidenced verification claim for a shared CSS class — low actual regression
risk, but PLAN.md/REQUIREMENTS.md should not assert "verified" without an artifact) and one LOW
(judgment note on the no-mini-ADR call for the CSS change's blast radius) are both non-blocking.
Proceed to `/arh-security-review`; carry forward the F-1 evidence gap as a documentation
follow-up rather than a re-implementation task.
