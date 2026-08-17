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
| USR | User Management Page | intake:raw-input | Epic | - | Intake | - | - | - |
| USR-01 | Dedicated Users Management Page | intake:raw-input | Story | USR | Intake | - | docs/stories/USR-01.md | - |
| AUTH | User Login and Settings | intake:raw-input | Epic | - | Intake | - | - | - |
| AUTH-01 | Login screen UI and entry point | intake:raw-input | Story | AUTH | Intake | - | docs/stories/AUTH-01.md | - |
| AUTH-02 | Existing-user authentication and credential validation | intake:raw-input | Story | AUTH | Intake | - | docs/stories/AUTH-02.md | - |
| AUTH-03 | Password security and server-side hashing | intake:raw-input | Story | AUTH | Intake | - | docs/stories/AUTH-03.md | - |
| AUTH-04 | Authentication state management and persistence across page refresh | intake:raw-input | Story | AUTH | Intake | - | docs/stories/AUTH-04.md | - |
| AUTH-05 | Navigation and routing for authenticated/unauthenticated views | intake:raw-input | Story | AUTH | Intake | - | docs/stories/AUTH-05.md | - |
| AUTH-06 | Settings screen with user info and logout action | intake:raw-input | Story | AUTH | Intake | - | docs/stories/AUTH-06.md | - |
| AUTH-07 | Logout and session/token invalidation | intake:raw-input | Story | AUTH | Intake | - | docs/stories/AUTH-07.md | - |
| AUTH-08 | Docker and deployment environment configuration for authentication | intake:raw-input | Story | AUTH | Intake | - | docs/stories/AUTH-08.md | - |
