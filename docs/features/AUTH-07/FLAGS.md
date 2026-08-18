# Agent Flags — AUTH-07

### AF-01: evidence-na · task: n/a · docs/config/project-commands.yaml
typecheck dimension marked N/A — source key absent/empty: "plain JSX, no TypeScript/mypy configured" (pre-existing project-wide gap, same as AUTH-04/AUTH-05 AF-01, not introduced by this story).

### AF-02: evidence-na · task: n/a · docs/config/project-commands.yaml
lint dimension marked N/A — source key absent/empty: "no linter configured for react or fastapi" (pre-existing project-wide gap, same as AUTH-04/AUTH-05 AF-02, not introduced by this story).

### AF-03: evidence-na · task: n/a · docs/config/project-commands.yaml
design_check dimension marked N/A — source key absent/empty: "no accessibility/console-error/lighthouse tooling exists in this repo" (pre-existing project-wide gap, same as AUTH-04/AUTH-05 AF-03, not introduced by this story). AUTH-07 has `design: n/a` in state.json and adds no new rendered UI surface (a pure `userApi.js` export) — recorded here rather than silently skipped.

### AF-04: risk · task: T-02 · docs/test-cases/AUTH-07.json (AUTH-07-TC-11)
TC-11 (keyboard-operability + post-logout-redirect focus management) is owned entirely by
AUTH-06's `Settings.test.jsx` per PLAN.md § 7, but AUTH-06 is unimplemented on this branch (no
`Settings.jsx` or `Settings.test.jsx` anywhere in `frontend/src`) — there is no runnable artefact
this story can author a test against. This is a genuine cross-story sequencing gap, not a silent
omission: TC-11 cannot be closed within AUTH-07's own scope and remains blocked pending AUTH-06's
implementation. Tracked as a `pending_carry_forward` entry (kind: "risk", tag: "sequencing") in
`docs/features/AUTH-07/state.json`.
