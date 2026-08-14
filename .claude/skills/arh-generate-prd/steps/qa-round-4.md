# Round 4 — Metrics, Risks & Timeline

> Skip this entire round silently if `rounds.4.completed == true`. Output: `(Round 4 skipped — already complete)` and continue to Round 5.

Output: `**Round 4 of {total_rounds} — Metrics, Risks & Timeline**`

**Before asking:** Check `rounds.4.answers`. Remove any already-answered questions.

**Ask Q1–Q4 in one `AskUserQuestion` call (omit answered ones):**

| Header | Question | Skip Rule |
|--------|----------|-----------|
| **KPIs** | What are the top 2–3 KPIs you'll track? Include numeric targets where known. | — |
| **Risks** | What are the 3 biggest risks to this product succeeding? For each, describe what could go wrong. | — |
| **Timeline** | What is the target timeline? List phases or milestones with approximate dates. | — |
| **Open Questions** | What decisions or questions are still unresolved? Note who owns each one. | — |

**Q5–Q6 — Analytics & Release:** Ask in a separate `AskUserQuestion` call unless the skip rule applies:
- **Skip rule for Q5:** If all KPI answers in Q1 were "TBD", skip Q5 and output: *"You marked all KPIs as TBD — analytics instrumentation will also be TBD. You can fill this in once KPIs are defined."* Ask only Q6.
- **Otherwise:** Ask both Q5 and Q6 together:

| Header | Question |
|--------|----------|
| **Analytics & Instrumentation** | How will KPIs be measured? What analytics platform will you use, and what are the 2–3 most important user events to track? (e.g., "Mixpanel — track signup_completed, feature_activated, session_started" — type "TBD" if not yet decided.) |
| **Release Strategy** | How do you plan to release? (e.g., full launch, phased rollout, feature-flagged, beta program.) What's the rollback plan if something goes wrong post-launch? (Type "TBD" if not yet decided.) |

**Domain injection (if `detected_domain` is not null):**

Before injecting domain-specific questions, check whether the domain's `key_concerns` list is non-empty.

- **If `key_concerns` is non-empty:** Generate 1–2 targeted questions about domain-specific risks or regulatory timeline milestones. Announce: *"A few {domain}-specific questions for Round 4:"* Ask in a final `AskUserQuestion` call. Record with `"source": "domain"`.

- **If `key_concerns` is empty:** Skip domain question injection for this round. Do not announce anything about domain questions. *(Domain research will surface risks when domain-research-agent runs.)*

## Write Round 4 to Draft

Update `docs/prd/.wip/{slug}.json`:
- `rounds.4.completed = true`
- `rounds.4.answers` = all collected answers including `analytics_instrumentation` and `release_strategy`; domain-specific answers include `"source": "domain"`
- `last_completed_round = 4`
- `updated_at` = current ISO8601 timestamp
