# Flags — AUTH-01

<!-- All 4 flags triaged 2026-08-18 by yaswanth.panthangi@apexon.com — decisions recorded in docs/features/AUTH-01/state.json .agent_flags[] -->
<!-- AF-01: defer (pre-existing repo gap) -->
<!-- AF-02: defer (pre-existing repo gap) -->
<!-- AF-03: reject (noise, per precedent) -->
<!-- AF-04: defer (expected — LoginScreen intentionally unmounted this story) -->
<!-- AF-05: defer (pre-existing repo gap — no e2e runner; structural check is best available honest verification) -->
<!-- Additional risk recorded: R-01-userApi-setAuthToken-collision in pending_carry_forward — AUTH-04's PLAN.md ADR-3 already anticipates this merge-time collision, mechanical fix. -->

⚠ **Note (added post-implementation, orchestrator-level):** this story's T-01 adds an
in-memory-header `setAuthToken` to `userApi.js`. AUTH-04's PLAN.md (ADR-3) already declares
AUTH-04's `localStorage`-backed `setAuthToken` authoritative and anticipates this exact
collision. AUTH-04 is already implemented on a separate branch. Whoever merges this story's PR
after AUTH-04's must resolve the `userApi.js` merge conflict by keeping AUTH-04's version — see
`pending_carry_forward` in `state.json` for the tracked risk.

### AF-01: evidence-na · task: n/a · docs/config/project-commands.yaml
typecheck dimension marked N/A — source key absent/empty. Repo has no TypeScript/mypy configured; frontend uses plain JSX (per ADR-0001 § Consequences).

### AF-02: evidence-na · task: n/a · docs/config/project-commands.yaml
lint dimension marked N/A — source key absent/empty. No linter configured for react or fastapi yet (repo-wide gap, not introduced by this story).

### AF-03: evidence-na · task: n/a · docs/config/project-commands.yaml
design_check dimension marked N/A — source key absent/empty. No accessibility/console-error/lighthouse tooling configured in this repo; `design_iteration` for AUTH-01 is `n/a` (no design provider configured) per `docs/features/AUTH-01/state.json`.

### AF-04: evidence-na · task: T-04 · docs/config/stack-smoke.md
runtime dimension's `react` stack render_check is `unavailable` — no browser/E2E runner is configured in this repo (`test_e2e: n/a`), so the boot check only confirms the pre-existing app shell serves 200 with a clean boot log; it does not assert client-rendered mount depth. Not a regression from this story: `LoginScreen`/`LoginForm` are intentionally unmounted (no `App.jsx` wiring — AUTH-05's scope), so there is nothing new for this app-shell boot check to render yet. Please confirm this N/A is acceptable at `/arh-human-review`.

### AF-05: risky-pattern · task: T-05-fix (round 1) · frontend/src/components/__tests__/LoginForm.test.jsx:54-81
AUTH-01-TC-05 (320px reflow) was originally implemented as a tautological jsdom assertion (`scrollWidth <= clientWidth` reduces to `0 <= 0` in jsdom, which has no real layout engine — it would pass even if the form were completely broken at narrow widths). Round-1 fix replaces it with an honest structural check: (1) no element LoginForm renders carries a fixed inline pixel width >320px, and (2) the shared `.form-input`/`.form-select` CSS rule in `frontend/src/styles/index.css` is confirmed relative (`width: 100%`) with no fixed px width/min-width that would overflow at 320px. This verifies the styling contract that governs reflow, but it is still not a genuine rendered-viewport check. Full pixel-accurate 320px reflow verification requires a real browser (Playwright/Cypress); this repo has no e2e runner configured (`test_e2e: n/a` in `docs/config/project-commands.yaml`), consistent with the AF-01/AF-02/AF-03 disclosure pattern. Deferred pending that tooling.
