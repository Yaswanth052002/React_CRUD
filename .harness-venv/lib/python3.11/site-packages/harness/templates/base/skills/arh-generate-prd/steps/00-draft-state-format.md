# Draft State Format

The draft state file is written to `docs/prd/.wip/{slug}.json` and updated after every phase transition.

## Schema

```json
{
  "slug": "{slug}",
  "product_name": "{product name}",
  "workflow_type": "qa | reference",
  "status": "in_progress | clarifying | generating | complete",
  "reference_folder": "{path to reference-material folder, or null for Q&A mode}",
  "manifest_path": "{path to manifest JSON, or null if not yet created}",
  "extraction_path": "{path to extraction JSON, or null}",
  "gaps_path": "{path to gaps JSON, or null}",
  "last_completed_phase": 0,
  "clarification_rounds_completed": 0,
  "clarification_answers": {},
  "contributors": ["{git user name}"],
  "created_at": "{ISO8601}",
  "updated_at": "{ISO8601}"
}
```

## Phase values for `last_completed_phase`

| Value | Meaning |
|-------|---------|
| 0 | Pre-flight only — no phases complete |
| 1 | Reference ingestion complete |
| 2 | Gap analysis complete |
| 3 | Clarification complete |
| 4 | PRD generation complete |

## `clarification_answers` shape

Keys are gap IDs from the gaps JSON. Values are the user's answer strings.

```json
{
  "clarification_answers": {
    "gap-product-name": "{product name}",
    "gap-primary-persona": "{persona role and description}"
  }
}
```

## Write rules

- Write after Phase 0 routing (session init) — include `workflow_type: "qa"` or `workflow_type: "reference"`
- Write after pre-flight (phase 0 init) — `status: "in_progress"`
- After Phase 1 completes — update `last_completed_phase`, `extraction_path`, `updated_at`
- After Phase 2 completes — update `last_completed_phase`, `gaps_path`, `updated_at`
- When Phase 3 begins — set `status: "clarifying"`
- After each clarification round — append to `clarification_answers`, update `clarification_rounds_completed`, `updated_at`
- When Phase 4 begins — set `status: "generating"`
- After Phase 4 completes — set `last_completed_phase = 4`, `status: "complete"`, `updated_at`
- Append clarification answers — never overwrite prior answers
- Do NOT delete draft files until PRD is verified written
