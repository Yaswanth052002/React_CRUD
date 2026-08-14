# Round 3 — Requirements & Flows

> Skip this entire round silently if `rounds.3.completed == true`. Output: `(Round 3 skipped — already complete)` and continue to Round 4.

Output: `**Round 3 of {total_rounds} — Requirements & Flows**`

**Before asking:** Check `rounds.3.answers`. Remove any already-answered questions from the queue.

**Base questions — ask Q1–Q4 in one `AskUserQuestion` call (omit answered ones):**

| Header | Question |
|--------|----------|
| **Core Features** | List the core features/capabilities this product must have. Roughly priority-ordered — most critical first. |
| **Primary Journey** | Walk through the primary user journey step by step: from the moment the user arrives to the moment they've achieved their goal. |
| **NFRs** | What are the key non-functional requirements? (Performance targets, platform/device support, accessibility standards, expected scale or load.) |
| **Technical Constraints** | What technical constraints or integration dependencies exist? List any required APIs, systems to connect to, or platform/framework restrictions. |

**Q5 — Compliance (conditional):** Ask this in a separate `AskUserQuestion` call unless the skip rule applies:
- **Skip rule:** If `detected_domain` is not null, skip Q5 and output: *"Your domain brief will cover compliance requirements for **{domain}** in detail — skipping the general compliance question."*
- **Otherwise:** Ask:

| Header | Question |
|--------|----------|
| **Compliance & Regulatory** | Are there any compliance or regulatory requirements? (e.g., HIPAA, GDPR, PCI-DSS, SOC2, FDA, accessibility laws.) Type "none" if not applicable. |

**Q6–Q7 — Security & Privacy:** Ask in a single `AskUserQuestion` call:

| Header | Question |
|--------|----------|
| **Security & Auth** | How will users authenticate? Is there a role-based access model? (e.g., SSO, OAuth, MFA, admin vs read-only roles — type "TBD" if not yet decided.) |
| **Data & Privacy** | What sensitive or personal data does this product handle? How will it be stored and transmitted? (e.g., PII, encryption requirements, data retention policy — type "none" if no sensitive data.) |

**Domain injection (if `detected_domain` is not null):**

Before injecting domain-specific questions, check whether the domain's `key_concerns` list is non-empty.

- **If `key_concerns` is non-empty:** Generate 1–2 targeted questions based on those concerns. These questions should probe for specific compliance design decisions. Announce: *"A few {domain}-specific questions for Round 3:"* Ask in a final `AskUserQuestion` call. Record each answer with `"source": "domain"` in the draft. After receiving answers, briefly acknowledge the most important constraint.

- **If `key_concerns` is empty:** Skip domain question injection for this round. Set `"domain_questions_deferred": true` in the draft. Do not announce anything about domain questions. *(Domain research will discover concerns when domain-research-agent runs.)*

## Write Round 3 to Draft

Update `docs/prd/.wip/{slug}.json`:
- `rounds.3.completed = true`
- `rounds.3.answers` = all collected answers including `security_auth` and `data_classification`; domain-specific answers include `"source": "domain"`
- `last_completed_round = 3`
- `updated_at` = current ISO8601 timestamp
