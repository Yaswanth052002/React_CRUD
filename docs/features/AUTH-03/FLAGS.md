# Agent Flags — AUTH-03

<!-- All 4 flags triaged 2026-08-18 by yaswanth.panthangi@apexon.com — decisions recorded in docs/features/AUTH-03/state.json .agent_flags[] -->
<!-- AF-01: accept -->
<!-- AF-02: defer (pre-existing repo gap) -->
<!-- AF-03: defer (pre-existing repo gap) -->
<!-- AF-04: reject (noise, per SRF-01/USR-01/AUTH-02 precedent) -->

### AF-01: risky-pattern · task: T-01 · backend/requirements.txt
`passlib[bcrypt]==1.7.4` pinned per ADR-1, but `passlib` 1.7.4's bcrypt backend probes
`bcrypt.__about__.__version__` to detect the installed `bcrypt` version — an attribute removed
in `bcrypt>=4.1` (last published bcrypt release with `__about__` is `4.0.x`; `pip install
"passlib[bcrypt]==1.7.4"` alone resolves to `bcrypt` 5.x today, since its own constraint is only
`bcrypt>=3.1.0`). Without an explicit pin, `CryptContext.hash`/`verify` fail with
`AttributeError: module 'bcrypt' has no attribute '__about__'` on every call — a root-cause
found and fixed during this session by adding an explicit `bcrypt==4.0.1` pin to
`requirements.txt` alongside `passlib[bcrypt]==1.7.4`. Flagging since this is a known
upstream passlib/bcrypt compatibility gap (not fixed in passlib's last release, 1.7.4, from
2020) that will resurface if `bcrypt` is ever upgraded without also upgrading/patching passlib.

### AF-02: evidence-na · task: n/a · docs/config/project-commands.yaml
`typecheck` dimension marked N/A — source key is `(n/a — no TypeScript/mypy configured)`, a
pre-existing repo-wide gap, not introduced by this story.

### AF-03: evidence-na · task: n/a · docs/config/project-commands.yaml
`lint` dimension marked N/A — source key is `(n/a — no linter configured for react or
fastapi)`, a pre-existing repo-wide gap, not introduced by this story.

### AF-04: evidence-na · task: n/a · docs/config/project-commands.yaml
`design_check` dimension marked N/A — source key is blank; this story is backend-only
(`design = n/a` in `docs/features/AUTH-03/state.json`) and no accessibility/console-error/
lighthouse tooling exists in this repo.
