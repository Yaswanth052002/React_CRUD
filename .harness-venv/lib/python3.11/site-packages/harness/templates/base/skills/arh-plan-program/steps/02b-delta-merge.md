> **Banner:** `▶ STEP 2b — DELTA MERGE` — print this before any tool calls (only shown on re-runs; skip silently if Step 2b is skipped).

## Step 2b — Delta Merge

Merge newly inferred delta edges with the locked edges from `dependency-list.lock`.
Produces the full `dependency-list.md` that Steps 3–6 read.

> Skip this step if: `SKIP_INFERENCE=true` OR no lock exists (first run).
> On first run, `dependency-list.md` was written directly by Step 2 — no merge needed.

```bash
# Skip if no lock (first run) or nothing to merge
if [[ "${SKIP_INFERENCE}" == "true" ]] || [[ ! -f "docs/program/dependency-list.lock" ]]; then
  echo "Step 2b skipped."
  exit 0
fi

python3 "${CLAUDE_SKILL_DIR}/scripts/merge_edges.py"
MERGE_EXIT=$?

if [[ $MERGE_EXIT -eq 1 ]]; then
  echo "ERROR: merge_edges.py failed — cannot produce dependency-list.md."
  exit 1
elif [[ $MERGE_EXIT -eq 2 ]]; then
  echo ""
  echo "MERGE CONFLICTS DETECTED"
  echo "  Some edges that existed in the lock were not found after re-inference."
  echo "  These will be surfaced during Step 5 human review for a decision."
  echo "  Proceeding to Steps 3–4 (validation will run on the merged list)."
  echo ""
  # Surface the conflict summary now so the human is aware before Step 5
  python3 -c "
import json
with open('docs/program/.merge-conflicts.json') as f:
    data = json.load(f)
conflicts = data.get('conflicts', [])
high = [c for c in conflicts if c['type'] == 'DROPPED_HIGH']
med  = [c for c in conflicts if c['type'] == 'DROPPED_MEDIUM']
print(f'  {len(high)} HIGH edge(s) dropped:')
for c in high:
    print(f'    ⚠  {c[\"edge\"]}')
print(f'  {len(med)} MEDIUM edge(s) dropped:')
for c in med:
    print(f'    ↓  {c[\"edge\"]}')
"
fi
```

### Post-Step 2b Verification

```bash
if [[ ! -f "docs/program/dependency-list.md" ]]; then
  echo "ERROR: merge_edges.py did not write docs/program/dependency-list.md"
  exit 1
fi
echo "Merged dependency-list.md ready for Steps 3–4."
```

### What merge_edges.py does

| Edge pair | Action |
|---|---|
| Both stories unchanged | Carry locked edge forward — no LLM cost |
| At least one story changed/new, edge in delta | Use newly inferred edge |
| At least one story changed/new, edge NOT in delta | Flag as conflict for Step 5 |

Conflicts are written to `docs/program/.merge-conflicts.json` and surfaced at Step 5
alongside structural and adversarial findings.
