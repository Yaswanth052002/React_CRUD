# Agent Flags — AUTH-04

<!-- All 4 flags triaged 2026-08-18 by yaswanth.panthangi@apexon.com — decisions recorded in docs/features/AUTH-04/state.json .agent_flags[] -->
<!-- AF-01: defer (pre-existing repo gap) -->
<!-- AF-02: defer (pre-existing repo gap) -->
<!-- AF-03: reject (noise, per precedent) -->
<!-- AF-04: defer (expected scope boundary, follow-up after AUTH-05) -->

### AF-01: evidence-na · task: n/a · docs/config/project-commands.yaml
typecheck dimension marked N/A — source key absent/empty: "plain JSX, no TypeScript/mypy configured" (pre-existing project-wide gap, same as USR-01 AF-01, not introduced by this story).

### AF-02: evidence-na · task: n/a · docs/config/project-commands.yaml
lint dimension marked N/A — source key absent/empty: "no linter configured for react or fastapi" (pre-existing project-wide gap, same as USR-01 AF-02, not introduced by this story).

### AF-03: evidence-na · task: n/a · docs/config/project-commands.yaml
design_check dimension marked N/A — source key absent/empty: "no accessibility/console-error/lighthouse tooling exists in this repo" (pre-existing project-wide gap, same as USR-01 AF-03, not introduced by this story). AUTH-04 has `design: n/a` in state.json (no DESIGN.md, `integrations.design: none`) and this story adds no new rendered UI surface of its own (Login rendering is AUTH-01/AUTH-05 scope) — per implementation-agent procedure this is recorded here rather than silently skipped.

### AF-04: risky-pattern · task: T-05 · frontend/src/__tests__/App.auth.test.jsx
TC-02 (no-token render, "Login rendered within 100ms, zero protected data-fetch calls"), TC-10
(full `sessionExpiredMessage` prop threading to `LoginScreen`), and TC-14 (`sessionExpiredMessage`
rendered in an aria-live region on the Login screen after redirect) cannot be exercised
end-to-end by this story: PLAN.md/REQUIREMENTS.md explicitly scope the Login-vs-protected-view
conditional render out of AUTH-04 (deferred to AUTH-05), so `App.jsx` still unconditionally
mounts `Dashboard` today regardless of `isAuthenticated`, and there is no `LoginScreen` yet to
own an aria-live region at all. The tests in `App.auth.test.jsx` instead assert the observable
proxies available today (no `clearAuthToken`/`auth_session_expired` call for a valid/absent
token; handler registration + safe invocation; and, for TC-14, that the `sessionExpiredMessage`
state value is set to the exact required copy — "Your session has expired. Please log in
again." — when the unauthorized handler fires, and never set to that value when there is
nothing to expire). Full behavioral verification of TC-02/TC-10/TC-14 as literally worded must
be re-run once AUTH-05 lands `LoginScreen` and its aria-live region.

**Correction (2026-08-18, round-1 fix per VALIDATION-20260818-0710.md):** TC-14 was originally
omitted from this disclosure and `PLAN.md`'s `## 7. Test Strategy` table incorrectly claimed
`App.auth.test.jsx` already fully covered TC-14 (it only had TC-01/02/03/05/10/13 at the time).
Both gaps are now corrected: this entry explicitly includes TC-14 above, `PLAN.md` §7 now
labels the TC-14 row as deferred/partial (matching how TC-02/TC-10 are described), and a
TC-14-tagged partial/proxy test has been added to `App.auth.test.jsx` covering the state-value
assertion described above.
