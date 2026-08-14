---
name: clarification-marker
description: Discipline for [NEEDS CLARIFICATION] markers in stories and PRDs. Forces agents to surface unresolved assumptions instead of guessing.
when_to_use: When drafting a story, PRD, or research doc and an unresolved question would otherwise be silently assumed.
user-invocable: false
allowed-tools: Read Write Edit
---
# Clarification Marker Discipline

Every requirement-phase agent (requirement-planner, product-spec, story-validation) MUST surface unresolved assumptions as explicit markers in the body of artefacts they produce — never silently guess.

## Marker format

Inline:

```
[NEEDS CLARIFICATION: <one-line question>]
```

Examples:

```
- The list pagination uses [NEEDS CLARIFICATION: page size 20 or 50?] items per page.
- Throttle requests at [NEEDS CLARIFICATION: per-user or per-tenant?] level.
- On error, surface a [NEEDS CLARIFICATION: toast or inline banner?] to the user.
```

## Common cases that MUST be marked, not assumed

| Case | Bad (silent assumption) | Good (marker) |
|---|---|---|
| NFR budget unknown | "p95 < 250ms" pulled from thin air | `[NEEDS CLARIFICATION: target p95 latency?]` |
| Persona ambiguous | Pick one of "user" / "admin" arbitrarily | `[NEEDS CLARIFICATION: applies to all roles or admin only?]` |
| Integration point unclear | Assume REST endpoint exists | `[NEEDS CLARIFICATION: does upstream service expose this endpoint?]` |
| Edge case unspecified | Default to "show empty state" | `[NEEDS CLARIFICATION: empty result behaviour — empty state, redirect, or error?]` |
| Auth scope guessed | Assume same as parent feature | `[NEEDS CLARIFICATION: requires auth? same scope as <related>?]` |
| Data retention | Default to "forever" | `[NEEDS CLARIFICATION: retention period for these records?]` |

## Story-template integration

Every story file ends with a "Clarifications" section listing every unresolved marker still in the body:

```markdown
## Clarifications

- [NEEDS CLARIFICATION: page size 20 or 50?]
- [NEEDS CLARIFICATION: applies to all roles or admin only?]
```

Empty section is allowed (and required when zero unresolved markers exist).

## Validation rubric integration

The Clarity-Unresolved sub-dimension of `requirement-validation` (5% weight) fails when:

- The Clarifications section contains one or more `[NEEDS CLARIFICATION: ...]` lines, OR
- The story body contains a marker NOT mirrored in the Clarifications section (consistency rule).

A story with unresolved markers cannot pass validation; it bounces back to the requirement-planner-agent for self-correction (max 3 rounds).

## Resolving a marker

When the user (or the agent through follow-up questions) supplies an answer:

1. Replace the inline marker with the resolved value.
2. Remove the corresponding line from the Clarifications section.
3. Append to the story's "Decision log" (or PRD "Resolved questions" section):
   ```
   - <YYYY-MM-DD> Page size: 20 (per PO ${person})
   - <YYYY-MM-DD> Scope: admin only (per PRD §2)
   ```

## Hard cap

**Max 3 unresolved markers per artefact** (story, PRD, research doc). Cap forces prioritization: more than 3 ambiguities = story scope is too broad or agent is dumping hard problems on the user. Agent MUST pick the 3 highest-impact questions and either:

- **Resolve the rest inline** with documented best-judgment (record in `## Decision log` with reasoning), OR
- **Escalate** with: `Too many unresolved questions (<N>). Re-scope the story or split into smaller stories.`

Priority order when picking the 3:

1. **Scope ambiguities** (in/out of MVP, persona coverage, phased rollout) — affect what gets built
2. **Security / compliance** ambiguities (auth scope, retention, PII handling) — affect what's safe to ship
3. **Integration boundaries** (API contracts, MCP servers, upstream services) — affect what's possible
4. **UX / behavioural details** (toast vs banner, debounce ms, exact copy) — affect UX but easily revised post-ship

Drop category 4 markers first (resolve inline with best judgment + Decision log entry); promote categories 1-3.

## Anti-patterns

- **Silent guess** — agent picks a value, no marker. Validation rubric will not catch this; only review will. Prefer marker over guess.
- **Vague marker** — `[NEEDS CLARIFICATION: think about this]`. Marker MUST be a specific question with a small set of plausible answers when possible.
- **Marker without question** — `[NEEDS CLARIFICATION]` (no body). Always carry the actual question.
- **Resolving in the wrong place** — editing the inline value but leaving the marker in the Clarifications section, or vice-versa. Both must update together.
- **Bulk-clear before resolution** — agents that delete the Clarifications section to "pass" validation. F-050 lint catches the inconsistency.
- **Marker spam** — emitting 10+ markers in one artefact. Cap is 3 (see "Hard cap" above). Spam = story too broad or agent skipping real decisions.

## Why this skill exists

Without explicit markers:
- LLMs invent plausible-sounding values that look like spec but are unverified guesses.
- Downstream agents (research, plan-implementation) treat invented values as decisions and build on top.
- Bugs surface only at /arh-validate-feature against real users, by which point the cost is high.

With explicit markers:
- Every assumption is flagged at requirement time, when the cost to fix is hours not weeks.
- The Clarifications section is the human's punch list of decisions to make.
- Validation rubric enforces that no story enters /arh-research with unresolved questions.
