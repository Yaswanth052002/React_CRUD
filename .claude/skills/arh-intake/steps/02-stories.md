# Step 2 — Structure stories

Goal: turn each Level-2 row in the RTM into a fully-structured story file conforming to the canonical story template.

## Procedure

For each Level-2 requirement in `docs/requirements/RTM.md`:

1. Invoke `requirement-planner-agent` with the row plus surrounding context (parent epic, sibling stories).
2. The agent loads `story-template` and `requirement-tracing`.
3. Output: `docs/stories/<EPIC>-<SEQ>.md` per the canonical template.
4. Append the story to the RTM `Story File` column (so the RTM stays the index). RTM also carries a `Source` column populated by `/arh-import` for imported rows; `/arh-intake`-created rows leave it blank.

## Field requirements (per story-template)

- Epic id, status (`Draft`), owner, updated date.
- User story sentence: *As a … I want … so that …*.
- Acceptance criteria (Given/When/Then), at minimum two.
- NFR section with concrete numbers (no "fast" / "secure").
- Dependencies (upstream and downstream).
- Test mapping (E2E / unit / manual paths).

## State write (mandatory, unconditional)

After writing each `docs/stories/<EPIC>-<SEQ>.md`, the agent updates
`docs/state/features.json` for that id with these fields:

```json
{
  "<EPIC>-<SEQ>": {
    "story": "draft",
    "story_priority": "<P1|P2|P3>",
    "story_independent_test": <bool>,
    "needs_clarification_count": <int>,
    "rtm_source_sha": "<git rev-parse HEAD at write time>",
    "phase": "story",
    "last_updated": "<iso8601>"
  }
}
```

State file is local truth. The `story` field is a STATUS literal (`draft`,
`validated`, `escalated`, or `imported:<source>`) — never a tracker key. The
tracker key (when issue-tracker is configured) is written by Step 5 into a
separate `tracker_story` field.

If `docs/state/features.json` does not exist yet, create it with `{}` first.

When this row was created from `/arh-import`, write `"story": "imported:<source>"`
instead of `"draft"` and skip the rubric run in Step 3.

## Edge cases

- A Level-2 row is too vague to draft a story → mark the RTM row `BLOCKED` with the reason and skip Steps 3–5 for that row.
- A row maps to >1 story (compound requirement) → split into sub-rows (`<EPIC>-<SEQ>.<sub>`) and structure each.
- An existing story file has manual edits since last intake → diff and present the conflict, do not overwrite silently.
