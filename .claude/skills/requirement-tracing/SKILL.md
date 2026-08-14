---
name: requirement-tracing
description: RTM numbering, hierarchy-to-issue-type mapping, RTM table format, and traceability backlinks. Source-of-truth for requirement IDs.
when_to_use: Decomposing PRD/SRD or maintaining docs/requirements/RTM.md.
user-invocable: false
allowed-tools: Read Write Edit Grep
---
# Requirement Tracing

## Numbering

- Epics: `<EPIC>` (3-letter uppercase, e.g. `CHK` for Checkout).
- Stories: `<EPIC>-<NN>` (zero-padded, sequential).
- Tasks: `<EPIC>-<NN>.<MM>`.
- Test cases: `<EPIC>-<NN>-TC-<MM>`.

## RTM table format

| ID | Title | Source | Type | Parent | Status | Test |
|---|---|---|---|---|---|---|
| CHK-014 | Apply promo code | jira:ACME-123 | Story | CHK | Validated | docs/test-cases/CHK-014.json |

## Backlinks

Every story file headers include `**Source**:` link. The RTM file is the authoritative
mapping; agents update it on `/arh-intake`, `/arh-plan-requirements`, `/arh-implement`.
