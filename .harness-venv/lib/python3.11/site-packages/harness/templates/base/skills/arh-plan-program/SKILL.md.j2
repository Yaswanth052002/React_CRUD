---
name: arh-plan-program
description: Full release planning orchestrator — infers dependencies with optional research enrichment, validates via structural and adversarial checks, obtains explicit human sign-off, assigns delivery waves, and generates visual graphs and Gantt charts. Locks the dependency topology once per release.
disable-model-invocation: true
allowed-tools: Read Bash Agent AskUserQuestion
---
# /arh-plan-program — Main Orchestrator

Orchestrate the full 8-step planning pipeline: infer story dependencies (with optional research enrichment), validate them structurally and adversarially, obtain explicit human sign-off, assign delivery waves, and produce interactive visual graphs and Gantt charts.

After completion, the **dependency topology is locked** until the next release. Status updates are handled by `/arh-refresh-graph`.

**Input:** None — operates on the full story set in `docs/stories/` against `docs/requirements/RTM.md`.

**Precondition:** `docs/requirements/RTM.md` must exist; all stories must be `Validated` status or beyond.

## Pipeline

```
Step 1: Pre-flight
Step 2: Dependency Inference     → produces dependency-list.md
Step 3: Structural Validation    → writes validation report (structural section)
Step 4: Adversarial Validation   → extends validation report (adversarial section)
Step 5: Human Review Gate        → blocking sign-off; corrects dependency-list.md
Step 6: Wave Planning            → produces wave-plan.md
Step 7: Interactive Graph        → produces dependency-graph-visual.html
Step 8: Gantt Chart              → produces wave-gantt.html
```

Step 5 is the only blocking step — the pipeline does not advance until the user signs off.

---

## Narration Rules

Apply these rules throughout every step. They govern what you output between tool calls — not what the pipeline does.

1. **Step banner** — Open every step by printing exactly this line, then proceed immediately with tool calls:
   ```
   ▶ STEP N/8 — NAME
   ```
   On step completion, print:
   ```
   ✓ STEP N — NAME
   ```
   Do not add explanatory prose around the banner. The name is self-documenting.

2. **File writes** — After any `Write` or `Edit` tool call on a pipeline artifact, output only:
   ```
   ✓ wrote {path} ({N} lines)
   ```
   Never preview, quote, or summarize file contents inline. Do not narrate what the file contains.

3. **Between-step prose** — One sentence maximum between a step banner and the first tool call. Do not explain what the step does; the banner names it and the tool calls show the work.

---

## Key Concepts

### Dependency Topology Lock

After Step 5 (Human Review Gate), the **dependency topology** (all edges) is locked and immutable.
You cannot re-infer edges on existing stories without re-running the full pipeline and obtaining
new sign-off.

What's locked:
- All dependency edges (From → To relationships)
- All edge confidence levels (HIGH / MEDIUM)
- Wave assignments (which story goes in which wave)
- Critical path

What can still change:
- Story status badges (Draft → In Progress → Done) — refresh via `/arh-refresh-graph`
- Research report availability (RES badge) — refresh via `/arh-refresh-graph`

### Research Enrichment (Optional)

During Step 2 (Dependency Inference), the agent optionally reads `docs/research/` reports
and uses them as a **soft input** to improve edge confidence. If a research report confirms
a dependency, that edge is marked HIGH. If no reports exist, the agent falls back to the
9-rule rubric as normal.

This enrichment is integrated, not invasive — research findings are deduplicated against
the 9-rule rubric (higher confidence wins).

---

## Steps

Read and follow each step file in sequence.

| Step | Name | File |
|---|---|---|
| 1  | Pre-flight (+ change classification) | `${CLAUDE_SKILL_DIR}/steps/01-preflight.md` |
| 2  | Dependency Inference (scoped to changed/new) | `${CLAUDE_SKILL_DIR}/steps/02-dependency-inference.md` |
| 2b | Delta Merge (locked + delta → full list) | `${CLAUDE_SKILL_DIR}/steps/02b-delta-merge.md` |
| 3  | Structural Validation | `${CLAUDE_SKILL_DIR}/steps/03-structural-validation.md` |
| 4  | Adversarial Validation | `${CLAUDE_SKILL_DIR}/steps/04-adversarial-validation.md` |
| 5  | Human Review Gate (+ lock write) | `${CLAUDE_SKILL_DIR}/steps/05-human-review-gate.md` |
| 6  | Wave Planning (deterministic script) | `${CLAUDE_SKILL_DIR}/steps/06-wave-planning.md` |
| 7  | Visual Graph (deterministic script) | `${CLAUDE_SKILL_DIR}/steps/07-visual-graph.md` |
| 8  | Gantt Chart (deterministic script) | `${CLAUDE_SKILL_DIR}/steps/08-gantt.md` |

---

## Final Report

```
PLAN PROGRAM — COMPLETE
──────────────────────────────────────────────────────
Stories analysed:      {N}   ({X} skipped — Draft/In Review)
Dependencies inferred: {N}   ({H} HIGH — Sprint-blocked  |  {M} MEDIUM — Integration-blocked)
Waves:                 {N}
Critical path:         {STORY-ID} → … → {STORY-ID}  ({N} waves minimum)

Artifacts:
  docs/program/dependency-list.md
  docs/program/dependency-validation-report.md
  docs/program/wave-plan.md
  docs/program/dependency-list-reduced.md
  docs/program/dependency-graph-visual.html
  docs/program/wave-gantt.html

Wave 1 stories (start immediately):
  {list story IDs and titles}

Flags for human review:
  {any risk register items worth surfacing — CONFLICT, BROKEN_REF, EXTERNAL_DEP}

TOPOLOGY LOCKED
───────────────
All dependency edges are now immutable. Use:
  /arh-refresh-graph     — update story status badges, research badges, wave badges
  /arh-plan-program      — re-plan entire release (requires new human sign-off)

Last action: Plan Program complete on {TIMESTAMP}

Token usage:    run /cost to see this session's token consumption
```

---

## Post-Plan-Program Workflow

### During implementation

As stories move through statuses (In Progress → Done), update the graph:

```bash
/arh-refresh-graph
```

This regenerates `docs/program/dependency-graph-visual.html` with current badges.
Topology and wave assignments are unchanged.

### Full re-plan (rare)

If requirements fundamentally change or stories need reclassification:

```bash
/arh-plan-program
```

This re-runs the full 8-step pipeline from scratch. All edges are re-inferred and
require new human sign-off at Step 5. Only run when the scope or story content
has materially changed.
