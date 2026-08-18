# Agent Flags — AUTH-06

### AF-01: evidence-na · task: n/a · docs/config/project-commands.yaml
typecheck dimension marked N/A — source key absent/empty: "plain JSX, no TypeScript/mypy configured" (pre-existing project-wide gap, same as AUTH-04/AUTH-05/AUTH-07 AF-01, not introduced by this story).

### AF-02: evidence-na · task: n/a · docs/config/project-commands.yaml
lint dimension marked N/A — source key absent/empty: "no linter configured for react or fastapi" (pre-existing project-wide gap, same as AUTH-04/AUTH-05/AUTH-07 AF-02, not introduced by this story).

### AF-03: evidence-na · task: n/a · docs/config/project-commands.yaml
design_check dimension marked N/A — source key absent/empty: "no accessibility/console-error/lighthouse tooling exists in this repo" (pre-existing project-wide gap, same as AUTH-04/AUTH-05/AUTH-07 AF-03, not introduced by this story). AUTH-06 has `design: n/a` in state.json (no DESIGN.md, `integrations.design: none`); `Settings.jsx` was implemented against `react-patterns` conventions and PLAN.md § 3's locked component/render-tree contract, not a DESIGN.md artifact.

### AF-04: evidence-na · task: n/a · docs/config/stack-smoke.md
runtime dimension's `react` stack entry: boot-only evidence obtained (200 OK + clean boot log at `http://localhost:5184/`, vite binds IPv6 loopback only). No browser-capable E2E/test-runner tooling is installed in this repo (`test_e2e: n/a`) to additionally assert the SPA mounted the new `Settings` page content beyond the bare root element, per `evidence-pass`'s `render_check` contract. `render_check: "unavailable"` recorded on that stack's entry — pre-existing repo gap (same as AUTH-01 AF-04, AUTH-02 AF-07), not introduced by this story.

### AF-05: risky-pattern · task: T-02 · frontend/src/pages/Settings.jsx
PLAN.md § 3's locked render tree specifies `<div className="banner banner-error" role="alert">{error}</div>` for the fetch-failure state (condition C-4, restated from research). Implemented verbatim per the locked contract, but `frontend/src/styles/index.css` has no `.banner`/`.banner-error` rule defined anywhere in the existing stylesheet — the error banner will render unstyled (no distinguishing color/border) until a future story adds those classes to `index.css`. Not fixed inline: adding new CSS rules is outside this story's file-table scope (F-01/F-02/F-03/F-04/F-05 in PLAN.md do not include `index.css`), and the class names/markup are themselves a locked PLAN.md contract, not this implementation's choice.
