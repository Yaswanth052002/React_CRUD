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
<!-- TODO -->

## Personas
<!-- TODO -->

## Domain glossary
<!-- TODO -->

## Target platforms
<!-- TODO: e.g. iOS 17+, Web (Chrome 120+), Linux servers -->
