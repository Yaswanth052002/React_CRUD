# PRD Generation

Instructions for the `@generate-prd-agent` to write the final PRD using the template, extraction, and clarification answers.

---

## Input

Use the paths passed to you in the prompt — do not derive or hardcode them:

- Template: `{template_path}` (passed as "Template path")
- Extraction: `{extraction_path}` (passed as "Extraction path")
- Gaps + clarification answers from draft: `{draft_path}` (passed as "Draft path", field: `clarification_answers`)
- Output path: `{output_path}` (passed as "Output path")

---

## Content resolution rules

For each template placeholder, resolve content in this priority order:

1. **Clarification answer** — if `clarification_answers[gap-id]` exists and is not `{TBD}`, use it
2. **Extraction field** — if the corresponding extraction field is non-null and non-empty, use it
3. **`{TBD}`** — if neither source has content, write `{TBD}` verbatim

Never invent, infer, or assume content. If a field is not in extraction or clarification answers, it becomes `{TBD}`.

---

## Write rule — 3 batches

Write the PRD in 3 batches. After each batch output: *"Batch {N} written — continuing..."*

- **Batch 1** — `Write` tool: document header + Executive Summary + §1 Problem Statement + §2 Goals & Non-Goals + §3 Stakeholders & Users + §4 Solution Overview
- **Batch 2** — `Edit` (append): §5 User Journeys + §6 Functional Requirements + §7 Non-Functional Requirements + §8 Technical Constraints & Dependencies + §9 Security & Privacy
- **Batch 3** — `Edit` (append): §10 Analytics & Instrumentation + §11 Success Metrics & KPIs + §12 Risks & Mitigations + §13 Release Strategy + §14 Timeline & Milestones + §15 Open Questions + Appendix

---

## Annotation rules

Mark every section where content was inferred, extrapolated, or lightly paraphrased from source material:
```
<!-- AI-drafted: review required -->
```
Place the tag at the **top** of the section — before any content.

Mark any field that resolved to neither extraction nor clarification answer:
```
{TBD}
```

Mark any field populated from extraction but flagged as PARTIAL in the gap report:
```
<!-- extracted: verify accuracy -->
```

---

## Section-by-section instructions

### Header block

- `{VERSION}` → `1.0 — Draft`
- `{DATE}` → today's date (passed in by orchestrator)
- `{AUTHOR}` → git user name from draft state `contributors[0]`
- `{Document ID}` → `PRD-{slug}`
- Approvers table → 4 `{TBD}` rows (name, role, signature, date)
- Revision history → one row: version 1.0, today's date, author, "Initial draft — generated from reference material"

### Executive Summary

Synthesize from: `problem_statement.current_situation` + `goals.business_goals[0]` + `stakeholders.primary_persona` + `metrics.north_star`.
3–5 sentences. Mark `<!-- AI-drafted: review required -->`.

### §1 Problem Statement

- 1.1 → `problem_statement.current_situation`
- 1.2 → `problem_statement.root_cause` — if null, write `{TBD}` and mark AI-drafted
- 1.3 → `problem_statement.business_impact`
- 1.4 → `problem_statement.evidence` — if null: "No quantitative evidence provided in reference material — recommend gathering baseline data before launch."

### §2 Goals & Non-Goals

- 2.1 → `goals.business_goals` — one table row per goal; target column = `{TBD}` if not extracted
- 2.2 → `goals.product_goals` — bullet list
- 2.3 → `goals.non_goals` — bullet list with rationale if extracted
- 2.4 → `goals.assumptions` — one table row per assumption; if empty write one placeholder row

### §3 Stakeholders & Users

- 3.1 → `stakeholders.stakeholder_map` — one row per stakeholder
- 3.2 → `stakeholders.primary_persona` — fill the attribute table; mark `<!-- AI-drafted: review required -->`
- 3.3 → `stakeholders.secondary_users` — table or "None identified."
- 3.4 → `stakeholders.anti_personas` — use extraction field if present; otherwise write one `{TBD}` placeholder row. Mark `<!-- AI-drafted: review required -->`. Do not infer.

### §4 Solution Overview

- 4.1 → `solution.summary`
- 4.2 → `solution.capabilities` — one table row per capability; assign MoSCoW based on position and any explicit priority signals in the source
- 4.3 → Value proposition — synthesize from persona + solution summary; mark `<!-- AI-drafted: review required -->`
- 4.4 → `solution.alternatives_considered` — table; if empty write one placeholder row

### §5 User Journeys

- 5.1 → `user_journeys.primary_journey` — step table; mark system responses as `<!-- AI-drafted: review required -->` if not explicitly stated in source
- 5.2 → `user_journeys.secondary_journeys` — mark `<!-- AI-drafted: review required -->`
- 5.3 → `user_journeys.edge_cases` — mark `<!-- AI-drafted: review required -->`

### §6 Functional Requirements

- 6.1 Must Have → `functional_requirements.must_have` — IDs starting at FR-001; acceptance criteria = `{TBD}` if not extracted
- 6.2 Should Have → `functional_requirements.should_have` — mark AI-drafted if inferred
- 6.3 Could Have → `functional_requirements.could_have` — mark AI-drafted if inferred
- 6.4 Parking Lot → `functional_requirements.wont_have` — IDs starting at FR-P01

### §7 Non-Functional Requirements

- One row per extracted NFR; fill from `non_functional_requirements` array
- Supplement with standard rows for any missing categories (Performance, Availability, Accessibility, etc.) — mark those rows `<!-- AI-drafted: review required -->`
- Leave target as `{TBD}` for any row not covered by extraction

### §8 Technical Constraints & Dependencies

- 8.1 → `technical.platform_constraints` — bullet list
- 8.2 → `technical.integrations` — one row per integration
- 8.3 → `technical.third_party_services` — table
- 8.4 → `technical.data_model_concepts` — bullet list; mark `<!-- AI-drafted: review required -->`
- 8.5 → `technical.compliance_regulations` — list regulations; mark `<!-- AI-drafted: review required -->`

### §9 Security & Privacy

Mark entire section `<!-- AI-drafted: review required -->`.
- 9.1 → `security_privacy.auth_model`
- 9.2 → `security_privacy.data_classification` — one row per entry
- 9.3 → Threat model — use `risks` entries from extraction where category is security-related; otherwise write `{TBD}` rows. Mark `<!-- AI-drafted: review required -->`. Do not infer threats.
- 9.4 → `security_privacy.privacy_controls` — bullet list

### §10 Analytics & Instrumentation

- 10.1 → `metrics.measurement_approach`
- 10.2 → Key events table — if not extracted, write 2 placeholder rows and mark `<!-- AI-drafted: review required -->`

### §11 Success Metrics & KPIs

- 11.1 → `metrics.north_star`
- 11.2 → `metrics.kpis` — one row per KPI; baseline and owner = `{TBD}` if not extracted
- 11.3 → Counter metrics — infer 2–3 from KPIs and domain; mark `<!-- AI-drafted: review required -->`

### §12 Risks & Mitigations

- One row per entry in `risks` array — IDs starting at R-001
- If fewer than 2 risks extracted, infer additional from domain and technical constraints; mark AI-drafted

### §13 Release Strategy

- 13.1 → `release.launch_approach` — if null, write `{TBD}`
- 13.2 → Rollout table — placeholder rows if not extracted
- 13.3 → Rollback plan — `{TBD}` if not in source
- 13.4 → Support & operations — `{TBD}` if not in source

### §14 Timeline & Milestones

- One row per entry in `release.timeline_milestones`
- `release.target_ship_date` → **Target Ship Date** line
- If fewer than 2 milestones, create 4 standard phase rows (Discovery & Design, Development, QA & Beta, Launch) with dates = `{TBD}` except any date explicitly provided; mark `<!-- AI-drafted: review required -->`

### §15 Open Questions

- One row per item in `open_questions`
- If none extracted, write one placeholder row with `{TBD}` owner
- Number IDs Q-001, Q-002, etc.

### Appendix

- **A. Glossary** → `glossary_terms` — one row per term; mark AI-drafted
- **B. References** → list all source files from the manifest with their category label as the Notes column
- **C. Competitive Landscape** → `competitive_landscape` — one row per entry; mark AI-drafted
- **D. Out-of-Scope Feature Register** → `functional_requirements.wont_have` expanded with Requested By = `{TBD}`

---

## Completeness check

After writing, validate:

| Field | Present | Non-generic |
|-------|---------|-------------|
| Executive Summary | | |
| Primary Persona | | |
| In Scope (§4.2) | | |
| Out of Scope (§2.3) | | |
| Success Metrics (§11.2) | | |
| Technical Constraints (§8.1) | | |
| Integration Dependencies (§8.2) | | |
| Open Questions (§15) | | |

Flag any field that is empty or contains only `{TBD}`.

---

## Completion report

```
## PRD Completion Report — {Product Name}

**Output:** docs/prd/{slug}.md
**Sections written:** {N} of 15 + Appendix
**Source files used:** {N}
**Extraction fields populated:** {N} of {total}
**Clarification rounds:** {N}
**AI-drafted sections:** {list section numbers}
**TBD placeholders:** {count}
**Completeness check:** PASS | FAIL — {missing fields if FAIL}

**Quality notes:**
{1–3 sentences on strongest sections and where the reviewer should focus.}

**Recommended first review actions:**
1. {highest-priority gap}
2. {second priority}
3. Validate compliance sections (§8.5, §9) with legal/compliance team
```
