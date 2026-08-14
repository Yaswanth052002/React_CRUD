# PRD Context Format

The `/arh-generate-prd` orchestrator compiles this block after all 5 rounds complete and passes it to `create-prd-agent`. Include only fields that have values — omit empty sections.

```
=== PRD CONTEXT ===

PRODUCT NAME: {product_name — name only, no description}
ONE-LINE DESCRIPTION: {description sentence from rounds.1.answers.product_name}
SLUG: {slug}

PROBLEM STATEMENT:
{rounds.1.answers.problem}

BUSINESS GOAL:
{rounds.1.answers.business_goal}

SUCCESS VISION:
{rounds.1.answers.success_vision}

EVIDENCE & DATA POINTS:
{rounds.1.answers.evidence}

PRIMARY PERSONA:
{rounds.2.answers.primary_persona}

SECONDARY USERS:
{rounds.2.answers.secondary_users}

IN SCOPE:
{rounds.2.answers.in_scope}

OUT OF SCOPE:
{rounds.2.answers.out_of_scope}

CORE FEATURES:
{rounds.3.answers.core_features}

PRIMARY USER JOURNEY:
{rounds.3.answers.primary_journey}

NON-FUNCTIONAL REQUIREMENTS:
{rounds.3.answers.nfrs}

TECHNICAL CONSTRAINTS & INTEGRATIONS:
{rounds.3.answers.technical_constraints}

COMPLIANCE & REGULATORY:
{rounds.3.answers.compliance — or "Covered by domain brief" if domain was detected and Q5 was skipped}

SECURITY & AUTH MODEL:
{rounds.3.answers.security_auth}

DATA CLASSIFICATION & PRIVACY:
{rounds.3.answers.data_classification}

{If any rounds.3.answers entries have "source": "domain":}
DOMAIN-SPECIFIC REQUIREMENTS ({detected_domain}):
{Each domain-annotated Round 3 answer, formatted as a bullet list}

KPIs & SUCCESS METRICS:
{rounds.4.answers.kpis}

ANALYTICS & INSTRUMENTATION:
{rounds.4.answers.analytics_instrumentation — or "TBD" if skipped}

RISKS:
{rounds.4.answers.risks}

TIMELINE & MILESTONES:
{rounds.4.answers.timeline}

RELEASE STRATEGY:
{rounds.4.answers.release_strategy}

OPEN QUESTIONS:
{rounds.4.answers.open_questions}

{If any rounds.4.answers entries have "source": "domain":}
DOMAIN-SPECIFIC RISKS ({detected_domain}):
{Each domain-annotated Round 4 answer, formatted as a bullet list}

AUTHOR:
{rounds.5.answers.author}

APPROVERS:
{rounds.5.answers.approvers}

CONFIDENTIALITY:
{rounds.5.answers.confidentiality}

GAP ROUND ANSWERS:
{If gap_answers is non-empty, list each entry as:
 • {gap_id} ({section label}): {answer or "{TBD}"}
 If gap_answers is empty or gap phase was skipped: omit this block entirely.}

DOMAIN: {detected_domain | "none"}
DOMAIN BRIEF: {domain_brief_path | "none"}
REFERENCE FILE: {reference_file}
OUTPUT PATH: docs/prd/{slug}.md
=== END CONTEXT ===
```
