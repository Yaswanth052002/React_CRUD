# Step 4 — Code review

Goal: architectural / pattern / standards review of the diff before commit.

## Procedure

Invoke `code-review-agent` with `$ARGUMENTS`. The agent diffs the branch against `main` and produces `docs/features/$ARGUMENTS/REVIEW.md` with severity-ranked findings citing rule files.

## Verdict handling

`code-review-agent` returns one of:

| Verdict | Action |
|---|---|
| **PASS** | Continue to Step 5. |
| **PASS WITH WARNINGS** | Continue to Step 5; flag warnings in the PR body. |
| **BLOCKED** | Hand back to `implementation-agent` with the CRITICAL/HIGH findings; re-run code-review-agent. Cap at 2 BLOCKED rounds. |

## After 2 BLOCKED rounds

Stop. The architectural defect is unlikely to resolve via more fix passes. Write `docs/features/$ARGUMENTS/REVIEW-ESCALATION.md` with the unresolved findings and ask the user whether to:

- Re-scope: drop the offending tasks, re-plan a smaller change.
- Accept-with-ADR: write an ADR justifying the deviation, then re-run review.
- Pause: keep the branch open for human review without merge.

Never proceed to commit while CRITICAL findings remain.
