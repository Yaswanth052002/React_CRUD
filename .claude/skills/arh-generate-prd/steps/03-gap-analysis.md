# Gap Analysis

Instructions for the `@gap-analysis-agent` to map extracted content to PRD template sections and produce a gap report.

---

## Input

- `docs/prd/.wip/{slug}-extraction.json`
- PRD template section list (15 sections + appendix)

## Output

`docs/prd/.wip/{slug}-gaps.json`

---

## Scoring rules

Score each PRD section as one of:

| Score | Meaning |
|-------|---------|
| `FILLED` | Enough content extracted to write the section without asking the user anything |
| `PARTIAL` | Some content extracted but key sub-fields are missing — one targeted question can fill the gap |
| `MISSING` | No relevant content extracted — section cannot be written without user input |

**Score conservatively.** When in doubt between FILLED and PARTIAL, score PARTIAL. It is better to ask one extra question than to produce a section that requires heavy human revision.

---

## Scored sections

Score exactly **16 sections** — the Executive Summary plus the 15 numbered PRD sections. Sub-sections (2.4, 3.1, 3.2, 3.3) are rolled into their parent section score; the parent is FILLED only if all sub-sections meet their criteria. This keeps the section count aligned with the 16 `##`-level headings written by the PRD generation step (Executive Summary + §1–§15), making the gap report percentage and the orchestrator's verify threshold consistent.

## Section-by-section scoring criteria

| Section (1 of 16) | FILLED if | PARTIAL if | MISSING if |
|---------|-----------|------------|------------|
| Executive Summary | problem + goal + persona all extracted | any one of the three missing | all three missing |
| 1. Problem Statement | current_situation + business_impact extracted | only one sub-field extracted | no problem content extracted |
| 2. Goals & Non-Goals | ≥2 business goals + ≥1 non-goal + ≥1 assumption extracted | goals or non-goals missing; assumptions absent | nothing extracted |
| 3. Stakeholders & Users | ≥2 stakeholders with roles + primary persona role/goal/pain-points all extracted | stakeholders or persona sub-fields partially missing | nothing extracted |
| 4. Solution Overview | summary + ≥3 capabilities extracted | summary extracted but <3 capabilities | nothing extracted |
| 5. User Journeys | primary journey with ≥3 steps extracted | journey described but steps vague | nothing extracted |
| 6. Functional Requirements | ≥5 must-have requirements extracted | requirements listed but no MoSCoW priority | nothing extracted |
| 7. Non-Functional Requirements | ≥4 NFR categories populated with targets | categories listed but no targets | nothing extracted |
| 8. Technical Constraints | platform + ≥1 integration extracted | one of platform or integrations missing | nothing extracted |
| 9. Security & Privacy | auth model + ≥1 data classification extracted | auth model only | nothing extracted |
| 10. Analytics & Instrumentation | measurement approach + ≥2 events extracted | approach only, no events | nothing extracted |
| 11. Success Metrics | north star + ≥2 KPIs extracted | KPIs listed but no north star | nothing extracted |
| 12. Risks | ≥2 risks with mitigations extracted | risks listed but no mitigations | nothing extracted |
| 13. Release Strategy | launch approach + timeline extracted | one of the two missing | nothing extracted |
| 14. Timeline | ≥2 milestones with dates extracted | milestones listed but no dates | nothing extracted |
| 15. Open Questions | ≥1 question extracted | — | nothing extracted (score MISSING only if §6 also has gaps) |

---

## Gap report output schema

```json
{
  "slug": "{slug}",
  "analyzed_at": "{ISO8601}",
  "overall_completeness": "{percentage — (FILLED + 0.5 * PARTIAL) / 16 * 100, rounded to nearest integer}",
  "sections": [
    {
      "section_id": "{e.g. problem-statement}",
      "section_label": "{e.g. 1. Problem Statement}",
      "score": "FILLED | PARTIAL | MISSING",
      "filled_fields": ["{field names}"],
      "missing_fields": ["{field names}"],
      "gap_id": "{unique id for clarification — e.g. gap-problem-root-cause, or null if FILLED}",
      "clarification_question": "{the exact question to ask the user, or null if FILLED}",
      "clarification_priority": 1
    }
  ],
  "clarification_needed": true,
  "total_gaps": 0,
  "missing_count": 0,
  "partial_count": 0
}
```

## Gap ID format

`gap-{section-slug}-{field-slug}` — e.g. `gap-problem-root-cause`, `gap-persona-pain-points`, `gap-metrics-north-star`

## Clarification priority

Assign priority 1–5 (1 = ask first):

| Priority | Sections |
|----------|---------|
| 1 | product identity, problem statement, primary persona |
| 2 | business goals, non-goals, solution summary |
| 3 | functional requirements, success metrics |
| 4 | technical constraints, NFRs, security |
| 5 | analytics, risks, release strategy, timeline, open questions |

Sort all gaps by priority ascending before the orchestrator batches them into clarification rounds.

---

## On completion

Write `docs/prd/.wip/{slug}-gaps.json`.

Output a summary:
```
Gap analysis complete:
  Sections scored:  16
  FILLED:           {N}
  PARTIAL:          {N}  
  MISSING:          {N}
  Overall completeness: {(FILLED + 0.5 * PARTIAL) / 16 * 100}%
  Clarification rounds estimated: {ceil(total_gaps / 4)}
```
