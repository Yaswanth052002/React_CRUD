# Step 3 — Fix loop (max 3 rounds)

Goal: hand validation failures back to the implementation-agent as a structured bug report; re-validate after each fix pass; cap at 3 rounds. **Every fix pass produces at least one regression test.**

## Round procedure

For each round:

1. Build the failure list from the validation report. Each entry must include:
   - TC id
   - Steps executed
   - Expected vs actual
   - Screenshot path (if produced)
   - Failure reason
2. **Root cause first.** Apply the `root-cause-first` skill per failure — state `<cause> produces <symptom> because <mechanism>` before any fix; symptom-patching is rejected. Multi-component / deep-stack failures follow the instrumentation + backward-trace techniques in that skill.
3. Invoke `implementation-agent` with the FULL list (one pass — fix all failures), each fix targeting the stated root cause.
4. Constrain the agent: **do not touch test fixtures, test case JSON, or test assertions to make the failing flow pass**. Fix the code, not the tests.
5. **Regression-test requirement (G4)** — for every fixed failure, the agent must add or extend a test case:
   - New TCs use id `<STORY>-TC-<NN>` and tag `regression-<original-TC-id>` (e.g. tag `regression-TC-03` when fixing TC-03).
   - When extending an existing TC, document the new boundary in `then:` and add tag `regression-<original-TC-id>`.
   - Append the new/updated TC to `docs/test-cases/$ARGUMENTS.json` per the `test-case-generation` schema.
   - The agent re-runs `coverage_audit` after appending; `uncovered` must remain `[]`.
   - A fix without a corresponding regression-tagged TC is rejected — re-run the fix pass.
6. **ADR-contradiction check (G14)** — if the proposed fix contradicts a cited ADR, do NOT commit silently. Escalate to the user with options: write a new ADR superseding the old, re-scope the story, or accept the unfixed failure. The fix-loop pauses until the user responds.
7. After the agent reports done, re-invoke `validation-agent` (Step 2 procedure).
8. Append a row to the round table.

## Round table format

```
| Round | Failed TCs | Action                              | Result        |
|-------|------------|-------------------------------------|---------------|
| 1     | TC-03,07   | implementation-agent fix pass       | TC-03 ✓, TC-07 ⨯ |
| 2     | TC-07      | implementation-agent fix pass       | TC-07 ✓       |
```

## Stop conditions

- All TCs pass → continue to Step 4.
- Round 3 still has failures → **stop, and question the architecture — do not start round 4.** Per `root-cause-first` § "question the architecture": three failed fixes signals a wrong design, not a closer next fix. Write `docs/features/$ARGUMENTS/ESCALATION.md` framed as a DESIGN question — "is the PLAN / cited ADR sound, or are we patching symptoms?" — with the round table and per-round root-cause notes. Escalate to the user for an architecture decision, not another fix attempt.
- Implementation-agent reports the failure cannot be fixed without changing the spec → stop and escalate to the user; the design may be wrong.

## Anti-pattern

Never reduce test coverage, weaken assertions, mark a test `skip` / `todo`, or change the AC to make a flow pass. If a flow is genuinely broken because the AC is wrong, escalate to update the story; do not silently mutate the test.
