# Step 5 — Issue tracker sync

Goal: create issues in the configured issue tracker for every Validated story. Escalated stories do not sync. Skipped entirely when `provider: none`.

## Procedure

Read `docs/config/issue-tracking.yaml`.

**Sanity check before delegating (mandatory).** If `provider != none` but ANY required field is missing or holds a placeholder value (`TODO`, `FILL`, empty string, `null`, `<…>`), DO NOT silently skip. This means Step 0 was bypassed or the file was hand-edited mid-run.

Action when this happens:

1. Print loudly:
   ```
   Issue tracker: CANNOT SYNC — docs/config/issue-tracking.yaml has placeholder values for: <list of fields>.
   Re-run /arh-intake to trigger discovery, OR edit the file manually and re-run.
   ```
2. Update `docs/state/features.json` for each newly-validated story:
   `tracker_story: "pending:<reason>"` (e.g. `pending:config-incomplete`) — distinct from the success literal so `/arh-explain` and `/arh-trace` surface it.
3. Exit Step 5 with a non-zero summary; downstream phases still run, but stories carry the `pending:` literal until the operator fixes the config.

Only when the config is complete do you delegate to `issue-tracking-agent` with the list of Validated stories and the config.

The agent:

1. For each Epic-id in the RTM with at least one Validated story, ensure an Epic exists in the tracker (create or reuse by label).
2. For each Validated story, create the corresponding tracker issue:
   - Type: `story` (or `task` if `story` is unavailable for the project).
   - Parent / Epic link via `epic_story_link_field`.
   - Priority: derived from the story's MoSCoW field, mapped via `priorities` in config.
   - Labels: from `labels` config plus story-specific tags.
   - Body: link back to the story file path AND the doc tracker page URL when available.
3. Patch the story file's traceability header with the resulting tracker key + URL.
4. Append RTM rows with the tracker key column.

## Linear / GitHub Issues / Azure DevOps

Each provider has the same shape; the agent calls the matching MCP tools (`mcp__linear__createIssue`, `mcp__github__createIssue`, `mcp__ado__createWorkItem`).

## Output

```
Issue tracker:
  Epics:    <count>   ({KEY-XX} ...)
  Stories:  <count>   ({KEY-XX} ...)
```

## Edge cases

- A story already references an existing key in its header → idempotent: update body, do not create a duplicate.
- Project lacks Subtask issue type → log: phase subtasks created by `/arh-research`, `/arh-plan-requirements`, `/arh-plan-implementation` will be skipped.
- Rate limit hit → backoff with jitter, resume after the budget refreshes; never silently drop a story.
