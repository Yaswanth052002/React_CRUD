# Agent Flags — AUTH-02

<!-- All 7 flags triaged 2026-08-17 by yaswanth.panthangi@apexon.com — decisions recorded in docs/features/AUTH-02/state.json .agent_flags[] -->
<!-- AF-01: accept -->
<!-- AF-02: defer (expected sequencing, AUTH-08 implements after AUTH-02) -->
<!-- AF-03: accept -->
<!-- AF-04: defer (pre-existing repo gap) -->
<!-- AF-05: defer (pre-existing repo gap) -->
<!-- AF-06: reject (noise, per SRF-01/USR-01 precedent) -->
<!-- AF-07: defer (pre-existing repo gap) -->

### AF-01: inconsistency · task: T-07 · backend/tests/test_users.py
`test_users.py` previously defined its own module-level in-memory SQLite engine and
`app.dependency_overrides[get_db]` override, identical in shape to what `test_auth.py`/
`test_provisioning.py` (T-07/T-08) needed to add. Since `app.dependency_overrides` lives on the
single shared `app` object, two test modules each setting this override independently means
whichever module pytest imports last silently wins for **every** test module's HTTP requests —
this would have made `test_users.py`'s and the new auth tests' database isolation depend on
import order (a real, hard-to-notice bug, not a style issue). Extracted the shared engine/
client/override/`_reset_db` fixture into `backend/tests/conftest.py` and updated
`test_users.py` to import `client` from it instead of redefining its own copy. `test_users.py`'s
own test bodies are unchanged.

### AF-02: risky-pattern · task: T-12 · docs/features/AUTH-08/PLAN.md (cross-story assumption)
ADR-5 (this story's PLAN, amendment) states `JWT_SECRET_KEY` is "already documented, passed
through (`docker-compose.yml`), and fail-fast-validated at startup entirely by AUTH-08 (already
shipped in that story's PLAN)". In the actual repository state on this branch, AUTH-08 has only
PLAN/research/PRD artifacts committed (`docs(AUTH): add intake, research, PRD, and plan
artifacts for AUTH epic`) — no code implementing that env var's documentation or fail-fast
validation exists yet: `backend/.env.example` has no `JWT_SECRET_KEY` entry and
`docker-compose.yml` does not pass it through. AUTH-02's own code and tests are unaffected
(`AuthService._issue_token` reads `os.getenv("JWT_SECRET_KEY")` defensively and returns a
generic 500 if it's unset, exactly as ADR-5 specifies), but a real deployment will 500 on every
login until AUTH-08 actually lands its env-var wiring, or an operator sets the variable
manually. Flagging since AUTH-02's PLAN treats AUTH-08's env-var work as already-shipped
groundwork, which isn't true of this branch's current code.

### AF-03: bug-fix · task: T-05 · backend/app/main.py
`http_exception_handler` (pre-existing, `main.py`) built its `JSONResponse` from
`exc.status_code`/`exc.detail` only, dropping any `exc.headers`. This meant the FR-6 rate-limit
`HTTPException(429, ..., headers={"Retry-After": ...})` never actually reached the client — the
`Retry-After` header was silently lost for every `HTTPException` in the app, not just this
story's. Fixed by passing `headers=getattr(exc, "headers", None)` through to `JSONResponse`.
This is a one-line, minimal fix required for AUTH-02-TC-10 (`Retry-After` header assertion) to
pass; no other behavior of the existing CRUD endpoints changes, since none of them currently
raise an `HTTPException` with custom headers.

### AF-04: evidence-na · task: n/a · docs/config/project-commands.yaml
`typecheck` dimension marked N/A — source key is `(n/a — no TypeScript/mypy configured; react
uses plain JSX, fastapi has no static type checker wired)`, a pre-existing repo-wide gap, not
introduced by this story.

### AF-05: evidence-na · task: n/a · docs/config/project-commands.yaml
`lint` dimension marked N/A — source key is `(n/a — no linter configured for react or fastapi)`,
a pre-existing repo-wide gap, not introduced by this story.

### AF-06: evidence-na · task: n/a · docs/config/project-commands.yaml
`design_check` dimension marked N/A — source key is blank; this story is backend-only
(`design = n/a` in `docs/features/AUTH-02/state.json`) and no accessibility/console-error/
lighthouse tooling exists in this repo, per the key's own comment in
`project-commands.yaml`.

### AF-07: evidence-na · task: n/a · docs/config/stack-smoke.md
`runtime` dimension's `react` stack entry: boot-only evidence obtained (200 + clean boot log at
`http://127.0.0.1:5173/`). No browser-capable E2E/test-runner tooling is installed in this repo
(`test_e2e: n/a`, no Vitest test files despite the runner being wired) to additionally assert
the SPA actually mounted content beyond the bare root element, per `evidence-pass`'s
`render_check` contract. `render_check: "unavailable"` recorded on that stack's entry —
pre-existing repo gap, not introduced by this (backend-only) story.
