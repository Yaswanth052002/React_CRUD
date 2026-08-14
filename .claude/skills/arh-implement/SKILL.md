---
name: arh-implement
description: PLAN.md → branch → code → mandatory E2E validation → review → commit → PR → tracker comment. Strict sequence; never skip validation.
argument-hint: "[story-id ...]"
disable-model-invocation: true
allowed-tools: Read Write Edit Bash Grep Glob Task
---
**Batch:** Split `$ARGUMENTS` on whitespace, commas, or semicolons. `--` tokens are flags; all others are story IDs.
- **0 story IDs** → abort: print `Usage: /implement <story-id> [story-id ...]`.
- **1 story ID** → skip this, continue to the phase below (single-story mode, unchanged).



**2+ story IDs — batch:**

1. **Do NOT loop in this session.** For each story ID in order, fire one isolated `Task` invocation: `/implement <story-id>`. Each `Task` gets a fully isolated context window — no state, findings, or decisions from one story can affect another.
2. **Wait** for each `Task` to finish completely before starting the next.
3. **Display each story's complete output to the user immediately** after it finishes — do not collect silently and show only at the end.
4. After all complete, print: `BATCH COMPLETE — /implement (<N> stories)` with columns `Story | PR | Validation | Review`.
5. If `Task` is unavailable: do not loop — ask the user to run each story individually.



# /arh-implement — Main Orchestrator

End-to-end implementation from a PLAN.md. Strict sequence. **Never skip validation.** Never commit code that has not passed E2E validation.

**Input:** `$ARGUMENTS` — one story id, or multiple space-separated ids for batch (see Batch mode above)

## Sequence

```
0. Context load  →  1. Implement  →  2. Validate (MANDATORY)  →  3. Fix loop (≤3 rounds)
                                                                     │
                                  ┌──────────────────────────────────┘
                                  ▼
                            4. Code review  →  5. Commit + PR  →  6. Tracker completion
```

Step 1 includes an internal end-of-session evidence pass (six-dimension packet via the `evidence-pass` skill) with its own bounded fix loop. The implementation-agent returns either READY (all six PASS or accepted-N/A) or BLOCKED (round-3 escalation); only READY proceeds to Step 2. See `evidence-pass` skill.

If at any step you are blocked — environment failure, agent escalation, 3 failed fix rounds, or BLOCKED review verdict — stop and report to the user. **Do not commit or push code that has not passed E2E validation.**

## Step 0 — Context load

_Single-story mode — batch detection (above) has already run; if there were multiple story IDs, this point is never reached._

Read and follow: `${CLAUDE_SKILL_DIR}/steps/00-context.md`

## Step 1 — Implement tasks

Read and follow: `${CLAUDE_SKILL_DIR}/steps/01-implement.md`

Invoke `implementation-agent` with `$ARGUMENTS`. The agent implements task-by-task and, before returning control, runs the internal end-of-session evidence pass (six-dimension packet via the `evidence-pass` skill). The agent returns READY (all dimensions PASS or accepted-N/A) or BLOCKED (round-3 escalation, `EVIDENCE-ESCALATION.md` written). On BLOCKED, stop and surface to the user — do NOT attempt Step 2.

## Step 2 — Validate (MANDATORY — non-negotiable)

Read and follow: `${CLAUDE_SKILL_DIR}/steps/02-validate.md`

Invoke `validation-agent` with `$ARGUMENTS`. Even if the implementation-agent reports all local checks pass, you MUST run this. Do not skip due to time pressure or because unit tests are clean.

## Step 3 — Fix loop (max 3 rounds)

Read and follow: `${CLAUDE_SKILL_DIR}/steps/03-fix-loop.md`

If validation reports failures, hand the failure list back to `implementation-agent` for a fix pass, then re-validate. Track each round in a per-round table. After 3 failed rounds, escalate; do not attempt round 4.

## Step 4 — Code review

Read and follow: `${CLAUDE_SKILL_DIR}/steps/04-review.md`

Invoke `code-review-agent`. Verdict ∈ `{PASS, PASS WITH WARNINGS, BLOCKED}`. On BLOCKED, hand back to `implementation-agent` (max 2 rounds), then escalate if CRITICAL findings remain.

## Step 5 — Commit + PR

Read and follow: `${CLAUDE_SKILL_DIR}/steps/05-commit-pr.md`

Stage only files within PLAN.md scope. Never `git add -A` or `git add .`. Never push to `main`. Never force-push. Open PR with the structured template.

## Step 6 — Tracker completion

Read and follow: `${CLAUDE_SKILL_DIR}/steps/06-tracker-completion.md`

Invoke `issue-tracking-agent` to post PR link, branch, validation outcome, and review verdict on the parent Story.

## Final summary

```
IMPLEMENTATION COMPLETE
──────────────────────────────────────
Story:           $ARGUMENTS
Branch:          feature/$ARGUMENTS
PR:              <url>
Validation:      <P>/<P> passed in <N> rounds
Code review:     PASS | PASS WITH WARNINGS
Tracker:         {KEY-XX} updated
Files changed:   <count>
Lines:           +<add> / -<del>

Next: human merge after CI passes
```

## Sequence enforcement (read once)

| Rule | Reason |
|---|---|
| Implementation → Validation → Code review → Commit. Never reorder. | Validation depends on implementation; review depends on a tested artifact; commit depends on a reviewed diff. |
| Never accept BLOCKED hand-off from Step 1. | The agent's internal evidence pass returns BLOCKED only after 3 rounds of fix attempts. The orchestrator must surface `EVIDENCE-ESCALATION.md` to the user; bypassing into Step 2 with red evidence is what the gates exist to prevent. |
| Never skip Step 2. | Unit tests do not catch integration regressions; mocked tests do not match production. |
| Stop after 3 failed validation rounds. | A 4th round usually means the design is wrong. Escalate. |
| Stop after 2 BLOCKED review rounds with unresolved CRITICAL findings. | Re-implementation is not a workaround for an architectural flaw. |
| Never commit unsigned, unscoped, or pre-validation code. | Everything visible to humans must have passed every gate. |
