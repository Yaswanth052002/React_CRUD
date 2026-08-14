---
name: decide
description: Record a structured decision to per-feature state `decisions[]` beside the PLAN.md §1 mini-ADR — id, alternatives, chosen, blast-radius, reversibility — so reviewers query it without re-parsing prose.
when_to_use: Inside `/arh-plan-implementation` Phase 1, after writing each mini-ADR to PLAN.md §1. Also when impl-planning-agent or implementation-agent makes a non-trivial choice that wasn't anticipated in PLAN (e.g. picking a library variant mid-implementation). One entry per decision. Trivial choices (variable names, internal helper boundaries) do NOT get an entry.
user-invocable: false
allowed-tools: Read Write Edit
---
# decide — structured decision capture

## Why this skill exists

Mini-ADRs in `PLAN.md §1` are prose. Prose is fine for the human reviewer reading the plan once, but it's a poor source of truth when:

- A reviewer in `/arh-review` asks "is this choice reversible if customer X churns?" — they'd have to find and re-read the ADR.
- `/arh-security-review` wants to flag every decision with `blast_radius: system | data` for extra scrutiny.
- A future engineer asks "why redis, not postgres?" six months later and the ADR header lost the *why* in re-edits.
- An automated audit wants to count decisions, group by reversibility, or check which ones lack an ADR promotion.

This skill writes the **structured** form. PLAN.md keeps the **prose** form (the mini-ADR). They are not redundant — they serve different readers.

## When to invoke

Use `decide` when ANY of these are true:

| Trigger | Decision worth recording? |
|---|---|
| You're writing a mini-ADR in PLAN.md §1 | yes — one `decisions[]` entry per mini-ADR |
| You promote a mini-ADR to a full ADR in `docs/adr/` | yes — set `adr_ref` to the ADR id |
| Mid-implementation: agent picks library variant / DB engine / sync-vs-async at a non-trivial boundary | yes — even if no PLAN ADR exists, the choice is visible in the diff |
| Rename a helper / pick a variable name / inline a one-line util | no |

Rule of thumb: **if a competent reviewer might pick a different option from the same prompt, record it.** If three readers would all reach the same conclusion, skip.

## Record shape

`decisions[]` is a **P-tier** field — lives only in `docs/features/<id>/state.json`
(per `docs/state/SCHEMA.md § Field ownership`). No index mirror.

Append to `docs/features/<id>/state.json` at `.decisions[]`:

```json
{
  "decision_id":   "D-NN",
  "title":         "<one-line, matches PLAN.md §1 mini-ADR header>",
  "alternatives":  ["<option-a>", "<option-b>"],
  "chosen":        "<short slug, not prose>",
  "rationale":     "<one paragraph; the constraint that ruled others out — same body as mini-ADR Context>",
  "blast_radius":  "feature | service | system | data",
  "reversibility": "mechanical | medium | effectively-irreversible",
  "adr_ref":       "ADR-<NNNN> | null",
  "created_at":    "<iso8601, UTC>",
  "created_by":    "<phase/step writing this — e.g. plan-implementation/plan-authoring or implementation/01-implement>"
}
```

### Field guidance

**`decision_id`** — zero-padded `D-NN`. Sequence within the feature record, NOT globally. First decision in a feature is `D-01`, second is `D-02`, etc. If the mini-ADR header in PLAN.md is `### ADR-3: ...`, the `decision_id` here is `D-03` for symmetry — but they are independent counters; ADR-N can promote to a full `docs/adr/NNNN-*.md` while `D-NN` stays local to the feature.

**`alternatives`** — short slugs only. NOT prose. `["postgres-row-lock", "in-process-LRU"]` not `["use a postgres row lock with SELECT FOR UPDATE"]`. The reasoning is in `rationale`.

**`chosen`** — also a slug, NOT prose. `"redis-with-TTL"` not `"we use redis with a TTL of 60s"`. Specifics live in PLAN.

**`rationale`** — one paragraph. Mirror the mini-ADR `Context` body. If the mini-ADR has no Context (it should — see skill `plan-authoring` § Architecture decisions), the decision is not ADR-worthy and probably not `decisions[]`-worthy either.

**`blast_radius`** — pick the smallest accurate value:
- `feature` — wrong choice only hurts this feature. Inline retries vs library retries.
- `service` — affects this whole service. Async dispatch vs sync at boundary.
- `system` — affects ≥2 services. New external dep. Schema change shared across services.
- `data` — touches durable state. Schema migration, encoding choice, retention default. Highest scrutiny in `/arh-security-review`.

**`reversibility`** — pick the most pessimistic accurate value:
- `mechanical` — swap the lib, rewrite a file. Hours.
- `medium` — re-migration, deprecation window, careful rollout. Days–weeks.
- `effectively-irreversible` — data migrated under the choice; rolling back means data loss or incompatible migrations. Months and high risk.

**`adr_ref`** — set to the ADR id (`"ADR-0017"`) if the mini-ADR was promoted to `docs/adr/`. Otherwise `null`.

**`created_by`** — the writing site (phase/step). Helps `/arh-explain <id>` show lineage.

## Procedure

1. Confirm the decision passes the "competent reviewer might disagree" bar. If not, stop — no entry.
2. Read `docs/features/<id>/state.json`. If absent, this skill is being invoked out of order — `/arh-plan-implementation` Phase 1 must run after `/arh-plan-requirements` (which creates the per-feature file).
3. Compute the next `D-NN` by looking at existing `decisions[]` entries (default `D-01`).
4. Construct the record above. Keep slugs short; keep `rationale` to one paragraph.
5. Append to `.decisions[]` and write `docs/features/<id>/state.json` back. Preserve every other field unchanged. No index mirror — `decisions[]` is P-tier.
6. If a full ADR was authored under `docs/adr/`, set `adr_ref` accordingly. Otherwise `null`.

## Anti-patterns

- **Don't** stuff prose into `chosen` or `alternatives`. Slug-only.
- **Don't** write a `decisions[]` entry without the matching mini-ADR in PLAN.md §1. The two artefacts ship together.
- **Don't** mutate an existing entry to "update the rationale". Append a new entry that supersedes the old, and set `chosen` to the new slug; the audit trail matters more than tidiness.
- **Don't** record trivial choices. Name picking, internal helper boundaries, code-style preferences — these are not decisions in this sense.
- **Don't** mix status literals into `decisions[]`. This array is decision *records*, not workflow state. Phase status stays in the top-level fields.

## Read-only consumers

- `/arh-review` Phase 4 — filters decisions where `blast_radius ∈ {system, data}` for extra scrutiny.
- `/arh-security-review` Step 2 — flags any decision with `blast_radius: data` AND `reversibility: effectively-irreversible` for explicit sign-off.
- `/arh-explain <id>` — renders decisions chronologically with their ADR references.
- Future tooling (`harness decisions list --feature <id>`) — emits a CSV/HTML view.
