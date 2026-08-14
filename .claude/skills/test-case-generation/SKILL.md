---
name: test-case-generation
description: JSON schema and derivation rules for producing structured test cases from a story's acceptance criteria. Outputs docs/test-cases/<id>.json.
when_to_use: Generating or auditing test cases during /arh-plan-requirements.
user-invocable: false
allowed-tools: Read Write Edit
---
# Test Case Generation

## JSON schema (v2 — adds requirement_id traceability)

```json
{
  "story_id": "CHK-014",
  "test_cases": [
    {
      "id": "CHK-014-TC-01",
      "title": "Valid promo code reduces total",
      "type": "e2e",
      "automatable": true,
      "priority": "Must",
      "requirement_id": "CHK-014-FR-1",
      "given": "user has 1 item in cart and a valid promo code",
      "when": "user submits the code at checkout",
      "then": "order total is reduced by promo amount and shown in summary",
      "tags": ["happy-path"]
    }
  ],
  "coverage_audit": {
    "functional_requirements": [
      {"id": "CHK-014-FR-1", "covered_by": ["CHK-014-TC-01", "CHK-014-TC-02"]},
      {"id": "CHK-014-FR-2", "covered_by": ["CHK-014-TC-03"]}
    ],
    "non_functional_requirements": [
      {"id": "CHK-014-NFR-perf", "covered_by": ["CHK-014-TC-09"]}
    ],
    "uncovered": []
  }
}
```

## Field reference

| Field | Required | Notes |
|---|---|---|
| `id` | yes | `<STORY-ID>-TC-<NN>` zero-padded |
| `title` | yes | One-line behaviour |
| `type` | yes | `unit` \| `integration` \| `e2e` \| `performance` \| `security` \| `contract` |
| `automatable` | yes | `true` \| `false`. Manual TCs go to /arh-validate-feature manual follow-up |
| `priority` | yes | `Must` \| `Should` \| `Could` (mirrors story priority + AC criticality) |
| **`requirement_id`** | yes | **Back-reference to the FR or NFR this TC validates.** Format: `<STORY-ID>-FR-<n>` or `<STORY-ID>-NFR-<topic>`. Closes the assertion-to-test loop. |
| `given` / `when` / `then` | yes | Observable steps |
| `tags` | yes | `happy-path`, `edge-case`, `negative`, `regression-<bug-id>` |

## Scope: this manifest is BEHAVIOURAL-only by design

The test-cases JSON enumerates **end-to-end + integration + performance + security + contract** TCs. **Unit tests are NOT enumerated as TCs by design** — they cover internal contracts (helper functions, hook cycles, schema validators, normalisers) not user-visible ACs. Unit-test work appears in PLAN.md § 5. Task Breakdown as task rows of the form `T-NN  vitest <Component>.test.tsx` or `T-NN  pytest test_<module>.py unit`.

**Why this split:** AC → behavioural TC is 1:N (one AC produces several happy / boundary / negative TCs at the user-visible layer). Internal-contract tests are 1:1 with each new module and are framework-specific. Bundling them into this manifest doubles the maintenance surface for no governance benefit — the PLAN file table is the canonical inventory of new modules, and one unit-test task per new module is enforced via the `plan-validation` rubric's wiring dimension.

The test-pyramid balance is read from PLAN tasks + this manifest combined. Do NOT over-enumerate TCs to inflate counts.

## NFR-topic schema (pinned)

The `requirement_id` field uses one of these two formats:

- `<STORY-ID>-FR-<n>` where `n` is the FR number from REQUIREMENTS.md (when emitted)
- `<STORY-ID>-NFR-<topic>` where `topic` matches **exactly** one of: `performance | security | accessibility | observability`

Regex constraint: `^[A-Z]+-\d+-(FR-\d+|NFR-(performance|security|accessibility|observability))$`

NFR-topic deviations (`-NFR-authn`, `-NFR-perf`, `-NFR-a11y`) are forbidden — they break `/arh-trace` lookups and `/arh-explain` lineage tables. When a story carries sub-topics under one NFR section (e.g. NFR-security has both PII-logging and ownership-404 rules), TCs point to the parent `-NFR-security` id; the sub-topic lives in the TC `title` and `tags`.

## Derivation rules

- One test case per AC, plus negative paths and boundary cases.
- Every TC MUST have `requirement_id` pointing to an FR or NFR id from REQUIREMENTS.md. No orphan TCs.
- Tests reference real API responses where possible. No mocks at integration boundary.
- Performance test cases include the budget (e.g. p95 < 250ms at 100 RPS).
- **Do NOT enumerate unit-shaped TCs** (helper function, hook cycle, schema validator, normaliser tests). These belong in PLAN.md § 5 task table.

## Manual flag heuristics (automatable: false)

Mark `automatable: true` UNLESS the test requires human judgment that no automation can substitute. Heuristics:

| Test concern | automatable | Tooling |
|---|---|---|
| Viewport reflow at 320 px | **true** | Playwright `page.setViewportSize({width: 320, height: 568})` + element bounding box assertion |
| Touch target size ≥ 44×44 dp | **true** | Playwright + `element.boundingBox()` assertion |
| `aria-*` attribute presence | **true** | Playwright + `getAttribute()` or axe-core scan |
| `role="dialog" / "alertdialog"` | **true** | Playwright + `getAttribute()` |
| Focus ring visibility | **true** | Playwright `page.evaluate` reading `outline` style on `:focus-visible` |
| Focus trap Tab cycle | **true** | Playwright `keyboard.press("Tab")` × N + active-element assertion |
| `prefers-reduced-motion` honoured | **true** | Playwright emulate media + assert no transition |
| Color contrast ratio | **true** | axe-core inside Playwright |
| Visual regression review (subjective layout/typography quality) | **false** | Human |
| Screen-reader narration walkthrough (intelligibility) | **false** | Human + NVDA/VoiceOver |
| Manual accessibility audit (cognitive load, error recovery flow) | **false** | Human (a11y specialist) |
| "Test this with a real Jira ticket" / "manual integration with prod tracker" | **false** | Human |

When in doubt, default to `automatable: true` and write the Playwright spec. The cost of an extra automated test is one CI minute; the cost of a manual TC is a deferred carry-forward entry per validation run.

## Coverage minimum (machine-enforced before /arh-plan-requirements gate)

For `coverage_audit` to pass:

1. **Every FR in REQUIREMENTS.md → ≥1 TC** with `requirement_id` matching that FR's id.
2. **Every NFR with a numeric budget → ≥1 typed TC** matching the NFR domain:
   - Performance NFR (latency / throughput / memory) → ≥1 TC `type: performance`
   - Security NFR (authn/authz/PII) → ≥1 TC `type: security`
   - Contract NFR (API shape / breaking change policy) → ≥1 TC `type: contract`
3. `coverage_audit.uncovered` MUST be empty. Any entry → product-spec-agent self-corrects (max 1 round) by generating the missing TC, then escalates if still uncovered.

The `coverage_audit` section is generated AFTER the `test_cases` array — the agent walks REQUIREMENTS.md FR/NFR ids, queries `requirement_id` of every TC, and emits the audit summary. Phase 4 Product Gate fails if `coverage_audit.uncovered` is non-empty.

## Cross-reference with Scope "Out:"

Before adding a TC, check the FR/NFR id against REQUIREMENTS.md `## Scope` → `Out:` section. If the requirement is in Out scope, the TC MUST NOT be generated. If a TC accidentally references an Out-scope id, surface as a warning at coverage-audit time.

## Regression-tag protocol (used by /arh-implement fix-loop, G4; surfaced by /arh-validate-feature, V4)

When `/arh-implement` Step 3 fixes a validation failure, the implementation-agent MUST add or extend at least one TC that would have caught the failure:

- **New TC for a fixed bug:** assign id `<STORY>-TC-<NN>` and tag `regression-<original-TC-id>`. Example: `tags: ["regression-CHK-014-TC-03"]`.
- **Extending an existing TC:** add the new boundary to `then:` and append `regression-<original-TC-id>` to `tags`.
- The agent re-runs the `coverage_audit` step after appending. The audit MUST still report `uncovered: []`.
- A fix-pass without a regression-tagged TC is rejected by Step 3; the fix is re-run with the regression-tag requirement re-stated.

This tag pattern lets `/arh-trace` and `/arh-explain` report the bug→fix→test chain for any regression that re-surfaces. `/arh-validate-feature` Phase 5 surfaces every regression-tagged TC in a dedicated `## Regression coverage` section. **A regression-tagged TC that fails AGAIN drops the validation verdict to PARTIAL** — the bug has re-surfaced and must feed the next fix loop.

## last_run schema (written by /arh-validate-feature, V1 + V3)

After each /arh-validate-feature run, every automatable TC carries a `last_run` block:

```json
{
  "last_run": {
    "started_at":     "<iso8601>",
    "duration_ms":    1234,
    "status":         "PASS | FAIL | ERROR",
    "verdict":        "PASS | FAIL | FLAKY",
    "attempts": [
      {"n": 1, "status": "FAIL", "duration_ms": 1100, "reason": "..."},
      {"n": 2, "status": "PASS", "duration_ms": 1234, "reason": null}
    ],
    "budget": {
      "target":      "p95 < 250ms @ 100 RPS",
      "measured":    "p95 = 312ms @ 100 RPS",
      "budget_pass": false
    },
    "failure_reason": "<one line; null on PASS>",
    "artefact":       "tests/e2e/output/<TC-id>/arh-trace.zip",
    "runner":         "playwright | maestro | pytest | k6",
    "rerun_count":    1
  }
}
```

Field rules:
- `status` carries the **final attempt's** raw outcome (backwards-compatible with existing readers).
- `verdict` is the flake-aware judgement: PASS = all attempts pass, FLAKY = mixed, FAIL = all attempts fail.
- `attempts[]` records every retry triggered by `harness.yaml outputs.validation.retry_count` (default 2; 0 disables; capped at 5).
- `budget` is present only on `type: performance` TCs. `budget_pass: null` when the NFR string is unparseable.
- Manual TCs (`automatable: false`) keep `last_run: null`.

## Anti-pattern

- TC without `requirement_id` — orphan test, can't trace assertion → spec.
- TC `requirement_id` pointing to a non-existent FR/NFR — broken trace.
- Bulk-generating happy-path-only TCs — coverage audit catches missing edge/negative cases per AC.
- Fix that ships without a `regression-<id>`-tagged TC — silently re-breakable; rejected at Step 3.
