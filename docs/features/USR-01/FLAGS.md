# Agent Flags — USR-01

### AF-01: evidence-na · task: n/a · docs/config/project-commands.yaml
typecheck dimension marked N/A — source key absent/empty: "plain JSX, no TypeScript/mypy configured" (pre-existing project-wide gap, same as SRF-01 AF-01, not introduced by this story).

### AF-02: evidence-na · task: n/a · docs/config/project-commands.yaml
lint dimension marked N/A — source key absent/empty: "no linter configured for react or fastapi" (pre-existing project-wide gap, same as SRF-01 AF-02, not introduced by this story).

### AF-03: evidence-na · task: n/a · docs/config/project-commands.yaml
design_check dimension marked N/A — source key absent/empty: "no accessibility/console-error/lighthouse tooling exists in this repo" (pre-existing project-wide gap, same as SRF-01 AF-03, not introduced by this story). This is a UI-touching story (T-01/T-02/T-03) with no DESIGN.md (`design: n/a` in state.json, `integrations.design: none`) — per implementation-agent procedure this is also recorded here as a `risky-pattern` note: Users.jsx/Dashboard.jsx/App.jsx were implemented against `react-patterns` conventions and byte-for-byte extraction parity with the existing (already-shipped) Dashboard.jsx, not a DESIGN.md artifact, because no design provider is configured for this project.
