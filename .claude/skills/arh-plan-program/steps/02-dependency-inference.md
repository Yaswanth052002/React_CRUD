> **Banner:** `▶ STEP 2/8 — DEPENDENCY INFERENCE` — print this before any tool calls.

## Step 2 — Dependency Inference (Scoped)

Infer inter-story dependencies using the 9-rule rubric, scoped to only the stories that
changed since the last lock. Unchanged story pairs are read from the lock — no LLM cost.

> IMPORTANT: Do NOT pass `isolation: "worktree"` when invoking this agent.
> All artifacts must be written to the main working tree.

### 2a — Check scope

```bash
# Skip entirely if Step 1 set SKIP_INFERENCE=true (all stories cached)
if [[ "${SKIP_INFERENCE}" == "true" ]]; then
  echo "Step 2 skipped — all stories unchanged since last lock."
  exit 0
fi

# Determine which stories need inference
SCOPE=$(python3 -c "
import json, sys
try:
    with open('docs/program/.change-classification.json') as f:
        cls = json.load(f)
    stories = cls.get('changed', []) + cls.get('new', [])
    print(' '.join(stories))
except Exception as e:
    sys.exit(1)
")

NO_LOCK=$([[ ! -f "docs/program/dependency-list.lock" ]] && echo "true" || echo "false")

if [[ "$NO_LOCK" == "true" ]]; then
  echo "First run — full inference for all stories (no lock exists)."
else
  echo "Scoped inference for: ${SCOPE}"
fi
```

### 2b — Run inference agent

**If first run (no lock):** full inference, agent writes `docs/program/dependency-list.md` directly.

```
@dependency-inference-agent
RTM:        docs/requirements/RTM.md
Stories:    docs/stories/
Research:   docs/research/
Output dir: docs/program/
Date:       {today's date}
```

**If re-run (lock exists):** scoped inference — agent only evaluates pairs involving changed/new stories,
writes `docs/program/dependency-list-delta.md`. Locked edges for unchanged pairs are NOT re-inferred.

```
@dependency-inference-agent
RTM:          docs/requirements/RTM.md
Stories:      docs/stories/
Research:     docs/research/
Lock:         docs/program/dependency-list.lock   (read-only context — do not re-infer locked edges)
Scope:        {SCOPE}                             (infer ONLY edges where at least one story is in this list)
Output file:  docs/program/dependency-list-delta.md
Date:         {today's date}

IMPORTANT: In scoped mode the agent must:
1. Read ALL story files for dependency context (unchanged stories may be dependencies of changed ones).
2. Read the lock file to understand which edges are already approved — do not re-state them.
3. Infer ONLY edges where at least one endpoint is in Scope. Skip pairs where both stories are unchanged.
4. Write ONLY the newly inferred edges to dependency-list-delta.md (same format as dependency-list.md).
5. Still write docs/program/story-metadata.json with metadata for ALL stories (not scoped).
```

### Post-Step 2 Verification

```bash
if [[ "$NO_LOCK" == "true" ]]; then
  # First run: full list written directly
  if [[ ! -f "docs/program/dependency-list.md" ]]; then
    echo "ERROR: dependency-inference-agent did not write docs/program/dependency-list.md"
    exit 1
  fi
else
  # Re-run: delta written, will be merged in Step 2b
  if [[ ! -f "docs/program/dependency-list-delta.md" ]]; then
    echo "ERROR: dependency-inference-agent did not write docs/program/dependency-list-delta.md"
    exit 1
  fi
fi

if [[ ! -f "docs/program/story-metadata.json" ]]; then
  echo "ERROR: dependency-inference-agent did not write docs/program/story-metadata.json"
  exit 1
fi

RESEARCH_COUNT=$(( \
  $(grep -c "Research — Dependencies Verified" docs/program/dependency-list-delta.md 2>/dev/null || echo 0) + \
  $(grep -c "Research — Dependencies Verified" docs/program/dependency-list.md 2>/dev/null || echo 0) \
))
if [[ $RESEARCH_COUNT -gt 0 ]]; then
  echo "Research enrichment applied: $RESEARCH_COUNT edges confirmed by research reports."
fi
```
