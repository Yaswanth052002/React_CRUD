---
name: arh-validate-story
description: Score a story against the 6-dimension rubric. Pass ≥80/100, no dimension under 60. Self-corrects up to 3 rounds.
argument-hint: "[story-id ...]"
disable-model-invocation: true
allowed-tools: Read Write Edit Task
---
**Batch:** Split `$ARGUMENTS` on whitespace, commas, or semicolons. `--` tokens are flags; all others are story IDs.
- **0 story IDs** → abort: print `Usage: /validate-story <story-id> [story-id ...]`.
- **1 story ID** → skip this, continue to the phase below (single-story mode, unchanged).



**2+ story IDs — batch:**

1. **Do NOT loop in this session.** For each story ID in order, fire one isolated `Task` invocation: `/validate-story <story-id>`. Each `Task` gets a fully isolated context window — no state, findings, or decisions from one story can affect another.
2. **Wait** for each `Task` to finish completely before starting the next.
3. **Display each story's complete output to the user immediately** after it finishes — do not collect silently and show only at the end.
4. After all complete, print: `BATCH COMPLETE — /validate-story (<N> stories)` with columns `Story | Score | PASS/FAIL`.
5. If `Task` is unavailable: do not loop — ask the user to run each story individually.



# /arh-validate-story

**Input:** `$ARGUMENTS` — one story id, or multiple space-separated ids for batch (see Batch mode above)

Validate `docs/stories/$ARGUMENTS.md` and self-correct on failure.

_Single-story mode — batch detection (above) has already run; if there were multiple story IDs, this point is never reached._

Delegate to `story-validation-agent`. The agent:

1. Loads the rubric from skill `requirement-validation`.
2. Scores all 6 dimensions and totals.
3. If pass: marks the story status `Validated`, prints the score, hands off.
4. If fail: hands back to `requirement-planner-agent` for self-correction (max 3 rounds).
5. After 3 failures, escalates with the open issues for human review.
