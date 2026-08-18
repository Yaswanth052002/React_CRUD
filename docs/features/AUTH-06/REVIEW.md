# Code Review — AUTH-06 (working tree vs `339e338c`)

- Date: 2026-08-18T13:04:47Z
- Mode: story (target ref: uncommitted working tree on `feature/AUTH`, diffed against `339e338c`)
- Files reviewed: 5 (AUTH-06's own PLAN.md file table F-01..F-05 only)
- Verdict: **PASS**

## Scope note

The working tree layers AUTH-01, AUTH-06, and AUTH-07 changes together (intentional, per
sequencing dependency). This review is scoped **exclusively** to AUTH-06's declared file table
(`docs/features/AUTH-06/PLAN.md` § 2, F-01..F-05):

| ID   | Path                                              | Reviewed |
|------|---------------------------------------------------|----------|
| F-01 | `frontend/src/services/userApi.js` (`getCurrentUser` addition) | Yes |
| F-02 | `frontend/src/pages/Settings.jsx`                  | Yes |
| F-03 | `frontend/src/App.jsx` (`SettingsPlaceholder` → `Settings` swap) | Yes |
| F-04 | `frontend/src/pages/__tests__/Settings.test.jsx`   | Yes |
| F-05 | `README.md` § 11                                   | Yes |

Everything else in the working diff (`frontend/src/components/LoginForm.jsx`,
`frontend/src/services/userApi.js`'s `logout()`/`clearAuthToken` console-log addition,
`docs/features/AUTH-01/PLAN.md`, `docs/features/AUTH-07/*`, `docs/test-cases/AUTH-07.json`, etc.)
belongs to sibling stories AUTH-01/AUTH-07 and is explicitly **out of scope** for this review pass
— it is not attributed to AUTH-06 as scope-creep, and is left for the dedicated AUTH-07 review.
One item worth flagging for that companion review: the `logout()` export added to
`userApi.js` includes a `console.log("auth:logout", { timestamp })` call — it logs no PII, but
since it lives in a file AUTH-06 also modifies, note it here so the AUTH-07 reviewer sees it
without re-diffing the whole file.

## Executive summary

AUTH-06 adds a minimal, read-only Settings page (name/email display + Logout) exactly to the
contract locked in `PLAN.md` § 3 and `REQUIREMENTS.md`. `getCurrentUser()` mirrors the existing
`getUser`/`getDashboardStats` pattern in `userApi.js` verbatim (single `client.get`, try/catch,
`normalizeError`, return `res.data`). `Settings.jsx` matches the exact prop contract
(`{onMenuClick, onLogout}`, no `isAuthenticated`), state shape, effect, and Logout call-order
(`userApi.logout()` then `props.onLogout()`) specified in PLAN.md § 3. The `App.jsx` edit is
surgically scoped to the `activeView === "settings"` branch swap, with the now-dead
`SettingsPlaceholder` function and its now-unused `Header` import correctly removed rather than
left as dead code, and AUTH-04/AUTH-05's state/handlers/conditional-render branch left untouched.
`Settings.test.jsx` covers all 12 declared TCs, mocking `userApi.js` at the service boundary per
`react-patterns`. No PII is logged on either the success or failure path (backed by TC-11); no
raw stack trace is ever surfaced (errors flow through `normalizeError`). No ADR-worthy decision
was required by this story and none is contradicted.

🟢 Strengths: exact contract adherence (props, call order, no-avatar, no-loading-state-on-Logout),
clean removal of dead code in `App.jsx`, comprehensive test coverage traceable to every TC,
transparent self-disclosure of the unstyled-banner gap via `FLAGS.md` AF-05.
⚠️ Warnings: none blocking.
🛑 Blockers: none.

## Findings summary

| Severity | Count | Category distribution |
|----------|-------|------------------------|
| CRITICAL | 0     | —                       |
| HIGH     | 0     | —                       |
| MEDIUM   | 0     | —                       |
| LOW      | 1     | design-patterns (1)     |

## Detailed findings

### LOW

#### F-1 — design-patterns: error banner has no `.banner`/`.banner-error` CSS rule
- Category: design-patterns
- Path: `frontend/src/pages/Settings.jsx:54-58`
- Source: `.claude/rules/accessibility-baseline.md` ("Color is not the sole indicator of state" — here there is neither color nor icon differentiation, only text); already self-disclosed in `docs/features/AUTH-06/FLAGS.md` AF-05.
- Description: `Settings.jsx` renders `<div className="banner banner-error" role="alert">` exactly per PLAN.md § 3's locked contract (condition C-4), but `frontend/src/styles/index.css` defines no `.banner`/`.banner-error` rule, so the error state is not visually distinguished from ordinary text (though it remains screen-reader-accessible via `role="alert"` and is still readable, satisfying the no-raw-stack-trace / readable-error convention). This is not an AUTH-06 implementation defect — the markup and class names are a locked cross-story contract this story does not own the CSS file for (`index.css` is not in AUTH-06's F-01..F-05 file table).
- Suggested fix: Track as a carry-forward item (already recorded as AF-05) for a follow-up story or PR to add `.banner`/`.banner-error` styles to `index.css`; no action required in AUTH-06 itself.

## What went well

- `getCurrentUser()` (F-01) is byte-for-byte structurally identical to the existing `getUser`/`getDashboardStats` pattern — no invented shape.
- `Settings.jsx` (F-02) never reads/destructures `isAuthenticated`, matching AUTH-06-FR-3/TC-06 exactly; TC-06 asserts identical render output with/without the prop.
- `handleLogout` calls `userApi.logout()` before `props.onLogout()`, matching AUTH-06-FR-2/TC-04's asserted call order.
- No avatar element anywhere in the render tree (TC-12 asserts `.details-avatar` absence).
- Logout button carries no loading state (synchronous `logout()`, per condition C-8) — confirmed, no `disabled`/spinner wired to the button.
- `App.jsx` (F-03): `SettingsPlaceholder` function body and its now-solely-used `Header` import are both fully removed rather than left as dead code; the diff touches nothing else in `App.jsx` (AUTH-04's state, AUTH-05's conditional-render branch, and `handleLogout`'s definition are all untouched — only its doc comment was updated to describe the now-fulfilled forward reference, which is directly traceable to this task).
- `Settings.test.jsx` (F-04) mocks `../../services/userApi.js` at the boundary (never axios directly), covers all 12 declared TCs, and TC-11 explicitly spies on `console.log`/`console.error` across both paths and asserts no PII leak.
- `README.md` (F-05) addition is a single, scoped paragraph + list item under § 11, matching REQUIREMENTS.md's Documentation requirements verbatim in intent.
- No ADR violation: PLAN.md § 1 correctly determined no mini-ADR was warranted for this story, and nothing in the diff invents a materially different shape.
- No scope-creep within AUTH-06's own file table — every changed line in F-01..F-05 traces to T-01..T-05.

## Recommendation

**PASS.** No CRITICAL, HIGH, or MEDIUM findings; one LOW finding is a pre-existing, self-disclosed
CSS gap outside this story's scope. AUTH-06's implementation may proceed to
`/arh-security-review`. The unstyled-banner LOW finding and the `logout()` console-log note above
should be carried forward to the AUTH-07 review / a follow-up CSS task, not fixed inline here.
