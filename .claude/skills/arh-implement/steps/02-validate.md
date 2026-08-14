# Step 2 — Validate (mandatory)

Goal: run the E2E test suite from `docs/test-cases/$ARGUMENTS.json` against the real environment.

**This step is non-negotiable.** Even if the implementation-agent reports all local checks pass, you MUST invoke the validation-agent. Unit tests do not catch integration regressions; mocked tests do not match production. Skipping this step is the most common cause of regressions reaching `main`.

## Procedure

Invoke `validation-agent` with `$ARGUMENTS`. The agent:

1. Reads `docs/test-cases/$ARGUMENTS.json`.
2. Runs every flow against the configured environment (no mocks at integration boundary).
3. Does NOT stop on first failure — collects all results.
4. Writes `docs/features/$ARGUMENTS/VALIDATION-<YYYYMMDD-HHMM>.md`.

## Pre-flight checks (run before invocation)

| Check | Failure → |
|---|---|
| `docs/features/$ARGUMENTS/state.json` `.impl_evidence` exists with `checks` populated | escalate: `Step 1 returned without its mandatory state write — re-invoke implementation-agent to complete the evidence pass + state write. Prose hand-off alone is not acceptance.` |
| Every `.impl_evidence.checks.*.status` is `PASS` or `N/A` (N/A rows carry a `flag_id`) | escalate listing the offending dimensions: `Step 1 handed over non-green evidence — the agent must fix or escalate via EVIDENCE-ESCALATION.md, never hand over FAILs` |
| `docs/test-cases/$ARGUMENTS.json` exists | escalate: `Run /arh-plan-requirements $ARGUMENTS first` |
| Required env vars set (per `harness.yaml`) | escalate with the missing var names |
| Endpoint / dev server reachable | escalate: `Cannot reach <url>; aborting validation` |
| Mobile device / simulator available (mobile role) | escalate: `Connect a device or start a simulator` |
| App build does not boot | escalate with the build error |

Do not "mock your way out" of any of these. Escalate.

## Output

```
Validation: <P>/<TOTAL> passed
  ✓ TC-01  Apply valid promo code
  ⨯ TC-03  Apply expired promo code   (assertion: status code 400 ≠ 200)
  ⨯ TC-07  Apply already-used code    (timeout: server returned no response)

Report: docs/features/$ARGUMENTS/VALIDATION-<DATE>.md
```

If any test failed, proceed to Step 3 (fix loop). Otherwise jump to Step 4.
