> **Banner:** `▶ STEP 5/8 — HUMAN REVIEW` — print this before displaying the review table.

> IMPORTANT: This is the only blocking step in the pipeline. Do not proceed to Step 6 (Wave Planning) until the user explicitly signs off.

## Step 5 — Human Review Gate

Presents all findings from Step 3 (structural validation) and Step 4 (adversarial validation) in one pass. The `## FLAGGED` section of `docs/program/dependency-validation-report.md` contains both.

### 5a — Check for flagged items

```bash
if [[ ! -f "docs/program/dependency-validation-report.md" ]]; then
  echo "ERROR: docs/program/dependency-validation-report.md not found."
  echo "Step 3 (structural validation) must run before Step 5."
  exit 1
fi

# Extract the total FLAGGED count from the report header table
FLAGGED_COUNT=$(grep -m1 "^| FLAGGED" docs/program/dependency-validation-report.md | awk -F'|' '{print $3}' | tr -d ' ')
if ! [[ "${FLAGGED_COUNT}" =~ ^[0-9]+$ ]]; then
  echo "WARNING: FLAGGED count is '${FLAGGED_COUNT}' (not numeric) — defaulting to 0. Step 4 may not have updated the report header."
  FLAGGED_COUNT=0
fi
echo "Total items flagged for review: ${FLAGGED_COUNT}"

# Check for merge conflicts from Step 2b (scoped re-inference)
MERGE_CONFLICTS=0
if [[ -f "docs/program/.merge-conflicts.json" ]]; then
  MERGE_CONFLICTS=$(python3 -c "
import json
with open('docs/program/.merge-conflicts.json') as f:
    data = json.load(f)
print(len(data.get('conflicts', [])))
" 2>/dev/null || echo 0)
  if [[ "$MERGE_CONFLICTS" -gt 0 ]]; then
    echo ""
    echo "MERGE CONFLICTS: ${MERGE_CONFLICTS} edge(s) dropped by re-inference — add to review."
    python3 -c "
import json
with open('docs/program/.merge-conflicts.json') as f:
    data = json.load(f)
for c in data.get('conflicts', []):
    sev = '🔴' if c['type'] == 'DROPPED_HIGH' else '🟡'
    print(f'  {sev} {c[\"edge\"]}  ({c[\"was\"]} → not inferred)  — {c[\"message\"]}')
"
  fi
fi

TOTAL_REVIEW=$((FLAGGED_COUNT + MERGE_CONFLICTS))
```

If `TOTAL_REVIEW` is `0`, skip to **5d — Sign-off** below. No human review needed.
If merge conflicts exist, include them in the review table with verdict type **🔴 Edge dropped** (HIGH drops) or **🟡 Edge dropped** (MEDIUM drops). Valid actions: `K` = keep the locked edge, `R` = confirm removal.

### 5b — Display legend, table, and collect decision

Read every item in the `## FLAGGED` section of `docs/program/dependency-validation-report.md`.

Print the legend (show only verdict types that actually appear in this run) and the compact reference table:

```
STEP 5/8 — DEPENDENCY REVIEW  ({N} items require your decision)
══════════════════════════════════════════════════════════════════════
HOW ITEMS GET FLAGGED
  🔴 Refuted       — adversarial agent found this is not a true gate
  🟡 Uncertain     — ambiguous; human judgement needed
  🔵 Mismatch      — edge real but confidence overstated; downgrade recommended
  ⚪ MEDIUM policy — auto-flagged safety net; confirmed but needs sign-off
  🔧 Structural    — deterministic rule violation (cycle, unknown ID)
──────────────────────────────────────────────────────────────────────
QUICK REFERENCE — all flagged items
──────────────────────────────────────────────────────────────────────
#    Edge                    Verdict      Conf    Recommended
───  ──────────────────────  ───────────  ──────  ─────────────
{one row per item}
──────────────────────────────────────────────────────────────────────
Legend:  K=Keep  M=Downgrade to MEDIUM  H=Upgrade to HIGH  R=Remove
```

Then use `AskUserQuestion` to collect the decision:
- **question**: `"Review the {N} flagged edges above and specify your action."`
- **header**: `"Dependency Review"`
- **multiSelect**: `false`
- **options** (in this order):
  1. label: `"Accept all recommendations"` — description: `"Apply the recommended action to each of the {N} flagged items"`
  2. label: `"Keep everything as-is"` — description: `"Make no changes to any flagged edges; proceed with original topology"`
  3. label: `"View details before deciding"` — description: `"Expand full reasoning for specific rows before committing"`
  4. label: `"Override specific rows"` — description: `"Specify per-row decisions (e.g., 1:MEDIUM, 3:Remove, 5:Keep)"`

The tool appends an "Other" option automatically for free-form input.

Map the response:
- `"Accept all recommendations"` → treat as `[A]`; proceed to 5c
- `"Keep everything as-is"` → treat as `[N]`; proceed to 5c
- `"View details before deciding"` → ask `"Which rows? (e.g. 1,3,5)"` as plain text, then handle per 5b-ii
- `"Override specific rows"` or Other → ask `"Enter overrides (e.g. 1:M, 3:R):"` as plain text, then treat as override string per 5c

### 5b-ii — Lazy card expansion (on-demand)

If the user requests details (e.g. `details:1,3,5`), display expanded cards **only for those rows**. Group by verdict type.

Each card must include:
- **#** — row number
- **Edge / Issue** — FROM → TO (or description)
- **Verdict** — one of the five types
- **Source** — Step 3 or Step 4
- **Confidence** (if applicable) — claimed level
- **Rule cited** (if applicable) — from dependency-list.md
- **WHY IT WAS FLAGGED** — 2–3 sentences explaining the agent's finding or structural issue
- **RECOMMENDATION** — the advised action

Format:

```
── #1 ─────────────────────────────────────────────────────────────────
  Edge:        ACCT-1 → ACCT-4
  Verdict:     🔴 Refuted
  Source:      Step 4 — adversarial validation
  Confidence:  HIGH (claimed)
  Rule cited:  "Story B references story A's output in its AC"

  WHY IT WAS FLAGGED
  The adversarial agent attempted to refute this edge by asking:
  "Can ACCT-4 be built and tested without ACCT-1 being complete?"
  
  Finding: ACCT-4's acceptance criteria require only a search input field
  and result list — both testable with seed data. ACCT-1's authentication
  session is not referenced in any AC for ACCT-4. The dependency appears
  to be implementation convenience, not a true gate.

  RECOMMENDATION  →  Downgrade to MEDIUM
  Rationale: The edge may still be useful for scheduling but does not
  warrant blocking ACCT-4 at sprint level.

  Your options for #1:  K=Keep HIGH  M=Downgrade to MEDIUM  R=Remove
──────────────────────────────────────────────────────────────────────

── #3 ─────────────────────────────────────────────────────────────────
  Edge:        MGR-2 → MGR-3
  Verdict:     🔧 Structural
  Source:      Step 3 — deterministic validation
  
  WHY IT WAS FLAGGED
  Missing reverse edge — MGR-3 → MGR-2 exists but the inverse does not.
  This violates the acyclic ordering requirement for the dependency graph.
  
  RECOMMENDATION  →  Remove
  Rationale: Structural violations must be resolved before wave planning.

  Your options for #3:  K=Keep  R=Remove
──────────────────────────────────────────────────────────────────────
```

After showing requested cards, use `AskUserQuestion` to re-collect the decision:
- **question**: `"Reviewed rows {listed}. Ready to decide?"`
- **header**: `"Dependency Review"`
- **multiSelect**: `false`
- **options**:
  1. label: `"Accept all recommendations"` — description: `"Apply recommended action to all {N} items"`
  2. label: `"Keep everything as-is"` — description: `"No changes to any flagged edges"`
  3. label: `"View more details"` — description: `"Expand additional rows before deciding"`
  4. label: `"Override specific rows"` — description: `"Type row-level decisions (e.g., 1:M, 3:R)"`

Map responses the same way as in 5b. Then proceed to validation (5c).

### 5c — Parse and validate the user's response

Parse the user's response:
- `[A]` — all rows use their Recommended value
- `[N]` — no changes; skip to 5e (sign-off with zero edits)
- Override string (e.g. `2:K, 5:M`) — named rows use the override; all other rows use Recommended
- `[D]` or `details:<rows>` — handled in 5b-ii; this is a loop-back to request more details

**Validate every token in any override string before proceeding.**

Valid action codes per verdict type:

| Verdict type       | Valid actions                  | Invalid (explain why)         |
|--------------------|-------------------------------|-------------------------------|
| Refuted            | K, M, R                       | H — cannot upgrade a refuted edge |
| Uncertain          | K, M, H, R                    | —                             |
| Confidence mismatch| K, M, R                       | H — mismatch means HIGH is already the problem |
| MEDIUM policy      | K, H, R                       | M — already MEDIUM            |
| Structural (Step 3)| R, K (acknowledge and keep)   | H, M — structural issues have no confidence level |

**Validation errors:**

1. **Unknown row number** — row index does not exist (e.g. `15:M` when max is 9).
2. **Unknown action code** — any letter other than K, M, H, R, D.
3. **Inapplicable action** — valid code but not allowed for that verdict type (see table above).

**On validation failure, display an error block and re-prompt:**

```
⚠  INPUT ERROR — {N} issue(s) found
──────────────────────────────────────────────────────────────────────
  #5:Z   ✗  "Z" is not a valid action. Use K, M, H, or R.
  #12:M  ✗  Row 12 does not exist — there are only 9 items.
  #3:H   ✗  Row 3 is Structural (Step 3). Use K or R only.
──────────────────────────────────────────────────────────────────────

Please re-enter. You can correct just the bad tokens:
  5:R, 3:K   (or [A] to accept recommendations, [D] for details, [N] to skip)
```

Preserve valid tokens and repeat until input passes validation.

### 5c-ii — Confirmation summary before writing

Once input is valid, print only the rows that will actually change (omit keeps — they're noise):

```
DECISIONS SUMMARY
──────────────────────────────────────────────────────────────────────
#    Edge / Issue              Action               Note
───  ────────────────────────  ───────────────────  ──────────────────────
{only rows where action ≠ Keep}
──────────────────────────────────────────────────────────────────────
{N} change(s): {X} removed · {Y} downgraded · {Z} upgraded   ({W} kept as-is)
```

Then use `AskUserQuestion` to confirm:
- **question**: `"Apply these {N} change(s) to dependency-list.md?"`
- **header**: `"Confirm changes"`
- **multiSelect**: `false`
- **options**:
  1. label: `"Yes, apply changes"` — description: `"Write decisions to dependency-list.md and proceed to wave planning"`
  2. label: `"No, go back"` — description: `"Return to the review table without writing"`

If "No, go back": reprint the table from 5b and re-prompt with `AskUserQuestion`. If "Yes, apply changes": proceed to 5d.

### 5d — Apply corrections to dependency-list.md

After all decisions are collected, apply them to `docs/program/dependency-list.md`:

- **Remove** — delete the row from whichever confidence section it appears in
- **Set to HIGH** — move the row to `## HIGH — Sprint-blocked`
- **Set to MEDIUM** — move the row to `## MEDIUM — Integration-blocked`
- **Keep as-is** — no change; log the decision
- **Custom correction** — apply the user's stated change; if a note only, append it to the row's Reasoning cell in parentheses

After editing, recalculate the header table counts (Total inferences, HIGH, MEDIUM) from your own edit log — you have a complete record of what was removed, downgraded, or upgraded. Update the header table in `dependency-list.md` directly. Do not run shell commands to verify counts.

### 5e — Sign-off confirmation

Display:

```
STEP 5 — SIGN-OFF COMPLETE
──────────────────────────────────────────────────────────────────────
Items reviewed:  {N}
  🔧 Step 3 structural issues: {N}
  🔍 Step 4 adversarial flags: {N}
    🔴 Refuted:                {N}
    🟡 Uncertain:              {N}
    🔵 Confidence mismatch:    {N}
    ⚪ MEDIUM policy:          {N}

Changes written to dependency-list.md:
  Removed:       {N}
  Downgraded:    {N}
  Upgraded:      {N}
  Kept as-is:    {N}
  Custom edits:  {N}

dependency-list.md updated. Proceeding to Step 6 (Wave Planning).
```

Only after this confirmation may the pipeline continue to Step 6.

### 5f — Write dependency lock

After sign-off, write the lock immediately so the next run can detect what changed:

```bash
python3 "${CLAUDE_SKILL_DIR}/scripts/write_lock.py"
```

If this exits non-zero, surface the error — the lock is required for incremental inference on future runs. This does not block Step 6; proceed regardless.

```
LOCK WRITTEN
──────────────────────────────
Stories hashed:   {N}
HIGH edges:       {N}
MEDIUM edges:     {N}
Lock file:        docs/program/dependency-list.lock
```
