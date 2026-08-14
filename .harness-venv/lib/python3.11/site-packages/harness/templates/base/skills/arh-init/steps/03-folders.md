# Phase 3 — Folders + RTM stub + ADR-0001

Goal: ensure the docs tree exists and write the two seed documents downstream commands assume.

## Folders

Create when missing:

```
docs/
├── stories/
├── research/
├── features/
├── requirements/
├── adr/
├── sessions/
├── test-cases/
└── design/
    └── schema.json     (only when role frontend or mobile and design integration enabled)
```

Do not delete existing files. Do not delete folders with content.

## RTM stub

`docs/requirements/RTM.md`:

```
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
```

## ADR-0001

ADR-0001 is **tech-stack only**. The high-level system-architecture ADRs (`0002`+) are written later by `bootstrap-agent` in Phase 4c — do not author architecture here. Ensure `docs/adr/` exists (folder list above) so that write target is ready.

Source the stack list from `harness.yaml stacks[]` (id, framework, version, package_manager, test_runner); for brownfield, reconcile against the manifests detected in Phase 0. This is a main-session step, so reading the generator config here is fine. Record every stack's `<id>` — Phase 4 (commands, architecture) reads stacks from this ADR, not from `harness.yaml`.

`docs/adr/0001-tech-stack.md`:

```
# ADR-0001: Tech stack

- Status: Accepted
- Date: <YYYY-MM-DD>
- Deciders: <project lead>

## Context

<1 paragraph: why we are starting this project / continuing this work and what constraints shape the stack>

## Decision

The harness records the following stack:

- Stacks: one line per stack — `<id> — <framework> v<version>` (the `<id>` is the canonical stack identifier downstream phases key on; record it for every stack).
- Package manager / Build / Test / Lint / Format: <from project-commands.yaml>
- Integrations: <issue_tracker, doc_tracker, design, vcs, ci>

## Alternatives considered

- <alt 1>: rejected because …
- <alt 2>: rejected because …

## Consequences

- Positive: <list>
- Negative: <list>
- Reversible? <cost to undo if a stack change becomes necessary>
```

## design/schema.json (only when applicable)

```json
{
  "designSystem": {
    "fileKey": "<figma-file-key | TODO>",
    "url": "<figma-url | TODO>",
    "pages": {
      "tokens": "",
      "atoms": "",
      "molecules": "",
      "organisms": "",
      "icons": "",
      "features": {}
    }
  },
  "tokens": {
    "color": [],
    "spacing": [],
    "typography": []
  }
}
```
