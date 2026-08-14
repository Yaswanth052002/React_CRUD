> **Banner:** `▶ STEP 1/8 — PRE-FLIGHT` — print this before any tool calls.

## Step 1 — Pre-flight

Run the following checks before invoking any agents:

```bash
# 1. RTM must exist
if [[ ! -f "docs/requirements/RTM.md" ]]; then
  echo "ERROR: docs/requirements/RTM.md not found."
  echo "Run /intake-requirement first to parse the PRD and create story files."
  exit 1
fi

# 2. At least one story file must exist
STORY_COUNT=$(find docs/stories -name "*.md" 2>/dev/null | wc -l | tr -d ' ')
if [[ "$STORY_COUNT" -eq 0 ]]; then
  echo "ERROR: No story files found in docs/stories/."
  echo "Run /intake-requirement first."
  exit 1
fi

# 3. HARD GATE — all stories must be Validated or beyond
DRAFT_COUNT=$(grep -rl "^\*\*Status:\*\* Draft\|^\*\*Status:\*\* In Review" docs/stories/ 2>/dev/null | wc -l | tr -d ' ')
if [[ "$DRAFT_COUNT" -gt 0 ]]; then
  echo "ERROR: ${DRAFT_COUNT} story/stories have status Draft or In Review."
  echo ""
  echo "  /arh-plan-program runs once per release, after all stories are certified."
  echo "  Run /validate-story on each uncertified story first, then re-run /arh-plan-program."
  echo ""
  grep -rl "^\*\*Status:\*\* Draft\|^\*\*Status:\*\* In Review" docs/stories/ 2>/dev/null \
    | xargs grep -l "" | while read f; do
        ID=$(basename "$f" | grep -oE '^[A-Z]+-[0-9]+')
        STATUS=$(grep "^\*\*Status:\*\*" "$f" | head -1 | sed 's/\*\*Status:\*\* //')
        echo "  → ${ID}: ${STATUS}"
      done
  exit 1
fi

# 4. Check if topology is already locked (warn on re-run)
RERUN_WARNING=false
if [[ -f "docs/program/dependency-list.md" ]]; then
  HEADER_COUNT=$(grep -c "^# Program — Dependency List" docs/program/dependency-list.md 2>/dev/null || echo 0)
  if [[ "$HEADER_COUNT" -gt 0 ]]; then
    RERUN_WARNING=true
  fi
fi
echo "RERUN_WARNING=${RERUN_WARNING}"

# 5. Create output directory
mkdir -p docs/program

# 6. Check change classification against lock
python3 "${CLAUDE_SKILL_DIR}/scripts/classify_changes.py"
CLASSIFY_EXIT=$?

if [[ $CLASSIFY_EXIT -eq 2 ]]; then
  echo ""
  echo "All ${STORY_COUNT} stories unchanged since last lock."
  echo "Steps 2–4 (inference + validation) will be skipped."
  echo "Proceeding directly to Step 6 (Wave Planning)."
  SKIP_INFERENCE=true
elif [[ $CLASSIFY_EXIT -eq 0 ]]; then
  SKIP_INFERENCE=false
else
  echo "ERROR: classify_changes.py failed."
  exit 1
fi
```

Report the pre-flight result:

```
PRE-FLIGHT
──────────────────────────────
RTM:                docs/requirements/RTM.md
Stories found:      {STORY_COUNT} (all Validated or beyond)
Output dir:         docs/program/
Change detection:   {unchanged} unchanged / {changed} changed / {new} new
                    {if SKIP_INFERENCE: "→ All cached — skipping Steps 2–4"}
                    {else: "→ Inference required for {N} stories"}
```

If RTM or stories are missing, or any stories are uncertified, stop.

If `RERUN_WARNING=true`, pause before the classify step and use `AskUserQuestion`:

- **header**: `"Re-run warning"`
- **question**: `"A signed-off dependency-list.md already exists. Re-running /arh-plan-program will re-infer all edges and require a new human sign-off. Continue?"`
- **multiSelect**: `false`
- **options**:
  1. label: `"Continue"` — description: `"Re-infer all edges and obtain new sign-off at Step 5"`
  2. label: `"Cancel"` — description: `"Stop here — run /arh-refresh-graph to update status badges without re-inferring topology"`

If the user selects `"Cancel"`, stop immediately with:
```
Cancelled. Run /arh-refresh-graph to update node status without re-inferring topology.
```

Only after `"Continue"` is selected (or `RERUN_WARNING=false`): run the classify step and proceed.
If `SKIP_INFERENCE=true`, jump directly to Step 6 — do not invoke Steps 2–5. The existing lock is still valid (no stories changed since it was signed off).
