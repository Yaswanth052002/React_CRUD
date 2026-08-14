# Round 1 — Product Identity

Output: `**Round 1 of 5 — Product Identity**`

Use the `AskUserQuestion` tool to ask the first 4 questions in a single call:

| Header | Question |
|--------|----------|
| **Product Name** | What is the product or feature name? Give it a one-sentence description — what it does and for whom. |
| **Problem** | What problem does this solve? Who is experiencing it, and what does the current experience look like today? |
| **Business Goal** | What is the primary business goal this addresses? (e.g., increase revenue, reduce churn, expand market, cut operational cost) |
| **Success Vision** | What does success look like in 6–12 months? What will be measurably different? |

After receiving those answers, evaluate the skip rule for Q5:
- **Skip rule:** If the problem statement explicitly states this is a greenfield effort with no prior research, skip Q5. Output: *"Skipping the evidence question — you've noted this is a greenfield product with no prior research."*
- **Otherwise:** Ask Q5 in a second `AskUserQuestion` call:

| Header | Question |
|--------|----------|
| **Evidence** | Is there any existing data, research, or user feedback that supports this problem? (e.g., support tickets, survey results, usage metrics — type "none" if greenfield.) |

## Derive Slug

After receiving all Round 1 answers, derive the slug: lowercase the product name, replace spaces and special characters with hyphens, strip leading/trailing hyphens.
Examples: "PlutoTV Ad Monitor" → `pluto-tv-ad-monitor`, "Patient Health Portal" → `patient-health-portal`.

## Initialize Draft

Get contributor and timestamp:
```bash
git config user.name 2>/dev/null || echo "unknown"
date -u +"%Y-%m-%dT%H:%M:%SZ"
```

Write `docs/prd/.wip/{slug}.json`:

```json
{
  "slug": "{slug}",
  "product_name": "{product name, name-only portion from Q1}",
  "status": "in_progress",
  "detected_domain": null,
  "domain_prompt_declined": false,
  "domain_brief_path": null,
  "last_completed_round": 1,
  "total_rounds": 5,
  "rounds": {
    "1": {
      "completed": true,
      "answers": {
        "product_name": "{full Q1 answer including one-sentence description}",
        "problem": "{Q2 answer}",
        "business_goal": "{Q3 answer}",
        "success_vision": "{Q4 answer}",
        "evidence": "{Q5 answer, or 'skipped — greenfield' if skipped}"
      }
    },
    "2": { "completed": false, "answers": {} },
    "3": { "completed": false, "answers": {} },
    "4": { "completed": false, "answers": {} },
    "5": { "completed": false, "answers": {} }
  },
  "contributors": ["{git user name}"],
  "created_at": "{ISO8601 timestamp}",
  "updated_at": "{ISO8601 timestamp}"
}
```

## Acknowledge Product Understanding

Output a 1–2 sentence acknowledgement so the user can correct any misunderstanding before proceeding.
Example: *"Got it — {Product Name} is {one-line description}, aimed at {audience}."*

## Domain Detection

After Round 1 completes, the orchestrator runs Domain Detection automatically before proceeding to Round 2.
