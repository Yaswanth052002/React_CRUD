---
name: review-assessment
description: Review a diff — context load, file categorisation, six-dimension assessment + scope-creep/adr-violation, REVIEW.md format, verdict rule, state write. Used by code-review-agent.
user-invocable: false
---
# Review assessment

The method for reviewing a diff for architecture, pattern adherence, ADR honoring, and scope discipline. Apply the passes in order; findings stream into one report.

## Context load

Load every input the review depends on. Order matters — later sources override earlier when they conflict:

1. `CLAUDE.md` — project conventions, branch + commit + PR rules.
2. Every project rule whose `paths:` glob matches at least one file in the diff. Path-scoped rules NOT matching files in the diff are skipped to keep context lean.
3. `docs/features/<story_id>/REQUIREMENTS.md` and `docs/features/<story_id>/PLAN.md` if a story id is known.
4. `docs/research/<story_id>.md` (for the risk register — review checks that PLAN addressed each risk).
5. PR body text (when mode is pr-url or pr-number) — for "Migration / backout" notes and human-supplied caveats.

Consult `security-review-checklist` only when the review touches authn/authz, crypto, or external trust boundaries; full /arh-security-review is a separate command.

Output:

```
Context loaded.
  Rules active:    <N>      (e.g. nextjs-security, pydantic-models, security-baseline)
  Story id:        <id> | unknown
  PRD/Plan:        <linked> | not found
  PR body:         <bytes>  | n/a
```

## File categorisation

Bucket every changed file so the assessment applies the right concerns to each:

| Category    | Match (heuristics; tune per-stack overlay)                       | Concerns to apply                                       |
|-------------|------------------------------------------------------------------|---------------------------------------------------------|
| Screens     | `app/**/page.tsx`, `screens/**/*.tsx`, `pages/**/*.{ts,tsx}`     | Routing, data-fetching strategy, server vs client       |
| Components  | `src/components/**`, `packages/*/src/**/*.{tsx,vue,svelte}`      | Composition, props contracts, a11y, perf                |
| Services    | `src/services/**`, `services/**/*.py`, `pkg/*/service.go`        | Boundary correctness, error handling, contracts         |
| Hooks       | `src/hooks/**`, `**/use*.ts`                                     | Stable identity, dependency arrays, side-effect safety  |
| Stores      | `src/stores/**`, state libs (Zustand, Redux, Pinia, etc.)        | Selectors, persistence, hydration                       |
| Routes/API  | `routes/**`, `app/api/**`, `src/api/**`, FastAPI/Express handlers | Input validation, authn/authz, error envelope           |
| Repositories| `src/db/repos/**`, `src/dao/**`                                  | Query shape, indexes, N+1, transaction boundaries       |
| Tests       | `**/*.test.*`, `**/*.spec.*`, `tests/**`                          | Naming by behaviour, no skips, no mocks at integration  |
| Migrations  | `**/migrations/**`                                               | Backfill strategy, reversibility, lock duration         |
| Config      | `*.toml`, `*.yaml`, `*.json`, `Dockerfile`, `*.lock`              | Secrets discipline, version pinning                     |
| Docs        | `*.md`                                                           | Truthful claims, no broken links                        |

Output a small count table. Use the categorisation to weight findings — security-shaped issues in Routes/API outweigh comment style in Components.

## Six-dimension assessment + two scoped categories

Walk the diff against six named dimensions PLUS two scoped categories, attaching severity per finding. The dimensions are stable so reports are comparable across PRs.

1. **Module structure & boundaries** — packaging, layering, single-responsibility, public/private surface.
2. **Design patterns** — does the code follow the established patterns from the /arh-research Pattern map (skill `research-assessment`)? Or invent a new shape gratuitously?
3. **Component / module architecture** — composition, props/parameters contracts, dependency direction.
4. **Integration points** — error envelope, retry strategy, timeouts, idempotency.
5. **Testability** — pure-where-possible, no hidden globals, deterministic seams.
6. **Safety & security** — input validation, secrets, PII discipline, authn/authz, supply chain.

Scoped categories:

7. **scope-creep** (High / Medium) — diff edits files NOT in the active task's declared file list, OR refactors adjacent code with no traceable task. Violates the `surgical-changes` rule. Read `docs/features/<id>/PLAN.md` task table for the declared per-task file list; any out-of-scope edit is a `scope-creep` finding.

8. **adr-violation** (Critical / High) — diff contradicts a mini-ADR in PLAN.md `## Architecture Decisions` section OR a full ADR cited under `docs/adr/<id>.md`. Read the ADR list at context-load; every contradiction is an `adr-violation` finding. Escalation paths (`/arh-implement` Step 4): re-scope, write a superseding ADR, or pause.

### Severity legend

| Sev      | Meaning                                                                         | CI gate |
|----------|---------------------------------------------------------------------------------|---------|
| CRITICAL | Ship-blocking. Correctness, security, or production-stability issue.            | Fail    |
| HIGH     | Significant defect. Should be fixed before merge.                               | Fail    |
| MEDIUM   | Quality issue. Not blocking, but cite the rule and request follow-up.           | Pass    |
| LOW      | Nice-to-have. Mention without blocking.                                         | Pass    |

### Per-finding format

- **Category**: one of the six dimensions OR `scope-creep` OR `adr-violation`
- **Severity** (CRITICAL/HIGH/MEDIUM/LOW)
- **Code reference**: `path:line`
- **Source**: `rules/<name>.md` for dimension findings; `PLAN.md task <T-N>` for scope-creep; `ADR-<n>` or `docs/adr/<id>.md` for adr-violation
- **Description**: one paragraph max
- **Suggested fix**: one paragraph max

### Anti-pattern

- Don't grade style. The linter handles style.
- Don't grade business logic alone. Humans handle that.
- Don't list issues without a rule citation. If no rule applies, the finding is opinion — drop it or escalate to `/arh-research` to capture a new convention.

## Report

Produce a single human-readable report at `docs/features/<story_id>/REVIEW.md` (or `docs/reviews/REVIEW-<DATE>.md` when story id is unknown). Then write state.

```
# Code Review — <target_ref>

- Date: <iso8601>
- Mode: <pr-url|pr-number|branch|story|current>
- Files reviewed: <N>
- Verdict: PASS | PASS WITH WARNINGS | BLOCKED

## Executive summary

<one paragraph: what changed at a high level, what is solid, what blocks>

🟢 strengths   |  ⚠️ warnings   |  🛑 blockers

## Findings summary

| Severity | Count | Category distribution                                              |
|----------|-------|--------------------------------------------------------------------|
| CRITICAL |   1   | adr-violation (1)                                                  |
| HIGH     |   2   | scope-creep (1), integration (1)                                   |
| MEDIUM   |   4   | design-patterns (3), testability (1)                               |
| LOW      |   3   | component-architecture (3)                                         |

## Detailed findings

### CRITICAL

#### F-1 — adr-violation: implementation contradicts ADR-2
- Category: adr-violation
- Path: `src/checkout/promoStack.ts:120`
- Source: PLAN.md `## Architecture Decisions` → ADR-2 (feature-flag guard)
- Description: New code path bypasses the `promo_stack_v2` feature flag declared in ADR-2.
- Suggested fix: Wrap call site in the feature-flag check; or write a new ADR superseding ADR-2.

#### F-2 — scope-creep: diff edits files outside task scope
- Category: scope-creep
- Path: `src/orders/legacyOrder.ts:1-47`
- Source: PLAN.md task T-02 file list (excludes legacyOrder.ts)
- Description: 47-line refactor of unrelated module not scoped to any task.
- Suggested fix: Revert the edit; move to a separate carry-forward task in PLAN.md.

### HIGH
…
### MEDIUM
…
### LOW
…

## What went well

- <one or more concrete bullet points>

## Recommendation

<PASS | PASS WITH WARNINGS | BLOCKED>

<one paragraph: what the next action is>
```

### Verdict rules (unified with state schema and /arh-implement Step 4)

- `PASS`              — no CRITICAL, no HIGH, and ≤3 MEDIUM. Exit 0.
- `PASS WITH WARNINGS` — one HIGH OR many MEDIUMs. Exit 0. PR body must flag the warnings.
- `BLOCKED`           — any CRITICAL OR two-or-more HIGH. Exit 1.

These are the literals the state schema, `/arh-implement` Step 4, and the code-review-agent hand-off ALL use. Do not emit `APPROVED` / `APPROVED WITH COMMENTS` / `CHANGES REQUIRED` — those were a legacy vocabulary and contradicted downstream readers.

### State write (mandatory, unconditional)

After writing the report, update state per `docs/state/SCHEMA.md § Writer rule` for the resolved story id. `review` and `phase` are B-tier (mirrored); `review_report` is P-tier (per-feature only). PRIMARY (`docs/features/<id>/state.json`) AND MIRROR (`docs/state/features.json[<id>]`) for B-tier fields:

```json
{
  "review":        "PASS | PASS WITH WARNINGS | BLOCKED",
  "review_report": "docs/features/<id>/REVIEW.md",
  "phase":         "review",
  "last_updated":  "<iso8601>"
}
```

State write runs regardless of issue-tracker `provider`. When invoked via `/arh-implement` Step 4, `/arh-implement` Step 5 already writes the `review` literal — this write is idempotent (same value), but `review_report` is added here so downstream readers always know where the artefact lives.

When invoked standalone against a PR with no story id, write only the report; no state write happens (no feature record to attach to).

### Anti-pattern

- Emit `APPROVED` or `CHANGES REQUIRED` — these contradict the schema and break the precondition matrix. Use `PASS`/`PASS WITH WARNINGS`/`BLOCKED` only.
- Skip `review_report` — leaves downstream readers (PR body builder, tracker comment) unable to link the artefact.
