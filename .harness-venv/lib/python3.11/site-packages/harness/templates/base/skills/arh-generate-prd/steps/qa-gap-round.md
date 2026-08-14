# Gap Coverage Phase (Post-Round-5)

After all 5 rounds complete, check whether any required PRD sections are still missing or empty. Ask targeted questions for only the gaps. Loop until coverage is met, the user says done, or 3 gap rounds are exhausted.

---

## Required sections checklist

These are the fields that must be non-empty and non-generic for a complete PRD. Map each to the draft answer field that fills it:

| Section | Draft field | Empty / generic if... |
|---------|-------------|----------------------|
| Executive Summary | rounds.1: problem + business_goal + success_vision | Any of these three are blank or "TBD" |
| Primary Persona | rounds.2.answers.primary_persona | Blank, "TBD", or fewer than 10 words |
| In Scope | rounds.2.answers.in_scope | Blank or "TBD" |
| Out of Scope | rounds.2.answers.out_of_scope | Blank or "TBD" |
| Success Metrics | rounds.4.answers.kpis | Blank, "TBD", or no numeric target present |
| Technical Constraints | rounds.3.answers.technical_constraints | Blank or "TBD" |
| Integration Dependencies | rounds.3.answers.technical_constraints | Same field — flag separately if no integrations mentioned |
| Security & Auth Model | rounds.3.answers.security_auth | Blank or "TBD" |
| Data Classification | rounds.3.answers.data_classification | Blank or "TBD" |
| Analytics & Instrumentation | rounds.4.answers.analytics_instrumentation | Blank, "TBD", or "skipped" |
| Release Strategy | rounds.4.answers.release_strategy | Blank or "TBD" |
| Open Questions | rounds.4.answers.open_questions | Blank or "none" (absence is acceptable only if all other sections are complete) |

---

## Pre-gap setup

Read the current draft from `docs/prd/.wip/{slug}.json`.

Evaluate each row in the checklist above against the draft answers collected in rounds 1–5.

Build a `gap_list`: an ordered list of sections that are empty, "TBD", or generic. Assign a short `gap_id` to each (e.g., `gap-persona`, `gap-kpis`, `gap-security`).

If `gap_list` is empty: skip the gap round loop entirely and proceed directly to **After gap loop**.

---

## Gap round loop

```
gap_rounds_completed = 0
MAX_GAP_ROUNDS = 3
user_said_done = false

WHILE gap_list is non-empty AND gap_rounds_completed < MAX_GAP_ROUNDS AND NOT user_said_done:

  Show progress header:
  "**Gap Round {gap_rounds_completed + 1} of {MAX_GAP_ROUNDS} — {len(gap_list)} section(s) still need input**
  These questions cover fields that weren't fully answered in rounds 1–5.
  Type "done" at any point to skip remaining gaps and generate the PRD."

  Take the next batch of up to 4 gaps from gap_list (in checklist order).

  For each gap in the batch, build an AskUserQuestion entry:
    - header: the section label (e.g. "Security & Auth Model")
    - question: a targeted question for that specific gap (see question templates below)

  Use a single AskUserQuestion call per batch of ≤4 gaps.

  After user answers:
    - If ANY answer is exactly "done" (case-insensitive): set user_said_done = true.
      Mark ALL remaining gaps in gap_list (including this batch's unanswered ones) as {TBD}.
      Write all to gap_answers. Break immediately.
    - Otherwise for each answer:
        - Write the answer to gap_answers[gap_id] in the draft
        - Remove resolved gaps from gap_list (resolved = non-empty and not "TBD" or "skip")
        - If answer is "skip", "I don't know", or "TBD" — mark that gap as {TBD}, remove from gap_list
    - Update updated_at in draft

  gap_rounds_completed += 1
  Write draft state.

  IF gap_list is empty: break
```

---

## Question templates

Use these as the question text for each gap. Adapt lightly based on product context already collected.

| gap_id | Question |
|--------|----------|
| gap-persona | Who is the primary user of {product_name}? Describe their role, what they're trying to accomplish, and what frustrates them today. |
| gap-in-scope | What specific capabilities are in scope for the first release? List the top 3–5 features or user actions this version must support. |
| gap-out-of-scope | What is explicitly out of scope for this version? What requests will you defer, and why? |
| gap-kpis | What does success look like numerically? Give 2–3 KPIs with a target value — e.g., "reduce checkout time by 30%", "achieve 80% DAU retention at 30 days". |
| gap-constraints | What are the key technical constraints? (e.g., must run on existing infrastructure, specific language/framework, third-party API limits.) |
| gap-integrations | What external systems or APIs does this product need to integrate with? List each with its purpose. |
| gap-security | How will users authenticate? Are there role-based access differences? Is any sensitive data involved? |
| gap-data | What types of data does this product collect, store, or process? Any PII, health data, or regulated data? |
| gap-analytics | What user events or actions need to be tracked for product analytics? What platform will you use (e.g., Mixpanel, Amplitude, custom)? |
| gap-release | How do you plan to roll out this product? (e.g., full launch, phased rollout, beta first, feature flag.) |
| gap-open-questions | What are the biggest open questions or unresolved decisions that need to be answered before development begins? |

---

## After MAX_GAP_ROUNDS reached with remaining gaps

If `gap_list` is still non-empty after 3 gap rounds, output:

```
**Gap phase complete (3 rounds reached)**

The following sections could not be resolved from your answers.
They will appear as `{TBD}` in the PRD — fill them in before seeking stakeholder approval:

{list each remaining gap_id with its section label}
```

Write all unresolved gap IDs with value `"{TBD}"` into `gap_answers` in the draft.

---

## After gap loop

Output a summary of what was collected:

```
{If gap loop was skipped (no gaps):}
**All required sections are covered from your answers.**

{If gap loop ran:}
**Gap phase complete — {N} additional sections filled, {M} marked {TBD}**

Here's what I have so far:
• {N} of 12 required sections covered
• {M} sections will appear as {TBD} in the PRD

{If M > 0: list each TBD section label on its own bullet line}
```

Then ask the ready-to-generate confirmation:

Use `AskUserQuestion`:
| Header | Question |
|--------|----------|
| **Ready to Generate** | Ready to generate the PRD? |

Options:
- `"Yes — generate the PRD"` → proceed to compile context
- `"No — I want to add more detail"` → ask a follow-up open text question:

  Use `AskUserQuestion`:
  | Header | Question |
  |--------|----------|
  | **Additional Details** | Go ahead — what would you like to add or change? (Describe the section and the new information.) |

  After receiving the answer, identify which gap_id(s) it addresses, update `gap_answers` in the draft, then re-ask the ready-to-generate confirmation. Repeat until the user selects "Yes".

Update draft:
- `gap_rounds_completed` = rounds run
- `gap_answers` = all collected gap answers
- `updated_at` = current ISO8601 timestamp
