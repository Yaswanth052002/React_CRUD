---
name: arh-refresh-graph
description: Refresh story status badges in the interactive dependency graph without re-inferring topology. Safe to run any time during implementation as stories move through statuses.
disable-model-invocation: true
allowed-tools: Read Bash
---
# /arh-refresh-graph

Refreshes `docs/program/dependency-graph-visual.html` with current story statuses, research
badges, and wave assignments. **Does not touch `dependency-list.md` or `wave-plan.md`.**
The dependency topology (edges, wave assignments, critical path) is locked from the previous
`/arh-plan-program` run and is never re-inferred here.

## Pre-flight

```bash
# Locked artifacts must exist — /arh-plan-program must have run first
if [[ ! -f "docs/program/dependency-list-reduced.md" ]]; then
  echo "ERROR: docs/program/dependency-list-reduced.md not found."
  echo "Run /arh-plan-program first to generate and lock the dependency topology."
  exit 1
fi

if [[ ! -f "docs/program/wave-plan.md" ]]; then
  echo "ERROR: docs/program/wave-plan.md not found."
  echo "Run /arh-plan-program first."
  exit 1
fi

if [[ ! -f "${CLAUDE_SKILL_DIR}/../arh-plan-program/templates/dependency-graph.html" ]]; then
  echo "ERROR: dependency-graph.html template not found at ${CLAUDE_SKILL_DIR}/../arh-plan-program/templates/"
  exit 1
fi
```

## Procedure

1. Run pre-flight checks above — exit on any failure.
2. Invoke the graph data script:
   ```bash
   python3 "${CLAUDE_SKILL_DIR}/../arh-plan-program/scripts/generate_graph_data.py" \
     --action "Graph refreshed on $(date -u +%Y-%m-%d\ %H:%M)"
   ```
3. If the script exits non-zero, stop and surface all errors to the user.
4. Verify output exists (post-completion check below) and report success.

## Post-completion Verification

```bash
if [[ ! -f "docs/program/dependency-graph-visual.html" ]]; then
  echo "ERROR: generate_graph_data.py did not write docs/program/dependency-graph-visual.html"
  exit 1
fi
echo "Graph refreshed. Reload docs/program/dependency-graph-visual.html in the browser."
```

## When to run

- After any story moves from `Validated` → `In Progress` → `Done`
- After running `/research-feature` on a new story (adds the `RES` badge)
- After `/arh-plan-program` completes (first render)
- Any time you want the graph to reflect current team progress

## What changes vs. what stays fixed

| Element | Refreshed | Stays locked |
|---|---|---|
| Node status badge (VAL/WIP/DON/…) | ✓ | |
| RES badge (research report exists) | ✓ | |
| WAV badge (wave-assigned) | ✓ | |
| Sidebar: Status, Effort, Research | ✓ | |
| Dependency edges (topology) | | ✓ |
| Wave assignments | | ✓ |
| Critical path | | ✓ |
| Sidebar: Wave, Depends On, Blocks | | ✓ |
