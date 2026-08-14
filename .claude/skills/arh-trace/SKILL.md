---
name: arh-trace
description: Refresh the Requirements Traceability Matrix or verify it against current code state. --verify re-derives source SHAs and flags stale rows.
argument-hint: "[--verify] [--apply]"
disable-model-invocation: true
allowed-tools: Read Write Edit Grep Bash
---
# /arh-trace

Two modes:

- **`/arh-trace`** (default) — refresh `docs/requirements/RTM.md`.
- **`/arh-trace --verify`** — verify RTM rows still match current git state and tracker keys still resolve.

## Default mode (refresh)

Delegate to `rtm-agent`. The agent:

1. Walks `docs/stories/` and `docs/features/`.
2. Reconstructs the RTM table preserving manual notes.
3. Cross-checks every row against the configured issue tracker.
4. Reports drift: stories without RTM rows, RTM rows without source.
5. Records `rtm_source_sha` (current `git rev-parse HEAD` at row creation time) on every NEW row in `docs/state/features.json` (index) and mirrors to `docs/features/<id>/state.json` once the per-feature file exists (post-plan).

## Verify mode

Invocation: `/arh-trace --verify` (read-only). Add `--apply` to write fixes for resolvable drift.

Delegate to `rtm-agent` with verify flag. The agent:

1. Reads every row in `docs/requirements/RTM.md` plus its mirror in `docs/state/features.json` (index). For per-feature deep state (post-plan rows), reads `docs/features/<id>/state.json` when present.
2. For each row with a stored `rtm_source_sha`:
   - `git log --oneline <sha>..HEAD -- <story file path>` — has the story been modified since? If yes, the row may be stale.
   - Re-derive a fresh SHA from current state. Note the diff.
3. For each row with a `tracker_story` key:
   - Call `mcp__atlassian__get_issue` (or `mcp__linear__getIssue`, etc.) to confirm the key still resolves.
   - 404 → row references a deleted/moved tracker issue; flag.
   - Status changed since last sync (older than `last_synced_at` by >7 days) → flag as stale.
4. For each story file under `docs/stories/`:
   - Confirm a matching RTM row exists. Missing → flag (`story not in RTM`).
5. For each RTM row:
   - Confirm `**Source**:` link resolves (file path exists OR tracker key valid).
   - Broken link → flag.

## Output (verify mode)

```
RTM VERIFY — <count> rows checked
─────────────────────────────────────────
✓ <count> rows verified clean
⚠ <count> rows stale (story modified since rtm_source_sha)
⚠ <count> rows tracker-stale (>7d since last_synced_at)
⨯ <count> rows broken (tracker 404 or source link missing)

Stale rows:
  CHK-014  story modified at HEAD (was <old-sha>); re-run /arh-trace to refresh.
  CHK-018  tracker ACME-87 last synced 11d ago; consider /arh-sync.

Broken rows:
  CHK-022  tracker ACME-91 returned 404 — issue moved or deleted.
  CHK-027  source link points to docs/legacy/foo.md (file missing).

Run /arh-trace --apply to refresh stale rows. Broken rows require human review.
```

## When to run

- Before /arh-plan-implementation if the source story was edited since /arh-research.
- After a sprint to detect rows that drifted out of sync with the tracker.
- In CI nightly: `harness audit --strict` should call `/arh-trace --verify` and fail on broken rows.

## Anti-patterns

- Do not auto-apply fixes for tracker-stale rows; the tracker may be the source of truth and harness must pull (use `/arh-sync` instead).
- Do not delete RTM rows whose `rtm_source_sha` mismatches; the row may be valid but the story file shifted. Always offer a refresh before delete.
