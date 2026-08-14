# Round 2 — Users & Scope

> Skip this entire round silently if `rounds.2.completed == true`. Output: `(Round 2 skipped — already complete)` and continue to Round 3.

Output: `**Round 2 of {total_rounds} — Users & Scope**`

**Before asking:** Check `rounds.2.answers`. Remove from the question list any question whose answer is already present.

Use the `AskUserQuestion` tool to ask the remaining questions in a single call (all 4 if all unanswered):

| Header | Question |
|--------|----------|
| **Primary Persona** | Who is the primary user? Describe their role, when/how they encounter this product, their main goal, and their biggest pain point. |
| **Secondary Users** | Are there secondary users or internal stakeholders who interact with or are affected by this? List their roles and key needs. (Type "none" if there are none.) |
| **In Scope** | What is explicitly in scope for this version? List the core capabilities or user-facing features. |
| **Out of Scope** | What is explicitly out of scope for this version? What are you deliberately choosing NOT to include, and why? |

After receiving answers, briefly acknowledge the scope boundary in 1–2 sentences.

## Write Round 2 to Draft

Update `docs/prd/.wip/{slug}.json`:
- `rounds.2.completed = true`
- `rounds.2.answers` = all collected answers (merge with any existing answers)
- `last_completed_round = 2`
- `updated_at` = current ISO8601 timestamp
