# Step 3 — Validate stories

Goal: score every story drafted in Step 2 against the 6-dimension rubric. Self-correct on failure (max 3 rounds) before escalation.

## Procedure

For each story file written in Step 2:

1. Invoke `story-validation-agent` with the story file and the RTM.
2. The agent loads `requirement-validation` and applies the rubric.
3. On pass (total ≥ 80, no dim < 60): mark the story `Status: Validated` and continue.
4. On fail: hand back to `requirement-planner-agent` with the failing dimensions and a one-line directive per failed dim.
5. Re-validate. Repeat up to 3 rounds.
6. After 3 failed rounds: mark the story `Status: ESCALATED`. Capture the open issues for the final summary.

## Output

Each story header now reads `Status: Validated | ESCALATED`. The validation log is appended to the story file:

```
## Validation log

- 2026-05-01T10:32Z  v1  total=72  Testability=55 (FAIL)
- 2026-05-01T10:35Z  v2  total=86  PASS
```

## State write (mandatory, unconditional)

After each story's final rubric outcome, update `docs/state/features.json`:

**On PASS:**

```json
{
  "<EPIC>-<SEQ>": {
    "story": "validated",
    "phase": "story-validated",
    "last_updated": "<iso8601>"
  }
}
```

**On ESCALATED (3 failed rounds):**

```json
{
  "<EPIC>-<SEQ>": {
    "story": "escalated",
    "phase": "story",
    "last_updated": "<iso8601>"
  }
}
```

The `story` status drives `phase-preconditions` — `/arh-research <id>` requires
`state[id].story == "validated"`. Skipping this write leaves `/arh-research` blocked
even after a clean rubric pass.

## Aggregate report

After all stories validated, produce a one-line per story line for the final summary:

```
{EPIC}-{SEQ}: {Name}    {score}/100   PASS | ESCALATED ({reason})
```
