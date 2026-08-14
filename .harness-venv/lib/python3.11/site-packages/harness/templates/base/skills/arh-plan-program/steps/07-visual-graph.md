> **Banner:** `▶ STEP 7/8 — VISUAL GRAPH` — print this before any tool calls.

> IMPORTANT: Do NOT pass `isolation: "worktree"` when invoking this agent.
> All artifacts must be written to the main working tree.
> Do NOT call the Artifact tool. Write files to disk only.

## Step 7 — Interactive Dependency Graph

Generate an interactive HTML graph with story status badges, click-triggered sidebar, and metadata bar showing critical path and program health.

### 7a — Upstream coverage self-check

For each story, count explicit upstream story-ID mentions in the story file and
compare against incoming edges in `dependency-list.md`. A story with fewer incoming
edges than upstream mentions means a direct edge was dropped.

```bash
python3 ${CLAUDE_SKILL_DIR}/scripts/check_upstream_coverage.py
```

- **Exit 1 (gaps found):** surface the mismatches to the user — show the story ID,
  what it mentions as upstream, and which IDs are missing from the edge list.
  The user must either add the missing edges to `dependency-list.md` or confirm the
  mention was intentionally non-dependency text. Do not proceed to graph generation
  until resolved or explicitly waived by the user.
- **Exit 0:** continue.

Results are appended to `docs/program/dependency-validation-report.md` for traceability.

### 7b — Generate the interactive graph

```bash
python3 ${CLAUDE_SKILL_DIR}/scripts/generate_graph_data.py \
  --action "Plan Program complete on $(date -u +%Y-%m-%d\ %H:%M)"
```

If this exits non-zero, stop and surface all errors to the user.

The script reads the static template, inlines all node/edge/meta data, and writes
the self-contained `docs/program/dependency-graph-visual.html`. Data is inlined
directly — no external JS file, works on `file://` without a local server.

`dependsOn` and `blocks` are derived by inverting the edge list in code — no LLM
inference, no story-file dependency sections required.

**Data vs display:** every edge from `dependency-list.md` is stored in each node's
`dependsOn`/`blocks` arrays — used for blast-radius analysis, sidebar, and scheduling.
The rendered arrows apply a visual-only transitive reduction to reduce clutter; this
does not affect the underlying data. Do NOT remove edges from `dependency-list.md`
because a transitive path covers them — that is a data decision, not a display one.

To update the graph after stories change status, run `/arh-refresh-graph`.

### Post-Step 7 Verification

```bash
if [[ ! -f "docs/program/dependency-graph-visual.html" ]]; then
  echo "ERROR: generate_graph_data.py did not write docs/program/dependency-graph-visual.html"
  exit 1
fi
echo "✓ Interactive dependency graph ready: docs/program/dependency-graph-visual.html"
```
