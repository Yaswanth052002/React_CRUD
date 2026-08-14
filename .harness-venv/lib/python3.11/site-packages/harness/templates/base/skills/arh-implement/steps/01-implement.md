# Step 1 — Implement tasks

Goal: convert PLAN.md tasks into code, one task at a time, running local checks per task. Persist progress to state after each task so the implementation can resume after interrupt.

## Procedure

Invoke `implementation-agent` with `$ARGUMENTS`. The agent:

1. Reads `docs/features/$ARGUMENTS/PLAN.md` and the resume-pointer set by Step 0 (`impl_tasks` first non-done row).
2. For every task in order, starting from the resume pointer:
   - Implements only what the task scopes — no opportunistic refactors. Obeys the `surgical-changes` rule.
   - Honors every ADR loaded in Step 0. Code contradicting an ADR escalates to the user; it does NOT proceed silently.
   - Obeys the active project rules for the file globs touched.
   - Runs the project's typecheck / test / lint commands from `docs/config/project-commands.yaml`.
   - Fixes any failure before moving on. Does not progress with red checks.
3. **After each task completes**, appends that task's row to `docs/features/$ARGUMENTS/state.json` at `.impl_tasks` (P-tier; no index mirror) for G2 persistence:
   ```json
   {
     "task_id": "T-01",
     "status": "done | blocked | skipped",
     "completed_at": "<iso8601>",
     "files_touched": ["src/foo.ts", "src/bar.ts"],
     "reason": "<only when status != done>"
   }
   ```
   This persistence enables `--resume` after crash, interrupt, or session end.

## Constraints

- **Never** push, amend, or open a PR in this step. Step 5 owns commit/PR.
- **Never** edit files outside the PLAN.md scope without asking the user.
- **Never** introduce a feature flag or backwards-compat shim that was not in PLAN.md.
- **Never** suppress lint or typecheck output ("// @ts-ignore" without comment, `# noqa` without reason).
- **Never** improve adjacent code, fix unrelated bugs, or reformat untouched regions. See the `surgical-changes` rule.
- **Always** carry-forward unrelated issues to the PR body `## Carry-forward` section; never inline-fix them.
- **Never** stop a task to ping the PO for one ambiguity. Queue mid-stream questions to `docs/features/$ARGUMENTS/QUESTIONS.md` (see implementation-agent procedure step 2 "On ambiguity") and let the end-of-session `/arh-clarify` bundle them.
- **Never** bury an observation in chat output. Queue mid-stream observations to `docs/features/$ARGUMENTS/FLAGS.md` (see implementation-agent procedure step 2 "On observation") and let the end-of-session `/arh-human-review` walk the engineer through them.

## End-of-session clarification round

When the agent finishes (every task done, OR a task is `blocked`, OR the session is being suspended), check `docs/features/$ARGUMENTS/QUESTIONS.md`:

- File missing OR empty (only comments / blank lines) → no clarification round needed. Continue to the evidence pass below.
- File has ≥1 question line → invoke `/arh-clarify $ARGUMENTS`. This bundles every queued question into one PO-facing round and posts a single tracker comment. The orchestrator does NOT proceed to Step 2 (validate) until the PO answers and the engineer runs `/arh-clarify $ARGUMENTS --apply`. Status update on hand-off: `BLOCKED on CLARIFY-<round>.md — <N> questions awaiting PO`.

This replaces the anti-pattern of N tracker-pings per session and the worse anti-pattern of silent guesses.

## End-of-session evidence pass (handover receipt)

After the clarification check, BEFORE returning to the `/arh-implement` orchestrator for Step 2, the implementation-agent runs the six-dimension evidence pass per the `evidence-pass` skill — full procedure, the max 3 rounds internal fix loop, state-record shape, and anti-suppression rules all live in `evidence-pass` skill. Internal to Step 1; the orchestrator never sees a partial result.

- **READY** (all six dimensions PASS or accepted-N/A) → continue to flag triage below.
- **BLOCKED** (round-3 escalation) → `evidence-pass` writes `EVIDENCE-ESCALATION.md` and the final FAIL `impl_evidence`; stop.

State write (`.impl_evidence`, P-tier) happens inside `evidence-pass`. Step 2's precondition reads `impl_evidence` from state; on BLOCKED it refuses to start, and the same record blocks Step 5 (commit-PR) via RC5. Gates are agnostic to where the evidence ran — they only read state.

## End-of-session flag triage

After the evidence pass has written its receipt (so FLAGS.md contains both the implementation-agent's Step 2 "On observation" entries AND any `evidence-na` blocks the evidence pass just appended), check `docs/features/$ARGUMENTS/FLAGS.md`:

- File missing OR every block is a `<!-- ... triaged ... -->` comment → no triage round needed. Continue to Step 2.
- File has ≥1 `### AF-NN:` block that is NOT yet triaged → prompt the engineer: `<N> agent flags raised this session. Run /arh-human-review $ARGUMENTS to triage before commit-PR? [y/N]`. On `y`, invoke `/arh-human-review $ARGUMENTS`. On `n`, continue to Step 2 — but Step 5 (commit-PR) will refuse to run while flags remain `status: open`, so the engineer will be forced to triage eventually.

This is the second of two "did you see what the agent saw?" gates. Clarifications surface things the agent COULD NOT decide; flags surface things the agent DECIDED but wants the engineer to know about. The check must run AFTER the evidence pass so that `evidence-na` flags raised for N/A dimensions are visible to the prompt — running it earlier means those flags exist on disk but never get offered for triage, and the engineer discovers them only when a downstream gate blocks.

## Output

```
Implementation: <N>/<N> tasks
  ✓ task-01  Add /promo-codes endpoint        (lint clean, types clean, unit tests green)
  ✓ task-02  Wire endpoint into checkout flow ...
  ⨯ task-04  Edge case in promo expiry        (blocked: missing fixture; see report)

Evidence packet (docs/features/$ARGUMENTS/evidence/) — rounds: 1
  Typecheck     PASS  typecheck.log    mypy src/ — 0 errors
  Unit tests    PASS  unit-tests.log   pytest -q — 24/24 green
  Lint          PASS  lint.log         ruff check — 0 errors
  Runtime       PASS  runtime-api.log  uvicorn — /health 200, boot log clean
  Compile       N/A   AF-09 raised     interpreted language — please confirm N/A
  Design        N/A   AF-10 raised     no frontend stack declared — please confirm N/A

Status: READY. Handing back to /arh-implement → Step 2.
```

If any task is `blocked`, surface the reason and ask the user before running the evidence pass.

If the evidence pass returns BLOCKED after 3 rounds, surface `EVIDENCE-ESCALATION.md` and stop. The orchestrator's Step 2 precondition will refuse to start; do not try to bypass.
