# {Product Name} — Product Requirements Document

| Field | Value |
|-------|-------|
| Version | {VERSION} |
| Date | {DATE} |
| Author | {AUTHOR} |
| Status | Draft |
| Confidentiality | {Internal / Confidential / Public} |
| Document ID | PRD-{ID} |

**Approvers**

| Name | Role | Signature | Date |
|------|------|-----------|------|
| {TBD} | Product Owner | | |
| {TBD} | Engineering Lead | | |
| {TBD} | Design Lead | | |
| {TBD} | Legal / Compliance | | |

**Revision History**

| Version | Date | Author | Summary of Changes |
|---------|------|--------|--------------------|
| 1.0 | {DATE} | {AUTHOR} | Initial draft |

---

## Executive Summary

{3–5 sentences: what we're building, why now, who benefits, and expected outcomes.}

---

## 1. Problem Statement

### 1.1 Current Situation
{What does the current experience look like? What gap or pain exists?}

### 1.2 Root Cause
{Why does this problem exist? What structural or systemic reason prevents users from solving it today?}
<!-- AI-drafted: review required -->

### 1.3 Business Impact
{What happens if this is not solved? Quantify if data available; otherwise describe qualitatively.}

### 1.4 Evidence & Data Points
{Quantitative or qualitative evidence: usage data, user research, competitive signals. If none: "No quantitative evidence provided — recommend gathering baseline data before launch."}
<!-- AI-drafted: review required -->

---

## 2. Goals & Non-Goals

### 2.1 Business Goals

| Goal | Metric | Target | Timeline |
|------|--------|--------|----------|
| {goal} | {metric} | {TBD} | {TBD} |

### 2.2 Product Goals

{Bullet list of 3–5 product-level goals.}

### 2.3 Non-Goals (This Version)

> Deliberate exclusions. Moving any item into scope requires a formal change request.

{Bullet list of explicit exclusions, with brief rationale for each.}

### 2.4 Assumptions

> The PRD is valid under these assumptions. If any assumption is invalidated, sections affected are noted.

| # | Assumption | Risk if Wrong | Affects Sections |
|---|------------|---------------|-----------------|
| A-001 | {assumption} | {risk} | {section list} |

---

## 3. Stakeholders & Users

### 3.1 Stakeholder Map

| Stakeholder | Role | Interest / Concern | Involvement |
|-------------|------|-------------------|-------------|
| {name/role} | {org role} | {what they care about} | Approver / Informed / Consulted |

### 3.2 Primary Persona

<!-- AI-drafted: review required -->

| Attribute | Detail |
|-----------|--------|
| Role | {role} |
| Context | {when/how they encounter this product} |
| Primary Goal | {what they are trying to accomplish} |
| Pain Points | {current frustrations} |
| Success Looks Like | {what a good outcome feels like} |
| Tech Comfort | {Low / Medium / High} |
| Frequency of Use | {Daily / Weekly / Ad-hoc} |

### 3.3 Secondary Users

{Table: Role + Key Need for each secondary user, or "None identified."}

### 3.4 Anti-Personas

> Users this product is NOT designed for.

<!-- AI-drafted: review required -->

{1–2 anti-personas with reason.}

---

## 4. Solution Overview

### 4.1 Solution Summary

{2–3 sentences on what we're building at a high level.}

### 4.2 Core Capabilities

| # | Capability | Priority (MoSCoW) | Version |
|---|-----------|------------------|---------|
| C-001 | {capability} | Must Have | v1.0 |

### 4.3 Key Value Proposition

<!-- AI-drafted: review required -->

> For {primary persona}, **{Product Name}** is the {category} that {key benefit}, unlike {current alternative}.

### 4.4 Solution Alternatives Considered

| Alternative | Why Not Chosen |
|-------------|---------------|
| {alt 1} | {reason} |

---

## 5. User Journeys

### 5.1 Primary Journey: {Journey Name}

**Preconditions:** {what must be true before the journey begins}

| Step | Actor | Action | System Response |
|------|-------|--------|----------------|
| 1 | {actor} | {action} | {response} |

**Outcome:** {what the user has achieved}

### 5.2 Secondary Journeys

<!-- AI-drafted: review required -->

{1–2 secondary flows (e.g., onboarding, error recovery, settings).}

### 5.3 Edge & Error Paths

<!-- AI-drafted: review required -->

| Scenario | Trigger | System Response | Recovery Path |
|----------|---------|-----------------|--------------|
| {name} | {trigger} | {response} | {recovery} |

---

## 6. Functional Requirements

> Prioritized using MoSCoW. Each requirement is testable and implementation-agnostic.

### 6.1 Must Have — Launch Blockers

| ID | Requirement | Acceptance Criteria | Source |
|----|-------------|--------------------|----|
| FR-001 | {requirement} | {criteria} | {persona / journey / stakeholder} |

### 6.2 Should Have — Important, Not Launch Blockers

<!-- AI-drafted: review required -->

| ID | Requirement | Acceptance Criteria | Source |
|----|-------------|--------------------|----|

### 6.3 Could Have — Nice to Have

<!-- AI-drafted: review required -->

| ID | Requirement | Acceptance Criteria | Source |
|----|-------------|--------------------|----|

### 6.4 Won't Have — This Version (Parking Lot)

| ID | Requirement | Reason Deferred | Revisit Version |
|----|-------------|----------------|----------------|
| FR-P01 | {requirement} | {reason} | {TBD} |

---

## 7. Non-Functional Requirements

<!-- AI-drafted: review required -->

| ID | Category | Requirement | Target | Measurement Method | Notes |
|----|----------|-------------|--------|--------------------|-------|
| NFR-001 | Performance | Page load time | < 2s (p95) | Synthetic monitoring | |
| NFR-002 | Availability | Uptime | 99.9% monthly | Uptime monitoring | |
| NFR-003 | Scalability | Concurrent users | {TBD} | Load testing | |
| NFR-004 | Security | Authentication | {TBD} | Security review | |
| NFR-005 | Privacy | PII handling | {TBD} | Privacy review | |
| NFR-006 | Accessibility | WCAG level | AA | Automated + manual audit | |
| NFR-007 | Compatibility | Browser / device | {TBD} | Cross-browser testing | |
| NFR-008 | Localization | Languages | {TBD} | | |
| NFR-009 | Data Retention | Retention period | {TBD} | | |
| NFR-010 | Audit & Logging | Event logging | {TBD} | | |

---

## 8. Technical Constraints & Dependencies

### 8.1 Platform & Framework Constraints

{Bullet list: platform, language, or framework restrictions.}

### 8.2 Integration Dependencies

| System / API | Integration Type | Required For | Owner | Status |
|-------------|-----------------|--------------|-------|--------|
| {system} | REST / Webhook / SDK | {feature} | {TBD} | Confirmed / TBD |

### 8.3 Third-Party Services

| Service | Purpose | License / Cost | Risk if Unavailable |
|---------|---------|----------------|---------------------|
| {service} | {purpose} | {TBD} | {risk} |

### 8.4 Data Model (High Level)

<!-- AI-drafted: review required -->

{Key entities and their relationships. Bullet list or simple table. Not a schema — conceptual only.}

### 8.5 Compliance & Regulatory Requirements

<!-- AI-drafted: review required -->

{Domain-specific regulations (FERPA, COPPA, HIPAA, SOC 2, WCAG, etc.) with a one-sentence description of the obligation and a link to the relevant domain brief or external reference.}

---

## 9. Security & Privacy

<!-- AI-drafted: review required -->

> This section documents security and privacy design decisions. Validate with the Security team before development begins.

### 9.1 Authentication & Authorization
{How users authenticate. Role-based access model if applicable.}

### 9.2 Data Classification

| Data Type | Classification | Storage | Encryption at Rest | Encryption in Transit |
|-----------|---------------|---------|-------------------|----------------------|
| {data type} | PII / Confidential / Public | {location} | Yes / No | Yes / No |

### 9.3 Threat Model (Summary)

| Threat | Likelihood | Impact | Mitigation |
|--------|------------|--------|------------|
| {threat} | High / Medium / Low | High / Medium / Low | {control} |

### 9.4 Privacy by Design Principles Applied

{Bullet list of privacy controls: data minimization, purpose limitation, consent mechanism, right to deletion, etc.}

---

## 10. Analytics & Instrumentation

### 10.1 Measurement Approach

{How data will be collected: analytics platform, event taxonomy, instrumentation strategy.}

### 10.2 Key Events to Track

| Event Name | Trigger | Properties | Used By |
|------------|---------|------------|---------|
| {event} | {when it fires} | {key properties} | {KPI it feeds} |

---

## 11. Success Metrics & KPIs

### 11.1 North Star Metric

> {The single metric that best captures whether the product is delivering value.}

### 11.2 Primary KPIs

| KPI | Baseline | Target | Measurement Window | Owner |
|-----|----------|--------|-------------------|-------|
| {kpi} | {TBD} | {TBD} | {TBD} | {TBD} |

### 11.3 Counter Metrics (Guard Rails)

<!-- AI-drafted: review required -->

> Monitor these to ensure optimizing primary KPIs doesn't create regressions elsewhere.

| Counter Metric | Alert Threshold | Action if Breached |
|---------------|----------------|-------------------|
| {metric} | {threshold} | {action} |

---

## 12. Risks & Mitigations

| ID | Risk | Category | Probability | Impact | Mitigation | Owner | Status |
|----|------|----------|-------------|--------|------------|-------|--------|
| R-001 | {risk} | Technical / Market / Regulatory / Dependency / Team | High / Med / Low | High / Med / Low | {mitigation} | {TBD} | Open |

---

## 13. Release Strategy

### 13.1 Launch Approach

{Full launch / Phased rollout / Feature-flagged / Beta program — describe the chosen approach and rationale.}

### 13.2 Rollout Plan

| Phase | Audience | % Traffic | Entry Criteria | Exit Criteria |
|-------|----------|-----------|---------------|---------------|
| Alpha | Internal | 100% internal | {criteria} | {criteria} |
| Beta | {segment} | {TBD}% | {criteria} | {criteria} |
| GA | All users | 100% | {criteria} | — |

### 13.3 Rollback Plan

{Conditions that trigger a rollback. Steps to revert. Owner.}

### 13.4 Support & Operations

{How the product will be supported post-launch: runbook location, on-call rotation, SLA, escalation path.}

---

## 14. Timeline & Milestones

| Phase | Description | Target Date | Key Dependencies | Owner |
|-------|-------------|-------------|-----------------|-------|
| Discovery & Design | {TBD} | {TBD} | | |
| Development | {TBD} | {TBD} | | |
| QA & Beta | {TBD} | {TBD} | | |
| Launch | {TBD} | {TBD} | | |

<!-- AI-drafted: review required -->

**Target Ship Date:** {TBD}

---

## 15. Open Questions

| ID | Question | Owner | Target Resolution | Status |
|----|----------|-------|------------------|--------|
| Q-001 | {question} | {TBD} | {TBD} | Open |

---

{DOMAIN SECTIONS — appended at §16+ when domain research brief is provided}

---

## Appendix

### A. Glossary

<!-- AI-drafted: review required -->

| Term | Definition |
|------|-----------|
| {term} | {definition} |

### B. References & Source Documents

| Document | Location | Notes |
|----------|----------|-------|
| {doc name} | {link / path} | {relevance} |

### C. Competitive Landscape

<!-- AI-drafted: review required -->

| Competitor / Alternative | Current Approach | Our Differentiation |
|-------------------------|-----------------|---------------------|
| {competitor} | {approach} | {differentiation} |

### D. Out-of-Scope Feature Register

> Full record of features requested and deliberately excluded, with rationale. Input for future roadmap planning.

| Feature | Requested By | Reason Not In Scope | Revisit |
|---------|-------------|--------------------|---------| 
| {feature} | {requestor} | {reason} | {version / never} |
