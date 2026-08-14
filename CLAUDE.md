# react-python-crud

react-python-crud harnessFull-stack CRUD application using React frontend, Python FastAPI backend, and AgentRise Harness

@README.md
@docs/config/project-commands.yaml

## Tech stack

- **react** v18 · npm · jest
- **fastapi** v0.115 · pip · pytest


## Integrations

- Document tracker: `local`
- Issue tracker: `none`
- VCS: `github`
- CI: `github-actions`

## SDLC

State machine: `docs/state/features.json` (index, pre-plan) + `docs/features/<id>/state.json` (per-feature, post-plan). See `docs/state/SCHEMA.md` for the two-tier shape. Gated by `phase-preconditions` skill.

Greenfield: `/arh-init` → `/arh-scaffold` → `/arh-intake` → `/arh-validate-story` → `/arh-research` → `/arh-plan-requirements` → `/arh-plan-implementation` → `/arh-implement` → `/arh-validate-feature` → `/arh-review` → `/arh-security-review`.

Brownfield: `/arh-init` → `/arh-import --jira-jql "..."` → continue per feature.

Helpers: `/arh-trace`, `/arh-explain <id>`, `/arh-sync`, `harness carry-forward {list|resolve|defer}`.

## Where to look

| What | Where |
|---|---|
| Build / test / dev commands | `docs/config/project-commands.yaml` (auto-imported above) |
| Stack idioms + anti-patterns + design tokens | `.claude/skills/<framework>-patterns/SKILL.md` (one per declared stack) |
| Cross-cutting rules (security, a11y, perf, reusability) | `.claude/rules/*-baseline.md` (auto-loaded, path-scoped) |
| Architectural decisions | `docs/adr/<NNNN>-<slug>.md` |
| Per-feature artefacts (story → research → PRD → PLAN → review) | `docs/features/<id>/` |
| Tracker config | `docs/config/{issue-tracking,doc-tracker}.yaml` |

<!-- Harness scaffold — sections below filled by /arh-init Phase 4 (bootstrap-agent) -->

## Conventions

- Components never call Axios directly — every HTTP call goes through `frontend/src/services/userApi.js`.
- Backend layering must not be bypassed: `api → service → repository → models`.
- Email uniqueness is enforced server-side (`409 Conflict` on duplicate).
- Never surface raw stack traces to users — always return readable error messages.
- Every mutation shows a loading state, a success toast, and a readable error on failure (frontend UX convention).

## Personas

- **Admin** — manages all user accounts (create, update, delete, view any record).
- **Regular User** — the managed record/role (`role: User` in the data model); not an active operator of the dashboard itself.

## Domain glossary

- **User record** — a row in the `users` table (name, email, phone, role, status) managed via the CRUD dashboard.
- **Role** — enum on a user record: `Admin` or `User`, distinct from the Admin/Regular-User personas above but aligned with them.
- **Status** — enum on a user record: `Active` or `Inactive`, controlling whether the account is considered active.

## Target platforms

- Desktop web browsers only (no mobile-specific support).
- Generic internal admin tool — no regulated domain (no HIPAA/PCI/SOC2); standard PII hygiene only for name/email/phone.

## Branch conventions

- `feature/<id>`, `bugfix/<id>`, `hotfix/<id>`, `chore/<id>`.

## Commit format

- Conventional Commits (`type(scope): summary`).

## PR conventions

- Title: Conventional-Commit-style summary. Body sections: Summary, Test plan, Migration (when applicable), Carry-forward (unrelated issues noticed but not fixed inline).
