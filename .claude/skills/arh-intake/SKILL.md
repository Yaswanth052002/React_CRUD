---
name: arh-intake
description: Parse a requirement source (file / raw text / tracker / doc URL) into traced stories, validate them, and sync to the configured trackers. Auto-configures integrations on first run.
argument-hint: "<file-path | raw-text | tracker-key | doc-url>"
disable-model-invocation: true
allowed-tools: Read Write Edit Bash Grep
---
# /arh-intake — Main Orchestrator

Modular pipeline. Each phase delegates to a dedicated agent or sub-file. Execute in strict order. Never fail the entire pipeline because one integration is down.

**Input:** `$ARGUMENTS`

## Step 0 — Auto-configure integrations

Read and follow: `${CLAUDE_SKILL_DIR}/steps/00-auto-config.md`

**Output:** `docs/config/issue-tracking.yaml` and `docs/config/doc-tracker.yaml` populated for this project.

## Step 1 — Parse source into RTM

Read and follow: `${CLAUDE_SKILL_DIR}/steps/01-rtm.md`

Invoke `rtm-agent` with the raw input.

**Output:** `docs/requirements/RTM.md` plus the parsed hierarchy.

## Step 2 — Structure stories

Read and follow: `${CLAUDE_SKILL_DIR}/steps/02-stories.md`

For each Level-2 requirement, invoke `requirement-planner-agent` with RTM context.

**Output:** story files at `docs/stories/<EPIC>-<SEQ>.md`.

## Step 3 — Validate stories

Read and follow: `${CLAUDE_SKILL_DIR}/steps/03-validate.md`

For each story, invoke `story-validation-agent` with the story file and RTM.

**Output:** stories marked `Status: Validated` or `ESCALATED`.

## Step 4 — Doc tracker sync

Read and follow: `${CLAUDE_SKILL_DIR}/steps/04-doc-tracker-sync.md`

Sync RTM and validated stories to the configured doc tracker. Skipped if `doc_tracker = local`.

## Step 5 — Issue tracker sync

Read and follow: `${CLAUDE_SKILL_DIR}/steps/05-issue-tracker-sync.md`

Create Epics + Stories in the configured tracker for passing stories. Skipped if `issue_tracker = none`.

## Step 6 — Verify phase state

The state writes themselves happen in Step 2 (`story: draft`, on authoring) and Step 3
(`story: validated` / `escalated`, on rubric outcome) — those step files carry the exact
record shapes, and `docs/state/SCHEMA.md` is the canonical field reference. Do NOT
re-write records here.

Verify completeness: every processed story has an entry in `docs/state/features.json`
with `story`, `story_priority`, `story_independent_test`, `needs_clarification_count`,
`phase`, `last_updated` populated per SCHEMA.md. Any story missing its entry → re-run
the owning step before the Final summary.

## Final summary

Print this block exactly:

```
INTAKE COMPLETE
──────────────────────────────────────
Source:       {document name or "raw text"}
Config:       docs/config/issue-tracking.yaml, docs/config/doc-tracker.yaml
RTM:          docs/requirements/RTM.md ({N} requirements)
Doc tracker:  {page URL}  |  Skipped (local mode)

Stories:
  {EPIC}-{SEQ}: {Name}    {score}/100  →  {KEY-XX}  {URL}

Escalated:
  {EPIC}-{SEQ}: {Name}    {score}/100  →  {dimension} failed

Open questions:
  - ...

Next: /arh-research <STORY-ID>
```

## Error handling

| Failure point | Behaviour |
|---|---|
| Step 0 detects no MCP | Proceed in local mode; Steps 4–5 skip gracefully. |
| Step 1 produces zero requirements | Stop with: `No requirements could be parsed from $ARGUMENTS`. |
| Step 3 escalates ALL stories | Skip Steps 4–5; return the validation report. |
| Step 4 or Step 5 MCP unavailable | Log the failure, continue, surface in final summary. |
| Any single story fails one step | Continue with siblings; report at end. |
