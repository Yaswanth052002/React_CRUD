# Code Review — feature/AUTH-01 (vs 58fe64c0)

- Date: 2026-08-18T15:10:00Z
- Mode: branch (working tree vs parent commit 58fe64c0; nothing committed yet on this branch)
- Files reviewed: 12 (8 modified + 4 untracked source/test files reviewed in depth; VALIDATION/evidence/state artefacts read for cross-checks)
- Verdict: **PASS WITH WARNINGS**

## Context loaded

```
Context loaded.
  Rules active:    5  (surgical-changes, security-baseline, accessibility-baseline, performance-baseline, reusability-baseline)
  Patterns active: 2  (react-patterns, fastapi-patterns — fastapi not touched by this diff)
  Story id:        AUTH-01
  PRD/Plan:        docs/features/AUTH-01/REQUIREMENTS.md, docs/features/AUTH-01/PLAN.md
  PR body:         n/a (no PR opened yet — reviewing working tree directly)
```

## File categorisation

| Category    | Files | Concerns applied |
|-------------|-------|-------------------|
| Components  | `LoginForm.jsx`, `LoginScreen.jsx` | composition, props contract, a11y |
| Services    | `userAuthService.js` (new), `userApi.js` (+`setAuthToken`) | boundary correctness, contracts |
| Tests       | `LoginForm.test.jsx`, `LoginScreen.test.jsx`, `test-setup.js` | behaviour-named, no tautologies |
| Config      | `vite.config.js`, `package.json`, `project-commands.yaml` | minimal-necessary, no version drift |
| Docs/State  | `FLAGS.md`, `state.json`, `VALIDATION-*.md`, `test-cases/AUTH-01.json` | honest disclosure |

## Executive summary

This diff adds a standalone, deliberately-unmounted `LoginScreen`/`LoginForm` pair plus a mocked
`userAuthService`, exactly matching PLAN.md's file table (F-01..F-06) with zero drift. The locked
`AUTH-05` cross-story contract (`onLoginSuccess` + optional `sessionExpiredMessage`, no
`authError`) is implemented verbatim. `App.jsx` is untouched, confirmed by `git diff --name-only`.
The pre-flagged `setAuthToken` collision with AUTH-04 is visibly and honestly documented in both
`FLAGS.md` and `state.json.pending_carry_forward` — not silently introduced. Security posture is
solid: the generic error message never distinguishes invalid-email from invalid-password, no
credential/password value is logged or persisted, and the internal `serverError` prop added to
`LoginForm` is genuinely internal (not exported on `LoginScreen`'s public surface) — it does not
leak as a second external contract. The one real fix-loop item (TC-05's original tautological
`scrollWidth`/`clientWidth` jsdom assertion) was correctly replaced with a structural, mutation-
tested CSS-contract check, and `FLAGS.md`'s AF-05 disclosure is honest about the residual gap
(no real browser reflow check exists in this repo).

The warnings below are non-blocking: (1) `LoginScreen`'s full-page centering wrapper uses inline
`style={{}}` for token-covered layout properties (spacing/sizing) with no existing CSS class to
reuse, a `react-patterns` deviation not present in `UserForm.jsx`'s precedent; (2) the Testing
Library dependency addition is reasonable and matches PLAN.md's Test Strategy but pulls in a
notably early/unusual `@testing-library/jest-dom@^7.0.1` version worth a sanity-check.

🟢 strengths — locked contract honored verbatim; App.jsx correctly untouched; collision risk
transparently carried forward; no security/PII leaks found independently.
⚠️ warnings — inline-style layout deviation in `LoginScreen`; one dependency version worth a
second look.
🛑 blockers — none.

## Findings summary

| Severity | Count | Category distribution                                   |
|----------|-------|-----------------------------------------------------------|
| CRITICAL |   0   | —                                                           |
| HIGH     |   0   | —                                                           |
| MEDIUM   |   1   | design-patterns (1)                                         |
| LOW      |   2   | component-architecture (1), dependency-hygiene (1)          |

No `adr-violation` findings (PLAN.md § 1 explicitly records no ADR applies to this story), no
`scope-creep` findings (every touched file traces to PLAN.md's F-01..F-06 table or its declared
test-tooling task).

## Detailed findings

### MEDIUM

#### F-1 — design-patterns: `LoginScreen` page wrapper uses inline styles for token-covered layout
- Category: design-patterns
- Path: `frontend/src/components/LoginScreen.jsx:27-28`
- Source: `.claude/skills/react-patterns/SKILL.md` § Design system + visual conventions ("no inline `style={{}}` for anything token-covered (color, spacing, radius)")
- Description: The outer wrapper (`minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20`) and inner wrapper (`width: "100%", maxWidth: 400`) are hand-rolled inline styles for a full-page centering layout that has no precedent anywhere else in the codebase (`UserForm.jsx`'s only inline styles are the pre-existing, narrowly-scoped svg/spinner/footer ones this PR correctly mirrors). REQUIREMENTS.md's "no new CSS" constraint is in tension with the react-patterns rule here, since no existing class covers page-level centering.
- Suggested fix: Add a small, scoped utility class (e.g. `.auth-page`) to `frontend/src/styles/index.css` using existing design tokens (`--space-*` if present, or the same `20px`/`400px` values) rather than literals in JSX. This is additive CSS using existing tokens, not a "new design system," so it does not conflict with the REQUIREMENTS.md constraint's intent. Non-blocking since the component is unmounted and unreachable this story; worth fixing before or alongside AUTH-05's `App.jsx` wiring.

### LOW

#### F-2 — component-architecture: `serverError` prop naming vs. `authError` internal state
- Category: component-architecture
- Path: `frontend/src/components/LoginScreen.jsx:10,40`, `frontend/src/components/LoginForm.jsx:23`
- Source: PLAN.md § 3 Module Hierarchy (documents `LoginScreen` "owns: ... authError ... state") vs. REQUIREMENTS.md AUTH-01-FR-1 (locks the *external* `LoginScreen` contract only)
- Description: Confirmed this is genuinely internal — `LoginScreen`'s exported props are exactly `{ onLoginSuccess, sessionExpiredMessage }` (verified: no `authError`/`serverError` prop on `LoginScreen`'s signature), and `serverError` is a private prop passed one level down to `LoginForm`, an implementation detail invisible to any consumer of `LoginScreen`. No violation of the locked contract. Flagging only because the internal state variable is named `authError` while the prop handed to `LoginForm` is renamed `serverError` — a harmless but slightly inconsistent internal naming that could confuse a future maintainer skimming for the locked contract's `authError` prohibition.
- Suggested fix: Optional — rename the internal `authError` state to `serverError` for 1:1 naming with the prop it feeds, or leave as-is; no functional or contract risk either way.

#### F-3 — dependency-hygiene: `@testing-library/jest-dom@^7.0.1` version worth a sanity check
- Category: testability
- Path: `frontend/package.json:17`
- Source: `.claude/rules/performance-baseline.md` (general dependency hygiene expectation) / no specific rule mandates a version, so this is advisory only
- Description: `@testing-library/jest-dom` major version 7 is a notably fast-forward jump relative to this repo's otherwise-conservative pinning (React 18, Vite 5). The addition itself is correctly minimal and matches PLAN.md's Test Strategy (Vitest + Testing Library was already assumed); this is not scope creep. `@testing-library/react@^16.3.2` and `@testing-library/dom@^10.4.1` are consistent with that React 18 + Vitest 2 stack.
- Suggested fix: No action required if `npm run test` passes in CI (confirmed PASS per `state.json.impl_evidence.checks.unit_tests`, 43/43). Worth a follow-up glance at the jest-dom v7 changelog for any matcher-behavior changes, but not blocking.

## What went well

- Locked `AUTH-05` cross-story `LoginScreen` prop contract (`onLoginSuccess` + optional `sessionExpiredMessage`, no `authError`) implemented verbatim and independently verified against the component signature.
- `App.jsx` confirmed untouched (`git diff 58fe64c0 --name-only` shows no `App.jsx` entry) — matches PLAN.md's explicit "no `App.jsx` entry" scope note and REQUIREMENTS.md § Scope Out.
- The known `setAuthToken`/AUTH-04 collision is disclosed transparently in three places (`FLAGS.md`, `state.json.pending_carry_forward`, and inline JSDoc comment on `setAuthToken` itself noting "in-memory only... persistence across reloads is a later story's scope") rather than silently landed.
- Independent verification confirms: no `console.*` calls in any new/modified source file; generic, non-distinguishing error message (`"Invalid email or password. Please try again."`) matches REQUIREMENTS.md verbatim; password value never escapes `LoginForm`'s local state (TC-07 asserts this and the review confirms no counter-evidence in the diff).
- TC-05's fix-loop history is sound: the round-1 tautological `scrollWidth`/`clientWidth` jsdom assertion was replaced with a structural CSS-contract check, independently mutation-tested in `VALIDATION-20260818-1445.md` (mutating `.form-input` to `width: 500px` correctly fails the test), and `FLAGS.md` AF-05 honestly discloses it as "still not a genuine rendered-viewport check" pending real e2e tooling.
- Testing Library dependency addition is minimal-necessary and was already anticipated by PLAN.md § 7 Test Strategy — not scope creep.
- Every touched/created file traces to a PLAN.md F-0x row or its declared test-tooling task (`vite.config.js` `setupFiles`, `test-setup.js`, `project-commands.yaml` preflight smoke-check for the new test deps) — no scope-creep findings.

## Recommendation

**PASS WITH WARNINGS.** No CRITICAL or HIGH findings; one MEDIUM (inline-style layout deviation,
non-blocking since `LoginScreen` is unmounted and unreachable this story) and two LOW/advisory
notes. Proceed to `/arh-security-review`; address F-1 (either now or bundled with AUTH-05's
`App.jsx` wiring) and consider F-2/F-3 opportunistically. No re-plan or ADR escalation required.
