---
name: arh-plan-requirements
description: Story + research → REQUIREMENTS.md + structured test cases. Detects design mode (figma vs ascii); Product Gate before plan-implementation.
argument-hint: "[story-id ...]"
disable-model-invocation: true
allowed-tools: Read Write Edit AskUserQuestion Task
---
**Batch:** Split `$ARGUMENTS` on whitespace, commas, or semicolons. `--` tokens are flags; all others are story IDs.
- **0 story IDs** → abort: print `Usage: /plan-requirements <story-id> [story-id ...]`.
- **1 story ID** → skip this, continue to the phase below (single-story mode, unchanged).



**2+ story IDs — batch:**

1. **Do NOT loop in this session.** For each story ID in order, fire one isolated `Task` invocation: `/plan-requirements <story-id>`. Each `Task` gets a fully isolated context window — no state, findings, or decisions from one story can affect another.
2. **Wait** for each `Task` to finish completely before starting the next.
3. **Display each story's complete output to the user immediately** after it finishes — do not collect silently and show only at the end.
4. After all complete, print: `BATCH COMPLETE — /plan-requirements (<N> stories)` with columns `Story | Gate | Test cases | Output`.
5. If `Task` is unavailable: do not loop — ask the user to run each story individually.



# /arh-plan-requirements — Main Orchestrator

Expand a certified story into REQUIREMENTS.md (PRD), generate structured test cases, conditionally produce hi-fi UX, and route through the Product Gate before plan-implementation.

**Input:** `$ARGUMENTS` — one story id, or multiple space-separated ids for batch (see Batch mode above)

## Pipeline

```
0. Context + design-mode detection
   ├── design_mode = figma         →  invoke ux-agent (Figma MCP, hi-fi)
   ├── design_mode = claude-design →  invoke ux-agent (claude.ai/design manual export)
   ├── design_mode = stitch        →  invoke ux-agent (Stitch MCP)
   ├── design_mode = html-mockup   →  invoke ux-agent (standalone HTML files, lo-fi)
   └── design_mode = none          →  skip § Visual spec + § Screen inventory
1. Draft REQUIREMENTS.md (stubs § Visual spec as "Pending — DESIGN.md")
   └── if design_mode != none: hand off to ux-agent which writes DESIGN.md
2. Generate test cases JSON
3. Tracker subtask (Plan Requirements)
4. Product Gate
```

All visual content lives in `docs/features/<id>/DESIGN.md` (produced by `ux-agent`). The PRD's `## Visual spec` section is always a one-line pointer to DESIGN.md — never inline screens / tokens / wireframes.

## Phase 0 — Context + design-mode detection

_Single-story mode — batch detection (above) has already run; if there were multiple story IDs, this point is never reached._

Read and follow: `${CLAUDE_SKILL_DIR}/steps/00-design-mode.md`

## Phase 1 — Draft REQUIREMENTS.md

Read and follow: `${CLAUDE_SKILL_DIR}/steps/01-draft-prd.md`

Invoke `product-spec-agent` with `$ARGUMENTS`. Outputs `docs/features/$ARGUMENTS/REQUIREMENTS.md`.

## Phase 2 — Test cases

Read and follow: `${CLAUDE_SKILL_DIR}/steps/02-test-cases.md`

Generates `docs/test-cases/$ARGUMENTS.json` per `test-case-generation`.

## Phase 3 — Tracker subtask

Read and follow: `${CLAUDE_SKILL_DIR}/steps/03-tracker.md`

Mandatory when issue tracker is configured. `issue-tracking-agent` mirrors REQUIREMENTS.md content as a subtask under the parent story.

## Phase 4 — Product Gate

Read and follow: `${CLAUDE_SKILL_DIR}/steps/04-product-gate.md`

Surface the gate checklist to the user. Plan-implementation is blocked until the gate passes.

## Final summary

```
PLAN-REQUIREMENTS COMPLETE
──────────────────────────────────────
Story:                 $ARGUMENTS
Design mode:           figma | ascii
REQUIREMENTS.md:       docs/features/$ARGUMENTS/REQUIREMENTS.md
UI designs:            <figma-url>            | inline ASCII
Test cases:            <N> total, <M> automatable
Tracker subtask:       {KEY-XX}                | skipped (<reason>)
Open questions:        <count>

Gate status: PENDING APPROVAL  (run /arh-plan-implementation $ARGUMENTS once approved)
```
