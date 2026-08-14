---
name: interactive-graph
description: 11-step procedure for populating the canonical dependency-graph.html template with NODES, EDGES, and META data. Covers data hygiene rules, refresh-mode field locking, and the three-substitution template contract.
when_to_use: Generating or refreshing the interactive dependency graph in interactive-graph-agent.
user-invocable: false
---
# Interactive Graph — Population Procedure

Populate `${CLAUDE_SKILL_DIR}/../arh-plan-program/templates/dependency-graph.html` with project data
and write the result to `docs/program/dependency-graph-visual.html`.

**Do NOT generate HTML from scratch.** Always read and populate the template.

## Inputs

| Source | What to read |
|---|---|
| `docs/program/dependency-list-reduced.md` | All edges (From, To, Confidence) |
| `docs/stories/*.md` | Per-story: Status, Effort, Depends On, Blocks |
| `docs/research/` | Which story IDs have a research report |
| `docs/research/{ID}-research.md` | Research verdict (GO / GO-WITH-CONDITIONS / SPIKE) and score |
| `docs/program/wave-plan.md` | Wave number per story, critical path chain |

## Steps

### Step 1 — Read the template

Read `${CLAUDE_SKILL_DIR}/../arh-plan-program/templates/dependency-graph.html` in full.
Do not modify its structure — only substitute the three marked blocks.

### Step 2 — Parse dependency-list-reduced.md

Read `docs/program/dependency-list-reduced.md`. Extract every edge as `(From, To, Confidence)`.
Map confidence to labels: HIGH → `'H'`, MEDIUM → `'M'`, LOW → `'L'`.
Collect the complete set of story IDs that appear as either From or To.

### Step 3 — Collect story metadata

For each story ID, read its story file in `docs/stories/`. Extract:

| Field | Source | Notes |
|---|---|---|
| `title` | Story file H1 or title line | Full title text |
| `statusCode` | `**Status:**` field | Draft→`DFT`, In Review→`REV`, Validated→`VAL`, Ready for Dev→`RDY`, In Progress→`WIP`, Done→`DON` |
| `effort` | `**Effort:**` field | XS / S / M / L |
| `userStory` | `**User Story:**` field or `As a …` sentence | Full text; null if not found |
| `dependsOn` | `### Depends On` section | Story IDs only |
| `blocks` | `### Blocks` section | Story IDs only |

### Step 4 — Check research coverage

For each story ID, check whether `docs/research/{ID}-research.md` exists (use Bash `test -f`).

If the file exists, read it and extract:
- **Verdict:** scan for `GO-WITH-CONDITIONS`, `SPIKE`, or `GO` (in that priority order — longest match first)
- **Score:** scan for a pattern like `**Total** | XX` or `Score: XX/100` — extract the integer

Set `hasResearch: true/false`, `researchVerdict: 'GO'|'GO-WITH-CONDITIONS'|'SPIKE'|null`, `researchScore: <integer>|null`.

### Step 5 — Read wave plan

Read `docs/program/wave-plan.md`. For each story, extract:
- **Wave number:** from the `### Wave N` section heading that contains the story ID
- **Critical path:** find the `**Chain:**` line. Any story ID in that chain gets `isCritical: true`

### Step 6 — Build NODES array

Construct one entry per story ID:

```javascript
{ data: {
    id:              'AUTH-1',
    title:           'User Login Flow',
    statusCode:      'VAL',
    effort:          'M',
    wave:            2,
    isCritical:      true,
    hasResearch:     true,
    researchVerdict: 'GO',
    researchScore:   87,
    userStory:       'As a user, I want to log in, so that I can access my account.',
    dependsOn:       ['INFRA-1'],
    blocks:          ['ACCT-1', 'DASH-1']
}},
```

**Data hygiene:** Use `null` for missing values. Never use HTML entity strings — `.textContent` renders them as literal text. `statusCode` defaults to `'DFT'` if undetermined. `effort` uses `null` if not found.

### Step 7 — Build EDGES array

```javascript
{ data: { id: 'e-AUTH-1-ACCT-1', source: 'AUTH-1', target: 'ACCT-1', label: 'H' } },
```

Edge `id` format: `e-{FROM}-{TO}`.

### Step 8 — Read last action

Check if `docs/program/.action-state.json` exists. Extract `lastAction` field or use `"—"` if absent.

### Step 9 — Build META object

```javascript
{ project: '<product name>', date: '<today>', totalWaves: <N>, criticalPath: '<chain>', lastAction: '<action>' }
```

### Step 10 — Apply three substitutions

Take the full template from Step 1. Make **exactly three substitutions**:

1. Replace `/* GRAPH_NODES */` with NODES entries (no surrounding brackets)
2. Replace `/* GRAPH_EDGES */` with EDGES entries (no surrounding brackets)
3. Replace `/* GRAPH_META */ null` with the META object literal

**Do NOT** add, remove, or reorder HTML elements. The three placeholder comments are the only permitted changes.

### Step 11 — Write output

Write the populated file to `docs/program/dependency-graph-visual.html`.

## Refresh Mode

When invoked with `Mode: refresh`, re-read from source files for every run:

| Field | Refreshed | Stays locked |
|---|---|---|
| `statusCode`, `userStory` | ✓ | |
| `hasResearch`, `researchVerdict`, `researchScore` | ✓ | |
| `lastAction` | ✓ | |
| Edges (topology), `wave`, `isCritical`, `dependsOn`, `blocks` | | ✓ |

In refresh mode, execute Steps 3 and 4 in full. Do NOT read the existing HTML as input.
