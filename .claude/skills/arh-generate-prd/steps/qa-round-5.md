# Round 5 — Ownership & Sign-off

> Skip this entire round silently if `rounds.5.completed == true`. Output: `(Round 5 skipped — already complete)` and continue to compiling context.

Output: `**Round 5 of {total_rounds} — Ownership & Sign-off**`

**Before asking:** Check `rounds.5.answers`. Remove any already-answered questions.

**Q1–Q2 — always ask (unless answered):**

| Header | Question |
|--------|----------|
| **Author** | Who is the author of this PRD? (Name and role.) |
| **Approvers** | Who needs to approve this PRD before development begins? List name and role for each approver — typically Product Owner, Engineering Lead, Design Lead. |

**Q3 — Confidentiality (conditional):**
- If the context clearly indicates an internal product with no external distribution, output: *"Defaulting to **Internal** confidentiality. Confirm or change:"* and ask with options: `Confirm Internal` / `Confidential` / `Public`.
- Otherwise ask as an open question alongside Q1–Q2.

Use the `AskUserQuestion` tool to ask all applicable questions. If Q1–Q2 are unanswered and Q3 needs confirmation, ask Q1–Q2 first in one call, then Q3 in a second call.

## Write Round 5 to Draft

Update `docs/prd/.wip/{slug}.json`:
- `rounds.5.completed = true`
- `rounds.5.answers` = all collected answers
- `last_completed_round = 5`
- `status = "ready_for_agent"`
- `updated_at` = current ISO8601 timestamp
