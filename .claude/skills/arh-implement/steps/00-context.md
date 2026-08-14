# Step 0 — Context load

Goal: load every input the implementation depends on so the agent does not invent conventions.

## Files to read (in order)

1. `CLAUDE.md` — project memory: branch naming, commit format, PR conventions, target platforms.
2. `docs/features/$ARGUMENTS/PLAN.md` — the source of truth for tasks and file plan.
3. `docs/features/$ARGUMENTS/REQUIREMENTS.md` — the PRD; resolve ambiguity by re-reading this, not by guessing.
4. `docs/features/$ARGUMENTS/DESIGN.md` — **load when present** (per `design == "complete"` in `docs/features/$ARGUMENTS/state.json`). Authoritative for UI work: component vocabulary per screen, token names to bind, form-factor breakpoints, implementation notes. DESIGN.md lists component *names* only — the per-element detail lives in the source design artifact its `## Screens × form factors` table links to. When a task touches a UI file (per PLAN.md file plan), re-read the relevant DESIGN.md section; the implementation-agent's screen-fidelity diff opens the artifact via the wired `design-binding` skill (provider-specific). Absent → UI work proceeds from `<framework>-patterns` conventions alone.
5. `docs/stories/$ARGUMENTS.md` — the story; ACs are checked during validation.
6. `docs/test-cases/$ARGUMENTS.json` — must exist before Step 2.
7. `docs/config/project-commands.yaml` — typecheck / test / lint / format commands per stack.

## Skills to load

- All `.claude/rules/*.md` matching the file globs that will be edited (Claude auto-loads these on first matching read; warm them by reading PLAN.md's file list).
- `codebase-exploration` — for any sub-task that requires unfamiliar-code orientation.

## Hard preconditions

If any of the following is missing, **stop** and surface the gap:

- `docs/features/$ARGUMENTS/PLAN.md` does not exist → `Run /arh-plan-implementation $ARGUMENTS first.`
- `docs/test-cases/$ARGUMENTS.json` does not exist → `Run /arh-plan-requirements $ARGUMENTS first.`
- The current branch is `main` or `master` → create a `feature/$ARGUMENTS` branch first.
- The working tree has uncommitted unrelated changes → ask the user to commit or stash.

## ADR load (G14)

Load every Architecture Decision the implementation must honor:

1. Read PLAN.md `## Architecture Decisions` section. Extract every `### ADR-<N>: <title>` block. Record the ADR id and the decision body.
2. For each mini-ADR that cites a full ADR file (`See: docs/adr/<NNNN>-<slug>.md`), read that file too.
3. Print the loaded ADR list in the context summary so the user sees what the implementation is bound to.

The implementation-agent MUST honor every loaded ADR. Code that contradicts a cited ADR is **escalation**, not silent implementation. See `03-fix-loop.md` for the escalation path when validation forces a contradiction.

## Patterns-skill freshness check (G15)

Run the patterns-freshness check per skill `phase-preconditions` § G15 — warn per unfilled skill (do NOT abort), consequence: "implement output will be generic".

## Resume / restart check (G2)

If `docs/features/$ARGUMENTS/state.json` has `.impl_tasks` containing at least one row with `status != "done"`:

1. Surface the existing task list to the user:
   ```
   Existing implementation state found:
     ✓ T-01  done (2026-05-11T10:32Z)
     ✓ T-02  done (2026-05-11T10:48Z)
     ⨯ T-03  blocked: missing fixture
     ◻ T-04  pending
     ◻ T-05  pending
   ```
2. Ask user: `Resume from T-03? [resume / restart / cancel]`.
3. On `resume`: skip done rows, retry blocked/pending rows starting from the first non-done row.
4. On `restart`: clear `impl_tasks` from state, re-run from T-01.
5. On `cancel`: abort the run; state untouched.

If `impl_tasks` is empty or absent: initialise it from PLAN.md `## Task Breakdown` with every row set to `status: "pending"`, then proceed.

## Output

Print a one-line confirmation: `Context loaded: <N> files, <M> rules, <K> ADRs active, design=<complete|pending|n/a>. <W> unfilled patterns warnings. Resume: <yes/no>.`
