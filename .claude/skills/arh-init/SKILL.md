---
name: arh-init
description: Populate harness state — gather context, tracker configs, then delegate commands + memory file + architecture ADRs to bootstrap-agent. Detects brownfield.
disable-model-invocation: true
allowed-tools: Read Write Edit Bash Grep Glob
---
# /arh-init — Main Orchestrator

Initialise harness state from project signals plus user input. Idempotent — safe to re-run when stack, domain, personas, or integrations evolve.

Hybrid flow: the interactive + MCP phases (0–3, 5) run inline here in the main session because they need live user dialogue; the analysis + write phase (4) is delegated to the `bootstrap-agent` subagent.

**Input:** `$ARGUMENTS` (optional one-line project description).

## Pipeline

```
0. Detect signals          (main, read-only)
1. Gather info             (main, interactive: 9 Qs + conventions + overwrite pre-approval)
2. Tracker/design config   (main, MCP discovery + picks)
3. Folders + RTM + ADR-0001(main, write)
4. Architecture decisions  (main, interactive: ask gaps w/ recommendations)
   → INVOKE bootstrap-agent (subagent loads skills: project-commands → project-memory → architecture-decision)
5. Brownfield branch       (main, interactive: suggest /arh-import)
```

## Phase 0 — Detect signals

Read and follow: `${CLAUDE_SKILL_DIR}/steps/00-detect.md`

Carry the greenfield/brownfield verdict forward — you hand it to `bootstrap-agent` in Phase 4 and gate Phase 5 on it.

## Phase 1 — Gather info

Read and follow: `${CLAUDE_SKILL_DIR}/steps/01-gather.md`

This phase also collects the Conventions answer and runs any project-memory-file overwrite pre-approval here, in the main session.

## Phase 2 — Tracker/design config

Read and follow: `${CLAUDE_SKILL_DIR}/steps/02-tracker.md`

## Phase 3 — Folders + RTM stub + ADR-0001

Read and follow: `${CLAUDE_SKILL_DIR}/steps/03-folders.md`

## Phase 4 — Architecture decisions + delegate

### Step 4.0 — Architecture decisions (main session, interactive)

Read and follow: `${CLAUDE_SKILL_DIR}/steps/04-architecture-decisions.md`

Settle the high-level architecture decisions WITH the user here. The step frames them as six role-agnostic dimensions (runtime, state, interfaces, execution, trust, operability), instantiated from the declared stacks/roles — ask only the live, unsettled ones, with a recommendation each; skip anything already answered by the declared stacks / `docs/prd/*` / `docs/config/domains.json`. Record them to the answer log. The subagent cannot ask, so this must happen before the invoke.

### Step 4.1 — Invoke `bootstrap-agent`

**Patterns-skill freshness check (G15).** The agent consults the `<framework>-patterns` skills for stack-specific commands (skill `project-commands`) and architecture topology (skill `architecture-decision`). Before invoking, run the patterns-freshness check per skill `phase-preconditions` § G15 — warn per unfilled skill (do NOT abort), consequence: "commands + architecture inference will be generic".

Invoke the `bootstrap-agent` subagent. Pass it: (1) the greenfield/brownfield verdict from Phase 0, (2) the Phase-1 answer log (Conventions, Personas, Domain, Target platforms, overwrite approvals) **plus the Step-4.0 `architecture:` block**. The agent already carries a `<framework>-patterns` skill per stack and reads `docs/adr/0001-tech-stack.md` for the recorded stack. All interactive decisions were resolved in Phases 1–2 and 4.0.

The agent works through three knowledge skills it loads, in this order:

1. Skill **`project-commands`** — writes `docs/config/project-commands.yaml` + `docs/config/stack-smoke.md`.
2. Skill **`project-memory`** — verifies the project memory file against its canonical sections: fills TODO slots from the Phase-1 answers and adds any absent sections (incl. the `@imports` + Where-to-look wiring) without clobbering. (Commands first so the `@import docs/config/project-commands.yaml` check resolves within the run.)
3. Skill **`architecture-decision`** — **records the Step-4.0 architecture decisions** + stack topology as ADR(s) (next free id from `0002`) — prefer ONE consolidated ADR. Brownfield reverse-engineers the existing architecture and flags gaps. It does not invent decisions the user did not make.

Consume the agent's hand-off report: surface the memory-file overwrites it performed, the ADR ids it wrote, and any flagged missing pieces (brownfield) in the Final summary.

## Phase 5 — Brownfield branch (suggest /arh-import)

Read and follow: `${CLAUDE_SKILL_DIR}/steps/05-brownfield.md`

Only when Phase 0 reported `Mode: brownfield`.

## Final summary

```
BOOTSTRAP COMPLETE
──────────────────────────────────────
Signals detected:    <list>
Mode:                greenfield | brownfield
Configs:             docs/config/issue-tracking.yaml, docs/config/doc-tracker.yaml, docs/config/project-commands.yaml
Folders:             docs/{stories,research,features,requirements,adr,sessions}/ created
RTM stub:            docs/requirements/RTM.md
ADR-0001:            docs/adr/0001-tech-stack.md
Memory file:         populated  (personas: <N>, domain entries: <M>)
Memory overwrites:   <list reported by agent | none>
Architecture ADRs:   <ids + titles from agent report, e.g. ADR-0002 system architecture>
Flagged (brownfield):<undocumented layers / missing configs | none>
Patterns:            <W> unfilled <framework>-patterns warnings
TODOs remaining:     <count>

Next:
  Greenfield → /arh-scaffold (if stack provides one) then /arh-intake
  Brownfield → /arh-import --jira-jql / --confluence-space / --from-files
```
