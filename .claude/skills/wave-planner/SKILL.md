---
name: wave-planner
description: Wave planning algorithms (Kahn's cycle detection, topological sort, critical path), risk register categories, cycle error format, and output template for wave-plan.md.
when_to_use: Building the wave plan in /arh-plan-program Step 6 (wave-planner-agent).
user-invocable: false
---
# Wave Planner

## Graph Construction

Build: `graph[story_id] = [list of upstream story IDs this story depends on]`

Edge sources in priority order:
1. HIGH confidence inferences from dependency-list.md
2. MEDIUM confidence inferences from dependency-list.md
3. Manually-written `Depends On` entries from story files (non-TBD, lines without `<!-- inferred -->` annotation)

Compute **in-degree** for each node: the count of upstream stories that must complete before this story can start.

## Cycle Detection (Kahn's Algorithm)

1. Initialise a queue with all nodes that have in-degree 0.
2. Process each node: decrement in-degree of all downstream nodes. Enqueue any node whose in-degree reaches 0.
3. All nodes processed → no cycle; proceed to wave assignment.
4. Nodes remaining unprocessed → cycle detected.

On a cycle, emit the following and **stop — do not write wave-plan.md**:

```
ERROR: Circular dependency detected — wave plan cannot be generated.

Cycle: {STORY-ID} → {STORY-ID} → {STORY-ID}
  {STORY-ID} Depends On: {STORY-ID}
  {STORY-ID} Depends On: {STORY-ID}

Resolve by removing one of the above dependency links in the relevant
story file, then re-run /arh-plan-program.
```

## Wave Assignment (Kahn's Topological Sort)

1. **Wave 1:** all stories with in-degree 0 (no dependencies on other in-scope stories).
2. Remove Wave 1 stories from the graph. Recompute in-degree. All newly zero-in-degree stories → Wave 2.
3. Repeat until all stories are assigned a wave number.

## Critical Path

For each story, compute:
```
depth[story] = 1 + max(depth[upstream] for all upstream stories)
```
Stories with no dependencies have depth 1.

The story with the highest depth marks the end of the critical path. Trace backwards (always choosing the upstream story with the highest depth) to produce the full chain from Wave 1 to the final wave.

## Risk Register Categories

| Category | Trigger | Severity |
|---|---|---|
| `CROSS_EPIC` | A HIGH or MEDIUM edge connects stories from two different EPICs | Medium |
| `BROKEN_REF` | A manually-written `Depends On` references a story ID not found in `docs/stories/` | High |
| `UNVALIDATED_DEP` | An upstream story is still in Draft or In Review status | High |
| `CONFLICT` | Any `<!-- CONFLICT -->` annotation in a story file | High |
| `EXTERNAL_DEP` | A story's External Dependencies section references a third-party service or API with no confirmed availability | Medium |

## Output Template: `docs/program/wave-plan.md`

```markdown
# Program — Wave Plan

| Field | Value |
|---|---|
| Generated | {today's date} |
| Stories analysed | {N} |
| Stories skipped (unstable) | {N} |
| Waves | {N} |
| Critical path length | {N} waves |
| Parallel stories (Wave 1) | {N} |

---

## Summary

{2–3 sentences: total stories, how many can start immediately (Wave 1 count),
critical path chain and minimum wave count, top risks worth calling out.}

---

## Wave Breakdown

### Wave 1 — Start immediately (no dependencies)

| Story ID | Title | Status | Effort |
|---|---|---|---|

### Wave 2 — Unblocked after Wave 1

| Story ID | Title | Direct Dependencies | Status | Effort |
|---|---|---|---|---|

{Repeat a section for each wave. Include "Direct Dependencies" column for
Wave 2 and beyond.}

---

## Critical Path

> The critical path determines the minimum number of delivery cycles for
> this program. Any delay on a critical path story delays the entire program.

**Chain:** {STORY-ID} → {STORY-ID} → … → {STORY-ID}  ({N} waves minimum)

{1–2 sentences on timeline implications.}

---

## Inferred Dependencies

| Story | Depends On | Confidence | Rule | Reasoning |
|---|---|---|---|---|
{All HIGH and MEDIUM inferences used in graph construction.}

---

## Risk Register

| # | Category | Risk | Affected Story | Severity | Recommendation |
|---|---|---|---|---|---|

---

## Flags for Human Review

{Risk register items warranting human attention — CONFLICT annotations,
BROKEN_REF entries, and EXTERNAL_DEP risks with unconfirmed availability.
Omit this section entirely if no such items exist.}

---

## Skipped Stories

| Story ID | Title | Status |
|---|---|---|

---

## How to Use This Plan

1. **Start Wave 1 stories immediately** — no prerequisites.
2. **Begin Wave N only when all direct dependencies are Done** — check story status before starting Wave 2+ stories.
3. **Watch the critical path** — any delay on a ★ story delays the program.
4. **Re-run after any change** — new story added, ACs updated, or wave completes → re-run /arh-plan-program to refresh.
```
