---
name: dependency-inference
description: 9-rule confidence-scored rubric for classifying inter-story dependencies, optional research report enrichment, and output template for dependency-list.md.
when_to_use: Classifying story dependency relationships in /arh-plan-program Step 2.
user-invocable: false
---
# Dependency Inference

## Confidence levels

| Level | Planning meaning | How far can B progress without A? |
|---|---|---|
| **HIGH** | Sprint-blocked — do not place B in the same sprint as A | ~20–30% (scaffolding and component shells only; most ACs cannot be verified) |
| **MEDIUM** | Integration-blocked — B can be fully built and unit-tested in parallel; blocked only at E2E and integration testing | ~70–80% (full build + unit tests pass; E2E requires A) |

Do not record an edge if the dependency is weaker than MEDIUM — if no concrete shared entity, precondition, API contract, or surface dependency can be identified, omit the pair entirely.

## Inference Rules

Evaluate every **ordered pair (A, B)**: does **B depend on A**?

Apply rules in order. Take the **highest confidence match** for a given pair — do not stack multiple rules.

| # | Rule | Signal | Confidence |
|---|---|---|---|
| 1 | **Explicit reference** | B's text explicitly names A's Story ID or title | HIGH |
| 2 | **Creates / Reads** | A creates or structurally modifies an entity/schema that B reads, updates, deletes, or transitions | HIGH |
| 3 | **Authentication gate** | B's ACs include a `Given` precondition of authenticated state, and A implements that authentication layer | HIGH |
| 4 | **API contract** | B calls an endpoint, RPC service, or message contract that A implements or modifies | HIGH |
| 5 | **Feature layering — surface** | B renders directly within A's visual container or runtime surface and cannot be visually verified without A | HIGH |
| 6 | **Infrastructure dependency** | B requires architectural scaffolding, environment variables, third-party SDK setups, or migrations implemented by A | HIGH |
| 7 | **Precondition match** | B's `Given` clauses reference behavioral or state conditions that are exclusively established by A's `Then` outcomes | MEDIUM |
| 8 | **Shared domain entity** | Both stories operate on the same domain entity, memory cache, or async event pipeline, but can be isolated via mocking | MEDIUM |
| 9 | **Feature layering — standalone** | B adds an isolated panel or sub-feature that relies on A's broader functional domain but can be built and unit-tested independently | MEDIUM |

For each inference, record: From (upstream story ID), To (downstream story ID), Confidence (HIGH / MEDIUM), Rule matched, Reasoning (1 sentence).

---

## Research Report Enrichment (Optional)

Before applying the 9-rule rubric, scan `docs/research/` for available reports. This is a **soft input** — if no reports exist, skip this section entirely and proceed with the rubric as normal.

### Step 1 — Scan for reports

```bash
find docs/research -name "*.md" | sort
```

Record which story IDs have a report. Add a coverage row to the `dependency-list.md` header:
`| Research reports available | <N> of <T> stories (<IDs>) |`

### Step 2 — Extract from `Dependencies Verified` section

For each research report, find the `## Dependencies Verified` table. Each row names an upstream story ID that the researcher explicitly checked.

- Each confirmed upstream dependency → add as a **HIGH** confidence edge
- Rule label: `Research — Dependencies Verified`
- Reasoning: copy the researcher's note if present, otherwise: `Researcher confirmed {TO} cannot proceed without {FROM} per codebase inspection.`

### Step 3 — Extract from `Shared code at risk` section

For each research report, find the `Shared code at risk` table in the Codebase Integration Map. Extract the file paths listed.

Cross-reference across all reports: if two stories both list the same file as shared code at risk, flag that pair as a **scrutiny candidate**.

A scrutiny candidate is NOT a new edge. It is a signal to apply extra attention when the 9-rule rubric evaluates that pair — look harder for direction and rule applicability before deciding confidence. If the rubric still finds no match at MEDIUM or above after scrutiny, do not create an edge.

### Step 4 — Conflict resolution

When research and the 9-rule rubric produce the same edge (same From → To) at different confidence levels:

- **Take the higher confidence** — if research says HIGH and rubric says MEDIUM, record HIGH
- **Emit one deduplicated row** — do not duplicate the edge
- **Combined source label** — e.g. `Rule 8 + Research — Dependencies Verified`

When research produces an edge the rubric did not find, include it as-is with the research rule label.

---

## Output Template: `docs/program/dependency-list.md`

```markdown
# Program — Dependency List

| Field | Value |
|---|---|
| Generated | {today's date} |
| Stories analysed | {N} |
| Stories skipped (unstable) | {N} — {IDs} |
| Total inferences | {N} ({H} HIGH, {M} MEDIUM) |
| Research reports available | {N} of {T} stories — {IDs, or "none"} |

---

## HIGH — Sprint-blocked

B cannot be meaningfully completed without A. Most ACs unverifiable until A ships.

| From (upstream) | To (downstream) | Rule | Reasoning |
|---|---|---|---|
| {A-ID} | {B-ID} | {Rule} | {1-sentence reasoning} |

---

## MEDIUM — Integration-blocked

B can be fully built and unit-tested without A. Blocked only at E2E and integration testing.

| From (upstream) | To (downstream) | Rule | Reasoning |
|---|---|---|---|

---

## Skipped Stories

| Story ID | Title | Status | Reason |
|---|---|---|---|
```
