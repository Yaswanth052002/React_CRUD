> **Banner:** `▶ STEP 4/8 — ADVERSARIAL VALIDATION` — print this before any tool calls.

> IMPORTANT: Do NOT pass `isolation: "worktree"` when invoking this agent.
> All artifacts must be written to the main working tree.

## Step 4 — Adversarial Validation

Invoke the adversarial validation agent:

```
@adversarial-validation-agent
```

The agent reads `docs/program/dependency-validation-report.md` (written by Step 3), carries forward any structural issues, then independently attempts to refute each inferred edge in `docs/program/dependency-list.md`. It produces the complete combined validation report at `docs/program/dependency-validation-report.md`.

Verify the report is complete:

```bash
if [[ ! -f "docs/program/dependency-validation-report.md" ]]; then
  echo "ERROR: adversarial-validation-agent did not write docs/program/dependency-validation-report.md"
  echo "The agent may have run in worktree isolation. Check ${CLAUDE_PROJECT_DIR}/.claude/worktrees/ for stray artifacts."
  exit 1
fi
if ! grep -q "^## CONFIRMED" docs/program/dependency-validation-report.md; then
  echo "ERROR: dependency-validation-report.md is incomplete — missing ## CONFIRMED section."
  exit 1
fi
```

Proceed to Step 5 (Human Review Gate).
