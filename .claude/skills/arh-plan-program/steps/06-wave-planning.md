> **Banner:** `▶ STEP 6/8 — WAVE PLANNING` — print this before any tool calls.

## Step 6 — Wave Planning

Run the deterministic wave planning script. Kahn's topological sort and longest-path DP
on the locked `dependency-list.md` guarantee identical output every time for the same input.

```bash
python3 "${CLAUDE_SKILL_DIR}/scripts/generate_wave_plan.py" \
  --date "$(date -u +%Y-%m-%d)"
```

If this exits non-zero, stop and surface all errors to the user:
- **Exit 1** — fatal error (missing input or cycle detected). A cycle means `dependency-list.md`
  contains a circular dependency that survived Steps 3–5. Surface the cycle to the user and
  ask them to remove one of the listed edges before re-running.

### Post-Step 6 Verification

```bash
if [[ ! -f "docs/program/wave-plan.md" ]]; then
  echo "ERROR: generate_wave_plan.py did not write docs/program/wave-plan.md"
  exit 1
fi
echo "Wave plan written."
grep "^| Waves" docs/program/wave-plan.md
grep "^\*\*Chain:" docs/program/wave-plan.md
```

### What the script computes (no LLM involved)

| Element | Algorithm |
|---|---|
| Wave assignment | Kahn's level-by-level BFS on HIGH edges only |
| Critical path | Longest-path DP; tie-break alphabetical — fully deterministic |
| MEDIUM edges | Scheduling notes only — never block wave start |
| Risk register | Rule-based: CROSS_EPIC, UNVALIDATED_DEP, BROKEN_REF, CONFLICT, EXTERNAL_DEP |

Same `dependency-list.md` → identical `wave-plan.md` every run.
