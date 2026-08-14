# Clarification Rounds

The orchestrator runs clarification rounds directly — no sub-agent. This section defines the rules.

---

## Purpose

Ask the user only what the reference material could not answer. Never assume. Never invent.

---

## Pre-round setup

Load the gap report from `gaps_path` in the draft state (`docs/prd/.wip/{slug}.json`). Do not hard-code the filename — always read the path from the draft to stay consistent with the draft-state contract.

Filter to sections where `score` is `PARTIAL` or `MISSING` and `gap_id` is not null.

Sort gaps by `clarification_priority` ascending (1 first).

If `total_gaps == 0`: skip all rounds. Output:
```
No clarification needed — reference material covers all required PRD sections.
Proceeding to generation.
```

---

## Round rules

1. **Maximum 3 rounds.** After round 3, any remaining gaps become `{TBD}` in the final PRD.
2. **Batch ≤4 questions per round.** Use a single `AskUserQuestion` call per batch.
3. **Ask highest-priority gaps first.** Always exhaust priority 1 before moving to priority 2, etc.
4. **Never assume.** If the user's answer is ambiguous, ask a follow-up in the next round. Do not interpret charitably and proceed.
5. **Never re-ask an answered question.** Check `clarification_answers` in the draft before each round.
6. **Partial answers are valid.** If the user says "I don't know" or "TBD", accept it and mark that gap as `{TBD}`.
7. **Show progress.** Open each round with:
   ```
   **Clarification Round {N} of {max 3} — {N} questions**
   These questions cover gaps the reference material could not answer.
   ```

---

## Round loop

```
WHILE rounds_completed < 3 AND remaining_gaps > 0:

  Take the next batch of up to 4 gaps (by priority order).

  Build AskUserQuestion call:
    - header: the section label (e.g. "Primary Persona")
    - question: the clarification_question from the gap report

  After user answers:
    - For each answered gap_id, write the answer to clarification_answers in the draft
    - Mark that gap as resolved — remove from remaining_gaps
    - Update updated_at in draft

  rounds_completed += 1
  Write draft state.

  IF remaining_gaps == 0: break
```

---

## After round 3

If gaps remain unresolved after round 3, output:

```
**Clarification complete (3 rounds reached)**

The following sections could not be resolved from reference material or your answers.
They will appear as `{TBD}` in the PRD — fill them in before seeking stakeholder approval:

{list each unresolved gap_id with its section label}
```

Write all unresolved gap IDs with value `"{TBD}"` into `clarification_answers` in the draft.

---

## After all rounds

Output a summary before proceeding to generation:

```
**Clarification complete — {N} gaps resolved, {M} marked {TBD}**

Here is what I'll use to write the PRD:
{For each priority-1 gap: "• {section label}: {one-line summary of answer or TBD}"}

Proceeding to PRD generation...
```
