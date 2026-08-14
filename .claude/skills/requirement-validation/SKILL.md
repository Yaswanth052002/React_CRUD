---
name: requirement-validation
description: 6-dimension scoring rubric for user stories — completeness, testability, feasibility, clarity, traceability, NFR coverage. Pass ≥80/100 with no dim under 60.
when_to_use: Scoring or self-correcting a story during /arh-validate-story.
user-invocable: false
allowed-tools: Read Write Edit
---
# Requirement Validation

## Rubric

| Dimension | Weight | Pass | Fail |
|---|---|---|---|
| Completeness | 20 | All required fields present and non-empty (incl. `priority`, `independent_test`) | Required field missing |
| Testability | 25 | Every AC observable and externally verifiable; `P1` stories have `independent_test: true` | "Code is clean" / no observable test / P1 not independently testable |
| Feasibility | 15 | No blocking unknowns; primitives exist | Depends on undelivered system |
| Clarity | 10 | Single interpretation; no ambiguous pronouns | Two readers infer different behaviour |
| Clarity-Unresolved | 5 | "Clarifications" and "Open questions" sections empty AND no `[NEEDS CLARIFICATION: ...]` markers in body | Any unresolved marker, OR a non-empty Clarifications/Open-questions section (body↔Clarifications mismatch also fails) |
| Traceability | 10 | RTM row exists; source link valid | No RTM linkage |
| NFR Coverage | 15 | Perf/Security/A11y/Observability stated with concrete budgets | NFR fields blank or vague ("fast", "secure") |

Total: 100. Threshold below.

## Threshold

- Pass: total ≥ 80, every dimension ≥ 60.
- Fail: anything else. Self-correct (max 3 rounds), then escalate.

## Clarity-Unresolved sub-dimension

Counts unresolved open questions in the story body in ANY form — `[NEEDS CLARIFICATION: <question>]` markers, a non-empty `Clarifications` section, or a non-empty `Open questions` / `Open items` heading (prose questions that dodge the marker syntax) — and reconciles them.

Score:

- **100** — zero `[NEEDS CLARIFICATION]` markers in body AND empty `Clarifications` section AND no content under an `Open questions` / `Open items` heading. Story is fully resolved.
- **0** — any marker remains, OR the `Clarifications` section is non-empty, OR an `Open questions` / `Open items` heading carries content, OR body and section are out of sync (consistency rule).

Prose does not escape the gate: an open question written as plain text under an `Open questions` heading fails the same as a `[NEEDS CLARIFICATION]` marker.

Rationale: a story with unresolved questions cannot be a stable input to /arh-research. Forcing the agent to either ask the user for the answer or escalate prevents downstream invented values from polluting the codebase.

## Independent-test rule

`P1` stories must be testable in isolation. The Testability dimension fails when:

- `priority: P1` AND `independent_test: false`.

For `P2` / `P3`, the field is recorded but does not gate Testability.

Rationale: P1 = MVP-cut. If the MVP cannot be validated without sibling stories, the cut is not an MVP — it's a coupled batch. Force the slice to be standalone before allowing P1.

## Self-correction loop

When validation fails:

1. Hand back to `requirement-planner-agent` with the failing dimensions and one-line directives per dim.
2. Agent revises the story, addressing the directives.
3. Re-score.
4. Cap at 3 rounds. After round 3 fail, mark `Status: ESCALATED` and surface the open issues to the user.

The agent MUST NOT delete unresolved `[NEEDS CLARIFICATION: ...]` markers to "pass" the rubric — that bypasses Clarity-Unresolved without resolving the underlying ambiguity. Resolution requires either a user-supplied answer or escalation.
