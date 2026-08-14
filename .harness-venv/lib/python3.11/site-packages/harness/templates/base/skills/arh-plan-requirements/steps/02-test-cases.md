# Phase 2 — Test cases

Goal: derive structured test cases from the ACs in REQUIREMENTS.md and write them to `docs/test-cases/$ARGUMENTS.json` with full traceability (`requirement_id`) and a machine-validated coverage audit.

## Procedure

1. Number every Functional Requirement in REQUIREMENTS.md as `<STORY-ID>-FR-<n>` (where `<n>` is the FR's order in the Functional Requirements section).
2. Number every Non-Functional Requirement with a numeric budget as `<STORY-ID>-NFR-<topic>` (e.g. `CHK-014-NFR-perf`, `CHK-014-NFR-security`).
3. Apply `test-case-generation` skill. Output JSON per its schema (see skill body for full reference):

```json
{
  "story_id": "$ARGUMENTS",
  "test_cases": [
    {
      "id": "$ARGUMENTS-TC-01",
      "title": "<one-line>",
      "type": "e2e | unit | integration | performance | security | contract",
      "automatable": true,
      "priority": "Must | Should | Could",
      "requirement_id": "$ARGUMENTS-FR-1",
      "given": "...",
      "when": "...",
      "then": "...",
      "tags": ["happy-path | edge-case | negative | regression-<bug-id>"]
    }
  ],
  "coverage_audit": {
    "functional_requirements": [
      {"id": "$ARGUMENTS-FR-1", "covered_by": ["$ARGUMENTS-TC-01", "$ARGUMENTS-TC-02"]}
    ],
    "non_functional_requirements": [
      {"id": "$ARGUMENTS-NFR-perf", "covered_by": ["$ARGUMENTS-TC-09"]}
    ],
    "uncovered": []
  }
}
```

## Coverage minimum (mandatory; gates Phase 4)

For every AC in REQUIREMENTS.md:

- One happy-path TC.
- One negative-path TC (if a meaningful negative exists).
- Boundary TCs for any numeric or temporal constraint.

For every NFR with a number:

- One TC of the matching type (`performance` for budget, `security` for threat, `contract` for API shape).

For every TC:

- Non-empty `requirement_id` referencing a real FR or NFR id.
- The id MUST appear in `coverage_audit.functional_requirements[].id` or `coverage_audit.non_functional_requirements[].id`.

## Coverage audit (mandatory)

After writing `test_cases`, the agent walks REQUIREMENTS.md FR/NFR ids and emits `coverage_audit`:

- `functional_requirements`: for each FR id, list the TCs covering it.
- `non_functional_requirements`: same for NFRs with budgets.
- `uncovered`: list of FR/NFR ids with zero TCs.

If `uncovered` is non-empty: agent self-corrects ONCE by generating the missing TCs, then re-runs the audit. If still uncovered after self-correction, escalate with: `Coverage gap: <ids>. Resolve before Product Gate.`

Phase 4 Product Gate gains an extra item:

```
[ ] Test-case coverage audit shows zero uncovered FR/NFR ids
```

## Cross-check with Scope Out:

Before adding a TC, the agent verifies the `requirement_id` is NOT in REQUIREMENTS.md `## Scope` → `Out:`. If a TC references an Out-scope item, surface a warning in the report. Out-scope items are NOT testable — they are deferred.

## Output report

Print:

```
Test cases generated: <N> total, <M> automatable
  Happy path:    <count>
  Edge case:     <count>
  Negative:      <count>
  Performance:   <count>
  Security:      <count>
Coverage audit:
  FRs:           <covered>/<total>
  NFRs (numeric):<covered>/<total>
  Uncovered ids: <list or "none">
File: docs/test-cases/$ARGUMENTS.json
```
