# Extraction Format

The reference reader agent writes its output to `docs/prd/.wip/{slug}-extraction.json`.

This is the contract between the reference reader agent and the gap analysis agent.

## Schema

```json
{
  "slug": "{slug}",
  "extracted_at": "{ISO8601}",
  "source_files": [
    {
      "file": "{filename}",
      "category_id": "{category id from manifest}",
      "status": "extracted | unreadable | skipped",
      "error": "{error message if unreadable, else null}",
      "char_count": 0
    }
  ],
  "content": {
    "product_identity": {
      "name": "{product name or null}",
      "one_liner": "{one sentence description or null}",
      "version_or_release": "{version info or null}"
    },
    "problem_statement": {
      "current_situation": "{text or null}",
      "root_cause": "{text or null}",
      "business_impact": "{text or null}",
      "evidence": "{text or null}"
    },
    "goals": {
      "business_goals": ["{goal text}"],
      "product_goals": ["{goal text}"],
      "non_goals": ["{exclusion text}"],
      "assumptions": ["{assumption text}"]
    },
    "stakeholders": {
      "stakeholder_map": ["{role and concern text}"],
      "primary_persona": "{text or null}",
      "secondary_users": ["{text}"],
      "anti_personas": ["{text}"]
    },
    "solution": {
      "summary": "{text or null}",
      "capabilities": ["{capability text}"],
      "alternatives_considered": ["{text}"]
    },
    "user_journeys": {
      "primary_journey": "{text or null}",
      "secondary_journeys": ["{text}"],
      "edge_cases": ["{text}"]
    },
    "functional_requirements": {
      "must_have": ["{requirement text}"],
      "should_have": ["{requirement text}"],
      "could_have": ["{requirement text}"],
      "wont_have": ["{requirement text}"]
    },
    "non_functional_requirements": [
      { "category": "{category}", "requirement": "{text}", "target": "{target or null}" }
    ],
    "technical": {
      "platform_constraints": ["{text}"],
      "integrations": ["{system and type text}"],
      "third_party_services": ["{text}"],
      "data_model_concepts": ["{entity text}"],
      "compliance_regulations": ["{regulation and obligation text}"]
    },
    "security_privacy": {
      "auth_model": "{text or null}",
      "data_classification": ["{text}"],
      "privacy_controls": ["{text}"]
    },
    "metrics": {
      "north_star": "{text or null}",
      "kpis": ["{kpi text}"],
      "measurement_approach": "{text or null}"
    },
    "risks": [
      { "description": "{text}", "category": "{text}", "mitigation": "{text or null}" }
    ],
    "release": {
      "launch_approach": "{text or null}",
      "timeline_milestones": ["{text}"],
      "target_ship_date": "{text or null}"
    },
    "open_questions": ["{question text}"],
    "glossary_terms": [
      { "term": "{term}", "definition": "{definition}" }
    ],
    "competitive_landscape": ["{competitor and approach text}"]
  }
}
```

## Extraction rules

- Extract verbatim phrases where possible — do not paraphrase unless the source is excessively verbose
- If a field appears in multiple source files, concatenate with a `---` separator and note the source filename in brackets: `[filename]`
- If a field cannot be found in any source file, set it to `null` (scalar) or `[]` (array)
- Do not invent or infer content — only extract what is explicitly stated in the source documents
- Char count is the raw extracted character count before any summarization
