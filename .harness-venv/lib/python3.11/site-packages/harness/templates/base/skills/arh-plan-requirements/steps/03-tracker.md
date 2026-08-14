# Phase 3 — Tracker subtask (Plan Requirements)

Goal: mirror REQUIREMENTS.md to the configured issue tracker as a subtask under the parent story.

Mandatory when `provider != none` in `docs/config/issue-tracking.yaml`.

## Procedure

Invoke `issue-tracking-agent`:

- Operation: `upsert-subtask`
- Parent story key: from `docs/stories/$ARGUMENTS.md` traceability header
- Subtask name: `Plan Requirements: <story title>`
- Subtask body: full markdown content of `docs/features/$ARGUMENTS/REQUIREMENTS.md`
- Labels: `plan-requirements`, plus project labels

## After success

- Patch `docs/stories/$ARGUMENTS.md` traceability header: `**Tracker Plan Requirements:** {KEY-XX}`.
- Update state per `docs/state/SCHEMA.md § Writer rule`. `tracker_prd` is a
  **B-tier** field (mirrored). After this step:
  - PRIMARY write — `docs/features/$ARGUMENTS/state.json`:
    ```json
    { "tracker_prd": "<KEY-XX>", "last_updated": "<iso8601>" }
    ```
  - MIRROR write — `docs/state/features.json[$ARGUMENTS]`:
    ```json
    { "tracker_prd": "<KEY-XX>", "last_updated": "<iso8601>" }
    ```
  Status fields (`prd`, `phase`) are written in Phase 1 (artefact-creation time)
  and MUST NOT be overwritten here. The subtask key is a separate concern from
  PRD completion.

## Skip conditions (must be logged)

- `provider: none` → skip silently.
- Parent story has no tracker key → log and skip.
- MCP unavailable → log: `Tracker subtask FAILED — MCP unavailable. Re-run later.`
- Project has no subtask issue type → log: `Subtask type unavailable; PRD recorded locally only.`
