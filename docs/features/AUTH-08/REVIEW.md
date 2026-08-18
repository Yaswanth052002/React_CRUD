# Code Review — feature/AUTH (AUTH-08, working tree vs 7a1c347c)

- Date: 2026-08-18T00:00:00Z
- Mode: story (AUTH-08), diff base `7a1c347c` (feature/AUTH tip prior to this implementation session)
- Files reviewed: 7 (README.md, backend/.env.example, backend/app/main.py, docker-compose.yml,
  backend/tests/test_config.py, backend/tests/test_docker_compose_config.py, backend/tests/test_cors.py)
  — plus non-code state artefacts (docs/activity/2026-08.jsonl, docs/features/AUTH-08/state.json,
  docs/test-cases/AUTH-08.json) which are harness bookkeeping, not reviewed as production code.
- Verdict: **PASS**

## Executive summary

AUTH-08 adds the `JWT_SECRET_KEY` env var end-to-end: documented in `backend/.env.example`,
passed through `docker-compose.yml` via `${JWT_SECRET_KEY}` (host-referenced, never a literal),
validated fail-fast in `backend/app/main.py`'s `on_startup()` before `seed_if_empty` runs, and
documented in `README.md`. The change set is minimal and surgical — no new function signature,
no new export, no touch to `auth_service.py` or any other AUTH-02/03/04 file, matching the
story's explicit out-of-scope boundary on JWT-signing internals. Three new leaf test files
(`test_config.py`, `test_docker_compose_config.py`, `test_cors.py`) cover the PLAN's declared TCs
structurally, without adding new runners or dependencies. `FLAGS.md`'s AF-05 accurately documents
that PLAN.md's R-08 risk (no consumer of `JWT_SECRET_KEY`) is now stale because AUTH-02's
already-merged ADR-5 added real JWT signing — confirmed against `auth_service.py:184-185`
(`_issue_token` reads `os.getenv("JWT_SECRET_KEY")`) — and that this correction is recorded
without touching the frozen PLAN.md text.

🟢 Strengths: fail-fast check placed correctly before seeding; secret never logged or hardcoded;
`docker-compose.yml` uses host-referenced interpolation, never a literal; zero scope-creep into
JWT-signing code; FLAGS.md/state.json carry-forward entry is accurate and well-sourced.

⚠️ Warnings: one MEDIUM — the `.env.example` / README production-generation guidance
(`python -c "import secrets; ..."`) does not match REQUIREMENTS.md FR-1's verbatim comment
wording (`openssl rand -hex 32`) that PLAN.md task T-01 committed to matching exactly. Functionally
equivalent and still satisfies condition C-1 (placeholder-only, purpose documented), so this is a
documentation-fidelity nit, not a security or scope issue.

🛑 Blockers: none.

## Findings summary

| Severity | Count | Category distribution                          |
|----------|-------|-------------------------------------------------|
| CRITICAL |   0   | —                                                 |
| HIGH     |   0   | —                                                 |
| MEDIUM   |   1   | design-patterns (1)                              |
| LOW      |   0   | —                                                 |

## Detailed findings

### MEDIUM

#### F-1 — design-patterns: `.env.example`/README comment deviates from PLAN's committed verbatim wording
- Category: design-patterns
- Path: `backend/.env.example:6-9`, `README.md:106`
- Source: PLAN.md § 5 task T-01 ("comment matches REQUIREMENTS.md verbatim wording") and
  REQUIREMENTS.md FR-1 (comment text: "Secret key for signing JWT tokens. Generate a random value
  for production (e.g. `openssl rand -hex 32`). Never commit a real secret.")
- Description: The shipped comment/README guidance uses a different production-generation
  command (`python -c "import secrets; print(secrets.token_urlsafe(64))"`) and slightly different
  prose than REQUIREMENTS.md's FR-1 wording, despite PLAN.md's task note explicitly committing to
  verbatim matching. This does not violate condition C-1 in substance (placeholder-only value,
  clear purpose comment, no real secret ever committed — confirmed by `test_env_example_*` in
  `test_config.py`), so it is not a security or correctness defect, only a fidelity gap against
  what the PLAN said it would do.
- Suggested fix: Either align the comment text to REQUIREMENTS.md's exact wording, or (preferred,
  since the shipped guidance is arguably more portable — `openssl` isn't guaranteed on Windows)
  update REQUIREMENTS.md/PLAN.md in a follow-up doc pass to reflect the wording actually adopted,
  so the artifacts stay in sync. Not blocking.

## What went well

- `on_startup()`'s fail-fast check is inserted before `seed_if_empty(db)`, reads
  `os.getenv("JWT_SECRET_KEY", "").strip()`, logs exactly one readable `ERROR` line with no
  secret value or stack trace, and raises `RuntimeError` — matches PLAN § 3 contract exactly, no
  new function signature or export introduced.
- `docker-compose.yml`'s `environment:` block uses `JWT_SECRET_KEY=${JWT_SECRET_KEY}` (host
  reference, never a literal) and `CORS_ORIGINS=${CORS_ORIGINS:-http://localhost:5173,http://127.0.0.1:5173}`
  with a sane default — matches PLAN T-02 verbatim.
- Zero scope-creep: `git diff` confirms no edits to `auth_service.py` or any other AUTH-02/03/04
  file; `backend/app/main.py` diff is a 4-line in-place insertion with no new imports (`os` and
  `logger` were already present).
- `FLAGS.md` AF-05 accurately describes PLAN.md R-08 as stale post-merge of AUTH-02's ADR-5 real
  JWT signing (verified: `auth_service.py:184-185` reads `JWT_SECRET_KEY` in `_issue_token`),
  without editing the frozen PLAN.md — correction lives in FLAGS.md/state.json per
  `surgical-changes`.
- Security baseline honored: startup-failure log message is a static string (no secret
  interpolation); `test_config.py`'s test values (`"a-non-empty-test-value"`) are not
  production-looking secrets; `.env.example`'s `JWT_SECRET_KEY=CHANGE_ME` is confirmed
  never-a-real-secret by both a dedicated test and manual inspection.
- Test files (F-04/F-05/F-06) match PLAN § 7 exactly: no new test runner, no YAML-parsing
  dependency added for `test_docker_compose_config.py` (plain string search), and
  `test_cors.py`'s declared-`e2e` TC-09 is reproduced via FastAPI's `TestClient` per the PLAN's
  stated precedent.

## Recommendation

**PASS.** No CRITICAL or HIGH findings; one MEDIUM documentation-fidelity nit that does not block
merge. Proceed to `/arh-security-review`.
