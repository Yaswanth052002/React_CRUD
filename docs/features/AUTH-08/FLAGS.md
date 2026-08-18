# Agent Flags — AUTH-08

### AF-01: evidence-na · task: n/a · docs/config/project-commands.yaml
typecheck dimension marked N/A — source key absent/empty: "plain JSX, no TypeScript/mypy configured" (pre-existing project-wide gap, same as AUTH-01..AUTH-07 AF-01, not introduced by this story).

### AF-02: evidence-na · task: n/a · docs/config/project-commands.yaml
lint dimension marked N/A — source key absent/empty: "no linter configured for react or fastapi" (pre-existing project-wide gap, same as AUTH-01..AUTH-07 AF-02, not introduced by this story).

### AF-03: evidence-na · task: n/a · docs/config/project-commands.yaml
design_check dimension marked N/A — source key absent/empty: "no accessibility/console-error/lighthouse tooling exists in this repo" (pre-existing project-wide gap, same as AUTH-01..AUTH-07 AF-03, not introduced by this story). AUTH-08 has `design: n/a` in state.json (no DESIGN.md, `integrations.design: none`) and adds no new rendered UI surface — it is deployment/config/docs wiring only (`.env.example`, `docker-compose.yml`, `main.py` startup check, README).

### AF-04: evidence-na · task: n/a · docs/config/stack-smoke.md
runtime dimension's `react` stack entry: boot-only evidence obtained (200 OK + clean boot log at `http://localhost:5175/`). No browser-capable E2E/test-runner tooling is installed in this repo (`test_e2e: n/a`) to additionally assert the SPA mounted content beyond the bare root element, per `evidence-pass`'s `render_check` contract. `render_check: "unavailable"` recorded on that stack's entry — pre-existing repo gap (same as AUTH-01 AF-04, AUTH-02 AF-07, AUTH-06 AF-04), not introduced by this story. This story does not touch any frontend file.

### AF-05: risky-pattern · task: n/a · docs/features/AUTH-08/PLAN.md § 1 and § 6 (risk R-08)
PLAN.md § 1 and § 6 (risk R-08) state "no backend code in AUTH-02/AUTH-03/AUTH-04's PLANs reads
`JWT_SECRET_KEY` to sign a JWT" and carry this forward as an accepted, still-open gap. This is
stale as of implementation: AUTH-02's PLAN.md was later amended (its own § 1 ADR-5) to add real
JWT signing, already implemented and merged onto this branch —
`backend/app/services/auth_service.py`'s `_issue_token()` (line 184) calls
`os.getenv("JWT_SECRET_KEY")` and signs a real JWT via PyJWT, with its own code comment noting
"Defense in depth — AUTH-08's startup check should already have prevented this." So T-03's
fail-fast startup validation is not landing ahead of a still-nonexistent consumer — it is
landing to protect an already-real, already-merged consumer that, until this story, had no
startup-time guarantee the env var exists (a missing `JWT_SECRET_KEY` previously only surfaced
as a 500 on the first login attempt, not a fail-fast boot error). `docs/features/AUTH-08/
state.json`'s `pending_carry_forward[0]` already records this resolution
(`resolved_at: 2026-08-17T23:45:00Z`) — this flag exists so the correction is visible in
`FLAGS.md` alongside the other implementation-session flags, per the human-review trail. No
PLAN.md text was altered (surgical-changes — PLAN.md is a frozen planning artifact); the
correction lives here and in `state.json`.
