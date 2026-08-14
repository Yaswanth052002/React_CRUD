# Step 6 — Tracker completion

Goal: post a structured comment on the parent Story in the configured issue tracker so non-Claude readers can follow the work.

Skipped when `provider: none` in `docs/config/issue-tracking.yaml`.

## Procedure

Invoke `issue-tracking-agent` with:

- The parent Story key (read from `docs/stories/$ARGUMENTS.md` traceability header).
- The PR url + branch name.
- Validation summary (rounds + final pass/fail count).
- Code review verdict.
- Phase-state update.

## Comment body template

```
**Implementation complete**

- PR: <url>
- Branch: feature/$ARGUMENTS
- Validation: <P>/<TOTAL> passed in <N> round(s)
- Code review: <verdict>
- Files: <count> changed (+<add> / -<del>)

Awaiting human merge after CI passes.
```

## Phase-state update (tracker key only)

`tracker_review_comment` is P-tier (per `docs/state/SCHEMA.md`). Write to
`docs/features/$ARGUMENTS/state.json`:

```json
{
  "tracker_review_comment": "<COMMENT-ID>",
  "last_updated": "<iso8601>"
}
```

Also mirror `last_updated` to `docs/state/features.json[$ARGUMENTS]`.

Status fields (`impl`, `validation`, `review`, `phase`) are written in Step 5 (artefact-creation time) and MUST NOT be overwritten here. The tracker comment id is a separate concern from implementation completion.

## Edge cases

- Tracker MCP unavailable → log: `Tracker comment skipped (MCP unavailable). PR is the source of truth.`
- Story has no tracker key → log: `Story not synced; PR opened anyway.`
- Comment fails for permission reasons → escalate with the underlying error.
