# ADR-0001: Tech stack

- Status: Accepted
- Date: 2026-08-14
- Deciders: project lead

## Context

This project is an existing (brownfield) full-stack CRUD admin dashboard for managing user
accounts, imported into the harness with no prior VCS history. The stack was already built out
before harness bootstrap: a React (Vite) frontend and a layered Python/FastAPI backend
persisting to SQLite. ADR-0001 records the stack as found so downstream harness phases
(commands, architecture ADRs, patterns skills) key off a stable stack identifier.

## Decision

The harness records the following stack:

- Stacks:
  - `react` — react v18 (Vite bundler)
  - `fastapi` — fastapi v0.115
- Package manager / Build / Test / Lint / Format:
  - react: npm · vite build · vitest · (no lint configured) · (no formatter configured)
  - fastapi: pip · — · pytest · (no lint configured) · (no formatter configured)
- Integrations: issue_tracker=none, doc_tracker=local, design=none, vcs=github, ci=github-actions

## Alternatives considered

- N/A — stack was already implemented prior to harness bootstrap; this ADR documents the
  existing decision rather than choosing between alternatives.

## Consequences

- Positive: clean layered separation (api → service → repository → models) on the backend and
  a single Axios call-site (`userApi.js`) on the frontend make requirement-tracing and testing
  straightforward.
- Negative: no CI pipeline and no lint/format tooling configured yet for either stack.
- Reversible? Swapping SQLite for another datastore only requires changing `DATABASE_URL`
  (per README); swapping frontend/backend frameworks would require a full rewrite — low
  reversibility.
