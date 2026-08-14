# Requirements Traceability Matrix

> Source of truth for requirement IDs. Updated by `/arh-intake`, `/arh-plan-requirements`, `/arh-plan-implementation`, `/arh-implement`.

## Numbering

- Epics: `<EPIC>` (3-letter uppercase code, e.g. `CHK`).
- Stories: `<EPIC>-<NN>`.
- Tasks: `<EPIC>-<NN>.<MM>`.
- Test cases: `<EPIC>-<NN>-TC-<MM>`.

## Matrix

| ID | Title | Source | Type | Parent | Status | Tracker | Story file | Tests |
|----|-------|--------|------|--------|--------|---------|------------|-------|
| SRF | Search & Filter dashboard | intake:raw-input | Epic | - | Intake | - | - | - |
| SRF-01 | Search users by name, email, or phone | intake:raw-input | Story | SRF | Intake | - | docs/stories/SRF-01.md | - |
| SRF-02 | Filter users by role | intake:raw-input | Story | SRF | Intake | - | docs/stories/SRF-02.md | - |
| SRF-03 | Filter users by status | intake:raw-input | Story | SRF | Intake | - | docs/stories/SRF-03.md | - |
| SRF-04 | Combine search with role and status filters | intake:raw-input | Story | SRF | Intake | - | docs/stories/SRF-04.md | - |
