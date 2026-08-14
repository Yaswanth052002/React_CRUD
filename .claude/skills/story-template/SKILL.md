---
name: story-template
description: Canonical user story format with Given/When/Then ACs, NFRs, traceability headers, dependencies, and test mapping. Used by requirement-planner-agent.
when_to_use: Drafting or reviewing a user story.
user-invocable: false
allowed-tools: Read Write Edit
---
# Story Template

```
# Story: <ID> — <one-line title>

**Epic**: <EPIC-ID>
**Status**: Draft | In Review | Validated | ESCALATED
**Priority**: P1 | P2 | P3
**Independent test**: true | false
**Owner**: <name>
**Updated**: <YYYY-MM-DD>

## User story

As a <persona>, I want <capability> so that <outcome>.

## Acceptance criteria

1. Given <state>, when <action>, then <observable result>.
2. Given <state>, when <action>, then <observable result>.

## Non-functional requirements

- Performance: <budget>
- Security: <constraint>
- Accessibility: <wcag-level>
- Observability: <metric|log|trace>

## Dependencies

- Upstream: <STORY-ID, decision, external service>
- Downstream: <stories blocked by this>

## Test mapping

- E2E: <flow file or NA>
- Unit: <module under test>
- Manual: <only when tooling cannot cover>

## Clarifications

<!-- Mirror every [NEEDS CLARIFICATION: ...] marker still present in the body above.
     Empty list when zero unresolved markers remain.
     See skill `clarification-marker` for marker discipline. -->

## Decision log

<!-- Append one line per resolved clarification:
     - <YYYY-MM-DD> <topic>: <resolved value> (per <source>)
-->
```

## Field rules

- IDs follow `<EPIC>-<SEQ>` (e.g. `CHK-014`).
- ACs are observable. "Code looks clean" is not an AC.
- NFRs are concrete. "Fast" is not an NFR; "p95 < 250ms under 100 RPS" is.

## Priority + independent test

- **Priority** is one of `P1 | P2 | P3`. Required.
  - `P1` — ship-blocker; story belongs in the MVP cut.
  - `P2` — important, slated for the same release once P1 stories are in.
  - `P3` — nice-to-have, candidate for deferral.
- **Independent test** is `true` when this story can be validated end-to-end in isolation, without depending on a sibling P1 story. `P1` stories MUST be `independent_test: true`. The validation rubric Testability dimension fails when this rule breaks (lint F-047 also flags it).

## Clarifications

Whenever an agent drafting this story would otherwise silently guess a value (NFR budget, persona scope, integration point, edge-case behaviour), it MUST insert an inline marker `[NEEDS CLARIFICATION: <question>]` and mirror the question in the Clarifications section. See skill `clarification-marker` for the full discipline. Validation rubric Clarity-Unresolved sub-dimension fails when the section is non-empty.
