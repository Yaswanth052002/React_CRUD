> **Banner:** `▶ STEP 3/8 — STRUCTURAL VALIDATION` — print this before any tool calls.

## Step 3 — Structural Validation

Run the structural validation script against `docs/program/dependency-list.md`:

```bash
python3 "${CLAUDE_SKILL_DIR}/scripts/validate_dependency_list.py"
```

**Exit 1 (fatal):** The dependency list file is missing or cannot be parsed. Stop and surface the error to the user. Do not proceed.

**Exit 0:** Continue to Step 4 in both cases:
- **Issues found** — cycles, self-references, or unknown story IDs are listed under `## STRUCTURAL ISSUES (Step 3)` in `docs/program/dependency-validation-report.md`.
- **No issues found** — the report is still written with "No structural issues found." Step 4 proceeds immediately.

Verify the report section was written:

```bash
if [[ ! -f "docs/program/dependency-validation-report.md" ]]; then
  echo "ERROR: validate_dependency_list.py did not write docs/program/dependency-validation-report.md"
  exit 1
fi
```

Structural issues will be presented to the user in Step 5 (Human Review Gate).
