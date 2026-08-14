# Product PRD Structure

## Write rule

Write the PRD in **3 batches**. Do not produce the entire document in a single Write operation.

- **Batch 1** — `Write` tool: document header + Executive Summary + §1 Problem Statement + §2 Goals & Non-Goals + §3 Stakeholders & Users + §4 Solution Overview
- **Batch 2** — `Edit` (append): §5 User Journeys + §6 Functional Requirements + §7 Non-Functional Requirements + §8 Technical Constraints & Dependencies + §9 Security & Privacy
- **Batch 3** — `Edit` (append): §10 Analytics & Instrumentation + §11 Success Metrics & KPIs + §12 Risks & Mitigations + §13 Release Strategy + §14 Timeline & Milestones + §15 Open Questions + domain sections (if any) + Appendix

After each batch, output one line confirming: *"Batch N written — continuing..."*

## Annotation rules

Mark every section (or subsection) where you have inferred, extrapolated, or made an assumption with:
```
<!-- AI-drafted: review required -->
```
Always place the tag at the **top** of the section or sub-section it flags — before any content, table, or blockquote — never at the bottom.

Mark any field the user must fill in that cannot be inferred from context with:
```
{TBD}
```
Do not invent company names, team names, numeric targets, or dates that were not provided. Use `{TBD}` instead.

## Field mapping

**Content rule:** If the mapped context field is absent, "TBD", or empty → write `{TBD}` with the guidance note from the template placeholder text. Never invent specifics.

**Gap-answer override:** If the `GAP ROUND ANSWERS` block in the context (see `context_format_path` for its format) contains an entry whose section label matches the section being filled, use that answer instead of the round-answer field(s) listed below for that section — it was collected specifically because the round answer was insufficient.

| Section | Fill from context field(s) | Notes |
|---|---|---|
| Document header | `AUTHOR`, `APPROVERS`, `CONFIDENTIALITY` | Use today's date for DATE; `{slug}` for Document ID |
| Executive Summary | `PROBLEM STATEMENT` + `BUSINESS GOAL` + `SUCCESS VISION` | 3–5 sentences synthesised; mark AI-drafted |
| §1.1 Current Situation | `PROBLEM STATEMENT` | |
| §1.2 Root Cause | — | AI-drafted; mark tag |
| §1.3 Business Impact | `BUSINESS GOAL` | Quantify if data provided |
| §1.4 Evidence & Data Points | `EVIDENCE & DATA POINTS` | If "none": "No quantitative evidence provided — recommend gathering baseline data before launch." |
| §2.1 Business Goals | `BUSINESS GOAL` + `KPIs & SUCCESS METRICS` | 2–4 rows; `{TBD}` for missing targets and timeline |
| §2.2 Product Goals | `IN SCOPE` + `CORE FEATURES` | Bullet list of 3–5 goals |
| §2.3 Non-Goals | `OUT OF SCOPE` | Include reasons if given |
| §2.4 Assumptions | — | AI-drafted from context; mark tag |
| §3.1 Stakeholder Map | `APPROVERS` | Derive rows from named approvers; mark AI-drafted |
| §3.2 Primary Persona | `PRIMARY PERSONA` | Fill attribute table; mark AI-drafted |
| §3.3 Secondary Users | `SECONDARY USERS` | "None identified." if "none" |
| §3.4 Anti-Personas | `OUT OF SCOPE` + `PRIMARY PERSONA` | AI-drafted; mark tag |
| §4.1 Solution Summary | `ONE-LINE DESCRIPTION` + `IN SCOPE` | 2–3 sentences |
| §4.2 Core Capabilities | `CORE FEATURES` | Assign MoSCoW by list order; set Version to v1.0 |
| §4.3 Key Value Proposition | — | AI-drafted from persona + solution; mark tag |
| §4.4 Alternatives Considered | — | AI-drafted; mark tag |
| §5.1 Primary Journey | `PRIMARY USER JOURNEY` | Step table format; mark system responses AI-drafted if not stated |
| §5.2 Secondary Journeys | `CORE FEATURES` + `IN SCOPE` | AI-drafted; mark tag |
| §5.3 Edge & Error Paths | — | AI-drafted; mark tag |
| §6.1 Must Have | `CORE FEATURES` + `IN SCOPE` | Highest-priority items; IDs start at FR-001 |
| §6.2 Should Have | `CORE FEATURES` (mid-priority) | AI-drafted; mark tag |
| §6.3 Could Have | `CORE FEATURES` (lower-priority) | AI-drafted; mark tag |
| §6.4 Won't Have | `OUT OF SCOPE` | Frame as requirement statements; IDs start at FR-P01 |
| §7 Non-Functional Requirements | `NON-FUNCTIONAL REQUIREMENTS` | Override template default rows where context provides specifics; keep template rows for uncovered categories with `{TBD}` targets |
| §8.1 Platform Constraints | `TECHNICAL CONSTRAINTS & INTEGRATIONS` | Bullet list |
| §8.2 Integration Dependencies | `TECHNICAL CONSTRAINTS & INTEGRATIONS` | One row per integration |
| §8.3 Third-Party Services | `TECHNICAL CONSTRAINTS & INTEGRATIONS` | "None identified." if absent |
| §8.4 Data Model | — | AI-drafted from `CORE FEATURES` + `PRIMARY USER JOURNEY`; mark tag |
| §8.5 Compliance & Regulatory | `COMPLIANCE & REGULATORY` | If domain brief present: use REGULATORY FINDINGS; mark AI-drafted |
| §9.1 Auth & Authorization | `SECURITY & AUTH MODEL` | `{TBD}` + "define authentication mechanism before development begins." if absent |
| §9.2 Data Classification | `DATA CLASSIFICATION & PRIVACY` | One row per data type; `{TBD}` for unknown fields |
| §9.3 Threat Model | — | AI-drafted from product type + §9.2; mark tag |
| §9.4 Privacy by Design | `DATA CLASSIFICATION & PRIVACY` | Bullet list; `{TBD}` + "define privacy controls with Legal before launch." if absent |
| §10.1 Measurement Approach | `ANALYTICS & INSTRUMENTATION` | `{TBD}` + "define analytics instrumentation strategy before development begins." if absent |
| §10.2 Key Events to Track | `ANALYTICS & INSTRUMENTATION` | One row per event; one placeholder row if absent |
| §11.1 North Star Metric | `KPIs & SUCCESS METRICS` | Most outcome-oriented KPI |
| §11.2 Primary KPIs | `KPIs & SUCCESS METRICS` | `{TBD}` for baseline, owner, measurement window |
| §11.3 Counter Metrics | — | AI-drafted from KPIs + domain; mark tag |
| §12 Risks & Mitigations | `RISKS` | Assign Probability/Impact from description; IDs start at R-001; Owner = `{TBD}` |
| §13.1 Launch Approach | `RELEASE STRATEGY` | `{TBD}` + "define launch approach before development begins." if absent |
| §13.2 Rollout Plan | `RELEASE STRATEGY` | Map phases to table; standard Alpha/Beta/GA placeholder rows if absent |
| §13.3 Rollback Plan | `RELEASE STRATEGY` | `{TBD}` + "define rollback plan before launch." if absent |
| §13.4 Support & Operations | — | AI-drafted; mark tag; `{TBD}` + "define support model before launch." if no context |
| §14 Timeline & Milestones | `TIMELINE & MILESTONES` | If only ship date given: create 4 standard phases with dates `{TBD}` except ship date; mark AI-drafted |
| §15 Open Questions | `OPEN QUESTIONS` | Number Q-001, Q-002 etc.; Owner and Target Resolution = `{TBD}` if not provided |
| Domain sections (§16+) | `DOMAIN BRIEF` REGULATORY FINDINGS | Append only when `DOMAIN BRIEF` ≠ "none"; number from §16; mark AI-drafted |
| Appendix A Glossary | — | AI-drafted from product domain; mark tag |
| Appendix B References & Source Documents | `REFERENCE FILE` | Placeholder links for team to complete |
| Appendix C Competitive Landscape | — | AI-drafted; mark tag |
| Appendix D Out-of-Scope Register | `OUT OF SCOPE` | Standard note if no explicit requestors/reasons |

## Completeness checklist

After writing the PRD, validate these fields are present and non-generic:

| Field | Present | Complete |
|-------|---------|---------|
| Objective / Executive Summary | | |
| Primary Persona | | |
| In Scope | | |
| Out of Scope | | |
| Success Metrics | | |
| Constraints | | |
| Integration Dependencies | | |
| Security & Auth Model | | |
| Data Classification | | |
| Analytics & Instrumentation | | |
| Release Strategy | | |
| Open Questions | | |

Flag any field that is empty or generic (e.g., "improve user experience" is not an acceptable objective).

## Completion report format

Output this report after writing the PRD. The `/arh-generate-prd` orchestrator uses it to verify success.

```
## PRD Completion Report — {Product Name}

**Output:** docs/prd/{slug}.md
**Sections written:** {N} of {15 + domain section count}
**Domain:** {detected domain name, or "none — generic PRD"}
**Domain sections appended:** {list section names, or "none"}
**AI-drafted sections:** {list section numbers that are marked AI-drafted}
**TBD placeholders:** {count} — fields requiring human input
**Completeness check:** {PASS | FAIL — list missing fields if FAIL}

**Quality notes:**
{1–3 sentences on where the PRD is strong and where the human reviewer should focus attention first.}

**Recommended first review actions:**
1. {highest-priority gap or uncertainty}
2. {second priority}
3. {third priority if domain sections were appended: "Validate domain-specific sections with legal/compliance team"}
```
