---
name: plan-authoring
description: Author PLAN.md — pinned 7-section order, mini-ADR ceremony, F-NN file plan, T-NN tasks, plan-validation rubric, test strategy. Used by impl-planning-agent.
user-invocable: false
---
# Plan authoring

The method and formats for converting REQUIREMENTS.md into PLAN.md. Apply the sections in order.

Phase numbering used throughout: 1 = ADRs, 2 = File plan, 3 = Tasks, 3b = Plan validation, 4 = Test strategy, 5 = Tracker subtask (the tracker push runs in the `/arh-plan-implementation` orchestrator, not here).

## PLAN.md pinned section order (mandatory)

Every emitted `PLAN.md` MUST carry these top-level sections in this exact order, with this exact spelling and numbering. No extra `## `-level sections. Sub-sections (`### `) appear inside each section as documented in the step files.

1. `## 1. Architecture Decisions`
2. `## 2. File and Module Plan`
3. `## 3. Module Hierarchy`
4. `## 4. State and Data Management`
5. `## 5. Task Breakdown`
6. `## 6. Carry-Forward Risks and Conditions`  *(merges accepted risks + GO-WITH-CONDITIONS conditions; no separate "Conditions for GO" or "Addressing Research Conditions" section)*
7. `## 7. Test Strategy`

Plus the closing rubric block (`## Plan validation` — written by step 03b).

Lint rule **F-051** (warn) fires on any PLAN.md whose `## ` section set deviates from this list or whose numbering is out of order.

### Forbidden patterns

- `## 2. Cross-Feature Dependency Notes` — fold into §6 as `### Cross-Feature Dependency Notes`
- `## 8. Conditions for GO` — fold into §6 as `### Conditions for GO (research_verdict GO-WITH-CONDITIONS)`
- `## 9. ADR Index Update` — promotion notes live inside the relevant ADR block in §1
- `## 7. Addressing Research Conditions` — see §6 (conditions go inside §6 sub-section)
- Descriptive task IDs (e.g. `T-MIGRATION`, `T-SEED`, `T-ADR`) — task IDs MUST be `T-NN` zero-padded numeric (`T-01..T-99`)
- File table without ID column — every file table MUST have `F-NN` zero-padded numeric IDs

## Architecture decisions (mini-ADRs)

Goal: capture every non-trivial decision the implementation will commit to. One mini-ADR per decision; full ADR (under `docs/adr/`) only for those affecting >1 future story.

### When to write an ADR

| Decision flavour | ADR? |
|---|---|
| Choice between two libraries with materially different ergonomics | yes |
| Database schema change | yes |
| New external dependency | yes |
| Async vs sync at a critical boundary | yes |
| Renaming an existing function | no (commit message is enough) |
| Internal helper module | no |

### Mini-ADR format (lean)

Embed each in PLAN.md § 1. Architecture Decisions. **Header is a single line**; no separate Status / Date / Deciders block.

```
### ADR-N: <one-line title> · Accepted · YYYY-MM-DD · <Deciders>

**Context**: <one paragraph; the constraint that makes this a decision, not a default>

**Decision**: <one paragraph>

**Alternatives considered**: *(OPTIONAL — emit only when ≥1 non-trivial alternative existed)*
- <name>: <why rejected>

**Consequences**:
- Positive: …
- Negative: …  *(end this bullet with a sentence on reversibility — "Reversible mechanically" / "Reversible at medium cost — requires re-migration" / "Effectively irreversible after data migrates" — do NOT emit a separate `Reversible?` line)*
```

### When to omit `Alternatives considered`

Omit the entire sub-section when the only realistic alternatives are mechanical / clearly worse:

- "re-implement vs reuse an existing module from an upstream story"
- "use lib X vs lib Y where Y is unmaintained / breaks WCAG / pulls a heavy transitive tree"
- "add column now vs add it later" (when later means re-migration)

Emit it when there are ≥1 alternatives that another competent reviewer might prefer (e.g. `aiosmtplib` vs `smtplib` for async dispatch; `httpx` vs `aiohttp` for outbound fetch; `pg_trgm` vs `tsvector` for search; `Radix Dialog` vs hand-rolled).

### When to omit `Context`

Never. Context is what tells readers why this is a decision at all. If the context is "we need a way to do X" with no constraint, the decision isn't ADR-worthy — delete the ADR.

### Promotion to full ADR

If a decision will outlive this story, also write a full ADR using `adr-template`:

- Path: `docs/adr/<NNNN>-<slug>.md`
- Update `docs/adr/README.md` index.
- Reference the ADR id in PLAN.md mini-ADR header (`### ADR-1: <title> [→ docs/adr/0017-...]`).

### State record (mandatory)

After writing each mini-ADR to PLAN.md §1, invoke the `decide` skill to append a structured entry to `docs/features/<id>/state.json` at `.decisions[]` (P-tier; no index mirror). The mini-ADR is the prose for humans; `decisions[]` is the queryable record consumed by `/arh-review`, `/arh-security-review`, and `/arh-explain`.

One mini-ADR → one `decisions[]` entry. If a mini-ADR is promoted to a full ADR, set `adr_ref` to the ADR id on the same entry — do not write a second entry.

See `.claude/skills/decide/SKILL.md` for the record shape, field guidance, and anti-patterns.

### Anti-pattern

Don't author ADRs for trivial choices. Don't bury an ADR-worthy choice inside a task description. If three readers would each pick a different solution from the same prompt, write the ADR.


## File and module plan

Goal: list every file to create or modify, and the module hierarchy with explicit input/output contracts.

### File table

PLAN.md Section "File and Module Plan" begins with a table:

```
| Action  | Path                                | Reason                            |
|---------|-------------------------------------|-----------------------------------|
| create  | src/checkout/promoStack.ts          | new logic per ADR-1               |
| modify  | src/api/routes/promos.ts            | add GET /preview                  |
| create  | tests/integration/promo-stack.spec  | covers TC-04..TC-08               |
| modify  | docs/openapi.yaml                   | document new GET /preview         |
```

### Module hierarchy

For new or significantly-modified modules, draw a tree with input / output / public contract per node:

```
checkout/
├── promoStack
│   - input:  PromoCode[], Cart
│   - output: AppliedDiscount[]
│   - public: applyStack(codes, cart) -> AppliedDiscount[]
└── promoPreview
    - input:  PromoCode, Cart
    - output: PreviewResult { eligible, amount, reason }
    - public: preview(code, cart) -> PreviewResult
```

### State / data management

Where relevant, document:

- New persistent state and its lifecycle (e.g. new DB columns; migration plan).
- Cache strategy: keys, TTL, invalidation events.
- Client-side state: store / context boundaries.

### Anti-pattern

Don't list "various files in src/checkout/" — name every file. The list is the contract between this plan and the implementation-agent.


## Task breakdown

Goal: decompose the implementation into independently-mergeable tasks, each with a complexity tag, parallelization marker, and predecessor list.

### Task ID and File ID rules (mandatory)

- **Task IDs** MUST be `T-NN` zero-padded numeric (`T-01..T-99`). Descriptive IDs like `T-MIGRATION`, `T-SEED`, `T-ADR` are forbidden — downstream tooling (`/arh-implement` orchestrator, `harness carry-forward`, `harness analyse`) parses position in the DAG by numeric ord and breaks on string IDs.
- **File IDs** MUST be `F-NN` zero-padded numeric (`F-01..F-99`). The File Plan table (§2 of PLAN.md) MUST carry the ID column. Tables of the form `Action | Path | Purpose` (no ID column) are forbidden — task rows reference files by `F-NN` ids.
- **Section heading** MUST be `## 5. Task Breakdown` (numbered, exact case). Lint rule F-051 fires on deviation.

### Task table

PLAN.md § 5. Task Breakdown:

```
| #     | Title                                    | Complexity | [P] | Predecessors | Files                  | Notes                              |
|-------|------------------------------------------|------------|-----|--------------|------------------------|------------------------------------|
| T-01  | Add PromoStack type + applyStack         | M          | [P] | —            | F-01                   | Pure; unit tests in same task      |
| T-02  | Wire applyStack into checkout flow       | S          |     | T-01         | F-02                   | Behind feature flag (per ADR-2)    |
| T-03  | Add GET /promos/:code/preview            | M          | [P] | —            | F-03                   | Auth via existing middleware       |
| T-04  | Migration: add promo_stack_applied col   | L          | [P] | —            | F-04                   | Backfill with default; see ADR-3   |
| T-05  | Update OpenAPI                           | S          |     | T-03         | F-05                   | Cross-references F-03              |
```

The `Files` column references `F-NN` ids from § 2. File and Module Plan. Multiple file ids are comma-separated.

### `[P]` parallelization marker

A task is `[P]` when ALL of these hold:

1. **Disjoint files**: its `Files` list does not overlap any other `[P]` task's `Files`.
2. **No predecessor in this batch**: its `Predecessors` column is `—` OR every predecessor is already merged.
3. **No shared mutable state**: does not race with another `[P]` task on a migration, env var, or shared config file.

When `[P]` holds, `/arh-implement` may dispatch the task to a parallel subagent (background mode).
When `[P]` is absent, `/arh-implement` runs the task strictly after its predecessors. Mis-marking
a task as `[P]` causes write conflicts at integration time — be conservative.

### Predecessors column

- `—` for tasks that depend on nothing.
- Comma-separated task ids (e.g. `T-01, T-03`) when ordering is required.
- Predecessors form a DAG. The agent rejects cycles at PLAN.md write time.

### Complexity scale

- **S** (small): a few edits in one file; <2h.
- **M** (medium): multiple files in one module; ~half-day.
- **L** (large): cross-module or migration; full day; consider splitting.

If a single task is rated XL, split it. If you cannot split, flag it as a risk in the carry-forward section.

### Sequencing

- Tasks walk the predecessor DAG in topological order.
- `[P]`-marked tasks within the same predecessor bucket may run in parallel.
- Commits land sequentially regardless of `[P]` (parallel diffs, sequential merge — preserves bisectability).

### Carry-forward from research — risks

PLAN.md § 6. Carry-Forward Risks and Conditions (mandatory section):

```
### 6. Carry-Forward Risks and Conditions

Risks from `docs/research/$ARGUMENTS.md` § Risk register. HIGH/CRITICAL risks must be
addressed by at least one task id from § 5; MED/LOW risks inherit their mitigation
from the research doc and need no re-statement here. Only `accepted` risks are
re-cited below — those carry forward to `pending_carry_forward[]` and require
`--accept-pending` at commit-PR time.

### Risks addressed by tasks

| Risk id | Severity | Addressed by |
|---------|----------|--------------|
| R-01    | HIGH     | T-02         |
| R-02    | HIGH     | T-02         |

### Risks accepted (carry-forward)

| Risk id | Severity | Rationale                                          |
|---------|----------|----------------------------------------------------|
| R-03    | CRITICAL | accepted (ADR-4) — documented; revisit in story-019 |

### Conditions for GO (research_verdict == GO-WITH-CONDITIONS)

<!-- Only when research_verdict is GO-WITH-CONDITIONS. List numbered conditions
     from docs/research/<id>.md § Conditions for GO mapped to addressing tasks.
     No "accepted" shortcut for conditions — conditions are non-negotiable. -->

| Cond | Condition (verbatim) | Addressed by |
|------|----------------------|--------------|
| C-1  | <condition text>     | T-06         |
| C-2  | <condition text>     | T-07         |

### Cross-Feature Dependency Notes

<!-- Optional sub-section. Use when this story's tasks depend on artefacts from
     other in-flight features (other stories' PRs, shared modules being built
     concurrently). Reference by story id and task id. Empty when none. -->
```

**Verification rule**: every HIGH or CRITICAL risk in `docs/research/$ARGUMENTS.md` MUST appear in either the "addressed by tasks" sub-table OR the "accepted" sub-table. Do NOT re-state the risk text — readers follow `docs/research/<id>.md` for context. Empty addressed-by/rationale cells are a Phase 3 fail.

**Forbidden pattern**: a separate `## Carry-forward risks` or `## Conditions for GO` or `## Addressing Research Conditions` top-level section. All conditions, accepted-risk re-cites, and cross-feature notes live INSIDE § 6 as sub-headings. F-051 fires on deviation.

### State write — carry-forward (mandatory)

`pending_carry_forward[]` is P-tier (per `docs/state/SCHEMA.md`).
For every risk-table row with `Addressed by: accepted (...)`, append to
`docs/features/$ARGUMENTS/state.json` at `.pending_carry_forward`:

```json
{
  "item_id":     "<R-NN>-<short-slug>",
  "kind":        "risk",
  "reason":      "<risk text> — accepted via <adr-id-or-rationale>",
  "owner":       "<team-or-user from PRD>",
  "added_at":    "<iso8601>",
  "added_by":    "plan-implementation/03-tasks (risk accepted)",
  "resolved_at": null,
  "evidence":    null
}
```

These entries surface in `/arh-implement` Step 5 (commit-PR) and `/arh-review`. A non-empty list
requires an explicit `--accept-pending <ids>` flag to merge (warning, not block, unless the entry
is compliance-tagged — `/arh-security-review` blocks compliance-tagged items unconditionally).

### Carry-forward from research — conditions (GO-WITH-CONDITIONS only)

When `research_verdict == "GO-WITH-CONDITIONS"` (read from per-feature state via reader rule), mirror every numbered condition from `docs/research/$ARGUMENTS.md` § Conditions for GO into the `### Conditions for GO` sub-section of § 6 (see the § 6 template above).

**Verification rule**: every numbered condition in research MUST appear in § 6 `### Conditions for GO`, and every `Addressed by` cell MUST be a task id from § 5 (no `accepted` shortcut — conditions are non-negotiable, that's why they were called out).

Phase 3 fails if:

- `research_verdict == "GO-WITH-CONDITIONS"` AND § 6 has no `### Conditions for GO` sub-section, OR
- any condition is missing from the sub-section table, OR
- any `Addressed by` cell is empty or references a non-existent task id.

When `research_verdict in {GO, SPIKE, BLOCK}`, the `### Conditions for GO` sub-section is omitted entirely. § 6 still exists for risks.


## Plan validation (rubric)

Goal: run the `plan-validation` rubric against the in-progress PLAN.md (file table + task table + test-strategy table) before continuing to Phase 4 (test-strategy detailing) and the tracker push. Self-correct ≤2 rounds; escalate on persistent fail.

This phase exists because shipped post-mortems verified that an incomplete PLAN.md silently leads to a broken implementation: missing wiring entries → broken UI; missing docs task → no README; missing runner setup → declared e2e TCs cannot run. The implementation-agent obeys surgical-changes correctly; if the plan omits something, the code omits it too. **Catch it here, not in production.**

### Procedure

1. Load skill `plan-validation`.
2. Apply each of the 5 dimensions to the current PLAN.md:
   - Wiring (entry-registration sites listed)
   - Docs (4 triggers: T1 runnable surface / T2 new HTTP route / T3 new env var / T4 new service or port → matching docs task)
   - Runner-setup (declared e2e / perf / contract TCs → matching runner setup task)
   - Cross-section consistency (file table ↔ task table ↔ test-strategy)
   - Config drift (new dep / service / port → `docs/config/project-commands.yaml preflight:` or `docs/config/stack-smoke.md` update task)
3. Compose the verdict block.
4. If any dimension fails: hand back to `impl-planning-agent` with the failing dimensions and one-line directives. Agent revises PLAN.md. Re-validate.
5. **Cap at 2 rounds.** After round 2 fail:
   - Mark PLAN.md header `Status: ESCALATED`
   - Append the round table to `docs/features/$ARGUMENTS/PLAN-ESCALATION.md`
   - Surface the gaps to the user and HALT
   - Do not proceed to Phase 4

### Round table (appended to PLAN.md)

```
### Plan validation rounds

| Round | Verdict | Failing dimensions             | Action                           |
|-------|---------|--------------------------------|----------------------------------|
| 1     | FAIL    | Wiring, Runner-setup           | impl-planning-agent revision     |
| 2     | PASS    | —                              | Continue to Phase 4              |
```

### State write (mandatory, unconditional)

`plan_validation` and `plan_validation_rounds` are P-tier (per `docs/state/SCHEMA.md`).
After PLAN.md passes the rubric, write to `docs/features/$ARGUMENTS/state.json`:

```json
{
  "plan_validation":     "PASS | FAIL | ESCALATED",
  "plan_validation_rounds": <int>,
  "last_updated":        "<iso8601>"
}
```

Also mirror `last_updated` to `docs/state/features.json[$ARGUMENTS]` per writer rule.

`plan_validation: "PASS"` is a **precondition for `/arh-implement` Step 0** (added to `phase-preconditions` matrix). `/arh-implement` aborts if the plan has not been validated.

### Failure handling for each dimension

| Failed dimension | Agent revision directive |
|---|---|
| Wiring | "Add edit-row(s) for the entry/registration site(s) of: <list of new modules>. The implementation-agent will not infer wiring beyond what the file table lists." |
| Docs (T1 — new runnable surface) | "Add docs(readme) task to the task table touching ROOT `README.md` (not service-nested). Cover: how to start the new surface, required env, port. Surface introduced: <surface>." |
| Docs (T2 — new HTTP route) | "Add docs task updating root `README.md` API section OR `docs/openapi/<name>.yaml` for the new route(s): <list>. Routes shipped without contract docs fail fresh-clone usability." |
| Docs (T3 — new env var) | "Add docs task updating BOTH root `README.md` env table AND `.env.example` for the new var(s): <list>. Each var: name, default, acceptable range, what disables it." |
| Docs (T4 — new service entry / port) | "Add docs task updating root `README.md` Prerequisites + run-instructions sections for new service: <name>. Cover port, healthcheck URL, dependency on existing services." |
| Runner-setup | "Add a setup task to the task table installing and configuring: <runner-name>. Task must touch the runner's config file and add invocation script. Move this BEFORE any task that produces TCs of that type." |
| Cross-section | "Resolve the mismatch: <specific A vs B>. Either add the missing task / file table row, or remove the orphaned declaration." |
| Config drift (C1 — new dep) | "Add task touching `docs/config/project-commands.yaml preflight:` — append an install or smoke-import command for the new dep(s): <list>. Use the language's idiomatic `-c \"import <pkg>\"` equivalent or the package manager's frozen-lockfile install." |
| Config drift (C2 — new service) | "Add task touching `docs/config/stack-smoke.md` — append new `# <stack-id>` section with `Run:` / `Docker:` bullets (and `Migrate:` when schema migration required). The new service is: <name> on port <port>." |
| Config drift (C3 — new port) | "Add task updating the existing `# <stack-id>` section in `docs/config/stack-smoke.md` — update `Run:` and `Docker:` bullets to use port <new-port>. Existing entry on port <old-port>." |

### Anti-pattern

- Bypass the rubric by editing the verdict line directly. The rubric is the contract that downstream phases trust; lying about it breaks the contract for everyone reading the state file.
- Resolve a wiring failure by deleting the new module from the file table. The module is in scope per the story PRD; removing it from PLAN doesn't remove the need — it just hides the gap until /arh-implement produces a half-built feature.
- Treat docs as carry-forward. Documentation is part of the deliverable, not a follow-up.


## Test strategy

Goal: declare exactly which tests will exist, where they live, and which TC ids they cover.

### Mapping

PLAN.md Section "Test Strategy":

```
| Layer       | Test path                                | TCs covered  | Notes                          |
|-------------|------------------------------------------|--------------|--------------------------------|
| Unit        | src/checkout/promoStack.test.ts          | TC-01..03    | pure logic                     |
| Integration | tests/integration/promo-stack.spec.ts    | TC-04..06    | uses test DB                   |
| E2E         | tests/e2e/promo-stack.spec.ts (Playwright)| TC-07..08   | runs against staging API       |
| Performance | tests/perf/promo-preview.k6.js           | TC-09        | budget: p95 < 250ms @ 100 RPS  |
| Security    | manual checklist                         | TC-10        | covered in /arh-security-review    |
```

Every TC in `docs/test-cases/$ARGUMENTS.json` must appear in this table OR be flagged as `manual: true` in the JSON.

### Coverage gates

- Unit coverage threshold (per `harness.yaml` — fall back to 80% if not set).
- E2E suite must be green pre-commit (enforced by `/arh-implement` Step 2).

### Deferred execution is constrained

A test layer may note "Execution: deferred to /arh-validate-feature" only with an explicit reason (e.g. needs staging, needs seeded external system). Even then, the task that authors the spec MUST include an **author-time smoke**: the spec compiles/lints under the runner's own parse or dry-run mode, and every route, selector, fixture, and seed user it references exists in the codebase at authoring time. "Authored but never executed" specs reliably fail on first real run — wrong runner APIs, assertions on screens that don't exist, missing seed data — and those are authoring defects that belong to `/arh-implement`, not validation-round noise.
- Performance test runs only on PRs marked `perf` label; not gating CI for every PR.

### Anti-pattern

- Don't mock the database in integration tests.
- Don't promote a unit test to "integration" by giving it a real connection without a network boundary.
- Don't write test names that mirror code structure (`testApplyPromoStack_inner_helper_path1`); name by behaviour.

### No-placeholder rule (run before Phase 5)

After Phases 1–4 are written, the agent MUST grep `docs/features/$ARGUMENTS/PLAN.md`
for placeholder phrases. ANY match = FAIL; agent self-corrects with concrete content.

**Forbidden patterns** (case-insensitive):

| Pattern | Why forbidden |
|---|---|
| `TBD`, `TBA`, `to be determined`, `to be announced` | Decision dodged |
| `TODO`, `to do`, `FIXME` | Implementation leakage; PLAN is not a backlog |
| `as appropriate`, `as needed`, `as required` | Means "I didn't decide" |
| `add error handling`, `handle errors`, `proper validation` | Vague placeholder for real spec |
| `similar to <X>`, `like <X> but` (without concrete delta) | Refers to undefined precedent |
| `details to follow`, `more details later`, `to be detailed` | Postponed work disguised as commitment |
| `appropriate validation`, `appropriate error message` | "Appropriate" = "I don't know" |
| `lorem ipsum`, `placeholder text` | Fake content |
| `your <X> here`, `<insert X>`, `[X here]` | Template literals leaked |

**Allowed exceptions**:

- Code blocks containing snippets with `// TODO` from existing referenced source — cite path and line, do not introduce new TODOs.
- Risk table cell `accepted (<adr-id>)` — explicit acceptance, not deferred work.

```bash
# Agent runs this (or equivalent) before Phase 5:
grep -nEi "TBD|to be determined|TODO|FIXME|as appropriate|as needed|add error handling|similar to|details to follow|lorem ipsum|placeholder text" docs/features/$ARGUMENTS/PLAN.md
```

A clean PLAN has zero hits. Hits → revise the offending section with concrete content.
If a value is genuinely unknown, the answer is NOT a placeholder — it is either a research
follow-up (escalate back to /arh-research) or an ADR (document the decision in § Architecture decisions).

