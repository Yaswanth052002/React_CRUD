> **Banner:** `▶ STEP 8/8 — GANTT CHART` — print this before any tool calls.

## Step 8 — Wave Gantt Chart

> IMPORTANT: Do NOT pass `isolation: "worktree"` when invoking this agent.
> All outputs must be written to the main working tree as files on disk.
> Do NOT invoke any further skills or tools after the verification check below.

### 8a — Generate Gantt HTML

```bash
python3 "${CLAUDE_SKILL_DIR}/scripts/generate_gantt.py"
```

If this exits non-zero, stop and surface all errors to the user.

This reads `docs/program/wave-plan.md` and produces `docs/program/wave-gantt.html` — a
self-contained interactive Gantt chart organised by delivery wave. No internet connection
required. Critical-path stories are parsed from the **Chain:** line in wave-plan.md.

To update `progress` for a story once work begins, edit the `progress` field (0–100) in
`wave-gantt.html`'s embedded `STORIES` array, or re-run with an updated wave-plan.md.

### Post-Step 8 Verification

```bash
if [[ ! -f "docs/program/wave-gantt.html" ]]; then
  echo "ERROR: generate_gantt.py did not write docs/program/wave-gantt.html"
  exit 1
fi
```

**Pipeline complete. Stop here. Print the completion summary from the main skill and take no further actions.**
