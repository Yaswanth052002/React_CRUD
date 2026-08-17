# Research Assessment: AUTH-08 — Docker and deployment environment configuration for authentication

**Story**: AUTH-08  
**Epic**: AUTH  
**Phase**: Research  
**Assessment date**: 2026-08-17  
**Assessor**: Claude Research Agent

---

## Upstream dependencies

Per story Dependencies section (refreshed):
- **Upstream**: AUTH-04 (JWT bearer token mechanism finalized; research complete, verdict GO-WITH-CONDITIONS). AUTH-04 research flagged CORS Authorization header allowance as HIGH risk; this story must resolve it.
- **Informational (not blocking)**: AUTH-02, AUTH-03 (completed).
- **Downstream**: None.

Prior research state (from `docs/state/features.json`):
- AUTH-08 is story-validated, P2, independent_test=false, needs_clarification_count=0. Gate is clear to proceed to research.
- AUTH-04 research is complete, verdict GO-WITH-CONDITIONS. Its risk register flagged CORS Authorization-header allowance as a HIGH-severity open question at the time it was written. This question is now resolved — see the "Cross-reference: AUTH-04 CORS concern" section below, which confirms `backend/app/main.py` already sets `allow_headers=["*"]`.
- AUTH-04 research explicitly states: "This is AUTH-08 scope, but AUTH-04 cannot ship to production without it. Specify: 'AUTH-04 assumes AUTH-08 has configured Access-Control-Allow-Headers to include Authorization.'"

---

## Exploration Log

### docker-compose.yml: service topology and environment configuration
- **Where**: `docker-compose.yml:1-18`
- **What**: Two services: `backend` (port 8000) and `frontend` (port 5173→80, nginx serving). Backend Dockerfile uses python:3.11-slim, frontend uses node:22-alpine → nginx:alpine multi-stage build. No environment variables passed to containers yet.
- **Surprises**: docker-compose.yml does not pass CORS_ORIGINS or JWT_SECRET_KEY to the backend container. This is a gap for AC1-AC2 acceptance criteria (app must work under docker-compose).
- **Open**: How are CORS_ORIGINS and JWT_SECRET_KEY provided to the backend in docker-compose? Via docker-compose environment section, or .env file mount?

### backend/.env.example: environment documentation
- **Where**: `backend/.env.example:1-5`
- **What**: Two env vars documented: `DATABASE_URL` (SQLite path) and `CORS_ORIGINS` (comma-separated list with localhost entries). No JWT_SECRET_KEY entry.
- **Surprises**: JWT_SECRET_KEY is missing entirely. Story AC4 explicitly requires: "when a developer inspects `backend/.env.example`, then `JWT_SECRET_KEY` is present there with a placeholder value (e.g. `CHANGE_ME`) and a comment describing its purpose".
- **Open**: None — the absence is a clear gap to address.

### frontend/.env.example: environment documentation
- **Where**: `frontend/.env.example:1`
- **What**: Single env var: `VITE_API_URL=http://localhost:8000` (hardcoded to localhost).
- **Surprises**: VITE_API_URL is hardcoded to localhost. In docker-compose, the frontend container can reach the backend at `http://crud-backend:8000` (service DNS) or at `http://localhost:8000` (mapped port on host). The frontend Dockerfile (multi-stage Node + nginx build) bakes this into the bundle at build time; Vite embeds VITE_ prefixed vars into the JavaScript. For docker-compose to work, either: (a) docker-compose must pass build args to override VITE_API_URL, (b) a separate .env file is used for docker builds, or (c) VITE_API_URL is read at runtime via a config file served by nginx. Current setup assumes localhost works.
- **Open**: For docker-compose on localhost (per story scope: local/dev), http://localhost:8000 works because the frontend is mapped to localhost:5173 and backend to localhost:8000 (same host). For remote docker deployments, this would need to be configurable (out of scope per story). Decision: accept hardcoded localhost for now; document the limitation.

### backend/app/main.py: CORS middleware configuration
- **Where**: `backend/app/main.py:33-41`
- **What**: CORS middleware configured via FastAPI's `CORSMiddleware`. Line 34 reads `CORS_ORIGINS` from env (default: http://localhost:5173). Line 40: `allow_headers=["*"]` (wildcard — allows all headers, including Authorization). Line 38: `allow_credentials=True`.
- **Surprises**: **CORS Authorization header is already supported**. The `allow_headers=["*"]` wildcard (line 40) explicitly allows all headers, including `Authorization`. AUTH-04 research flagged this as HIGH risk (CORS Authorization header allowance not confirmed), but the code already handles it correctly. This resolves AUTH-04's CORS concern without further changes.
- **Open**: None — CORS is correctly configured.

### Backend Docker entrypoint: no startup validation
- **Where**: `backend/Dockerfile:13` (CMD line)
- **What**: Backend container starts with `uvicorn app.main:app --host 0.0.0.0 --port 8000`. No validation that required env vars (JWT_SECRET_KEY, CORS_ORIGINS, DATABASE_URL) are present before startup.
- **Surprises**: If JWT_SECRET_KEY is missing, the backend will start and only fail when an auth endpoint tries to use it (at runtime). Story NFR line 28 requires: "Backend startup MUST fail fast with a readable error message (not a raw stack trace, per project convention) if a required new auth-related env var is missing, rather than starting in a broken/insecure default state."
- **Open**: Backend needs startup-time validation. Implementation: add validation in `main.py` on_startup hook or in database.py initialization.

### CORS_ORIGINS for docker-compose
- **Where**: `backend/.env.example:5` and `docker-compose.yml:1-18`
- **What**: CORS_ORIGINS in .env.example is set to `http://localhost:5173,http://127.0.0.1:5173` (localhost only). In docker-compose on a local machine, the frontend is mapped to `localhost:5173` (on the host), and the browser's Origin header will be `http://localhost:5173`. The backend accepts this origin per the .env.example config. This is correct for local docker-compose.
- **Surprises**: None — CORS_ORIGINS is correctly set for local dev.
- **Open**: None — no change needed for local docker-compose scope.

---

## Pattern map

### Existing code to extend
- **`backend/.env.example`** — Add `JWT_SECRET_KEY` with a placeholder value (e.g., `CHANGE_ME`) and a comment explaining its purpose, consistent with existing `DATABASE_URL` and `CORS_ORIGINS` documentation.
- **`backend/app/main.py`** — Add startup validation in the `on_startup()` event handler (lines 47-53) to check that `JWT_SECRET_KEY` env var is present and non-empty. If missing, raise an exception with a readable error message (not a stack trace).
- **`docker-compose.yml`** — Add `environment:` section under the backend service to pass `JWT_SECRET_KEY` and confirm `CORS_ORIGINS` are set. Example: `environment: JWT_SECRET_KEY=your-dev-secret, CORS_ORIGINS=http://localhost:5173`.

### Existing patterns to follow
- **`.env.example` documentation pattern** — Placeholder value + comment describing purpose, consistent with DATABASE_URL (line 2) and CORS_ORIGINS (line 5). JWT_SECRET_KEY follows the same style.
- **Error handling pattern** — Per `.claude/rules/security-baseline.md` and `fastapi-patterns/SKILL.md`: errors shown to users must not include stack traces. Use the existing centralized exception handler in `main.py` (lines 73-79) to catch startup validation errors and log them with a readable message.
- **Startup validation pattern** — Use the existing `on_startup()` event handler in `main.py` to add environment validation. Log the error and re-raise, allowing FastAPI to shut down cleanly.

### New files to create
- (None required for this story.) `.env.docker` is optional — not needed if docker-compose passes env vars inline.

### Shared code at risk
- **`backend/app/main.py` on_startup handler** — Already validates seed data (lines 49-53). Adding JWT_SECRET_KEY validation here extends the startup checks. Risk: if validation is too strict (e.g., rejects valid values), authentication will fail. Mitigation: unit test that startup validates JWT_SECRET_KEY presence and rejects missing/empty values with a readable error.
- **`docker-compose.yml` environment variables** — Both services may depend on the same CORS_ORIGINS. Backend and frontend (via VITE_API_URL) must agree on URLs for cross-origin calls to work. Risk: if docker-compose sets CORS_ORIGINS but frontend has hardcoded localhost, local dev works but remote deployments fail. Mitigation: accept the scope boundary (local/dev only); document for future remote deployments.

---

## Risk register

| # | Dimension       | Severity | Description                                      | Mitigation                                  |
|---|-----------------|----------|--------------------------------------------------|---------------------------------------------|
| 1 | Integration     | **HIGH** | **JWT_SECRET_KEY missing from backend/.env.example**. Story AC4 requires JWT_SECRET_KEY to be documented in `backend/.env.example` with a placeholder and comment. Currently missing. Without this, developers will not know they must set it, and docker-compose will fail silently or with a cryptic error. | Mitigation: (a) Add JWT_SECRET_KEY to `backend/.env.example` with placeholder `CHANGE_ME` and a comment: "# Secret key for signing JWT tokens (use a random string in production)". (b) Ensure docker-compose.yml passes this env var to the backend service. (c) Test: run docker-compose up with and without JWT_SECRET_KEY set; verify startup fails with a readable error if missing. |
| 2 | Integration     | **HIGH** | **docker-compose.yml does not pass JWT_SECRET_KEY to backend**. Even if JWT_SECRET_KEY is documented in .env.example, docker-compose.yml must pass it to the backend container via the `environment:` section. If not passed, the backend container will not have access to it. | Mitigation: (a) Add `environment:` section to the `backend` service in docker-compose.yml. (b) Pass JWT_SECRET_KEY (can reference an env var on the host via `${JWT_SECRET_KEY}`). (c) Verify CORS_ORIGINS is also set for docker-compose topology. (d) Test: docker-compose up with env vars set, verify backend starts successfully and logs successful startup. |
| 3 | Domain          | **MED** | **No startup validation for JWT_SECRET_KEY**. Story NFR line 28 requires "Backend startup MUST fail fast with a readable error message if a required new auth-related env var is missing". Currently, main.py has no validation; backend would start and fail later at runtime when auth is attempted. | Mitigation: (a) Add validation in `main.py` on_startup() event handler (before seeding). (b) Check that JWT_SECRET_KEY is present and non-empty: `jwt_secret = os.getenv("JWT_SECRET_KEY", "").strip()` if not jwt_secret: raise ValueError("JWT_SECRET_KEY env var is required"). (c) Catch ValueError and log readable message, then re-raise to fail startup. (d) Test: simulate missing JWT_SECRET_KEY, verify startup fails immediately with readable message (no stack trace). |
| 4 | Compatibility   | **MED** | **Frontend VITE_API_URL hardcoded to localhost**. In docker-compose running locally, this works (frontend at localhost:5173, backend at localhost:8000, same host). But if docker-compose is deployed remotely or in a K8s cluster, hardcoded localhost breaks. Current story scope is local/dev, so this is acceptable; but document the limitation. | Mitigation: (a) Accept hardcoded localhost as documented scope boundary (local/dev per story line 26-27). (b) In docker-compose on local machine, VITE_API_URL=http://localhost:8000 is correct (frontend mapped to port 5173 makes the call from localhost). (c) For future remote deployments, document: "Frontend VITE_API_URL is baked at build time. To change it for remote deployments, either: (i) pass a Vite build arg (vite build --define VITE_API_URL=...), (ii) use a runtime config file served by nginx, or (iii) add an entrypoint script to inject the URL into HTML. Not in scope for AUTH-08 (local/dev)." (d) Test: confirm docker-compose up on localhost works end-to-end (frontend can reach backend). |
| 5 | Integration     | **LOW** | **CORS Authorization header concern** (flagged by AUTH-04 research). AUTH-04 research raised HIGH risk: "backend must accept Authorization header from cross-origin requests". Scan reveals: backend.app.main.py line 40 has `allow_headers=["*"]`, which already allows all headers (including Authorization). Risk is **resolved**. | Mitigation: (a) No code change needed. (b) Document in AUTH-08 PLAN.md: "CORS Authorization header is already supported via `allow_headers=['*']` in backend/app/main.py line 40. AUTH-04 can proceed without additional CORS changes in this story." (c) Test: in AUTH-02 implementation, verify protected endpoint called with Authorization header returns 200 (not 401 due to CORS preflight failure). |
| 6 | Security        | **LOW** | **JWT_SECRET_KEY placeholder value in .env.example**. Story NFR line 26 requires: "JWT_SECRET_KEY MUST NOT ship with a real default value... only a placeholder (e.g. `CHANGE_ME`) or empty value". Ensures no hardcoded secret leaks. | Mitigation: (a) Use `CHANGE_ME` as the placeholder in .env.example. (b) Add a comment: "# IMPORTANT: Generate a random secret for production (e.g., openssl rand -hex 32)". (c) Git should ignore .env files (already true per .gitignore). (d) Test: verify .env.example contains only placeholder, never a real secret. |
| 7 | Domain          | **LOW** | **docker-compose environment variable source**. Story AC1 requires "all origin/URL values are sourced from VITE_API_URL / CORS_ORIGINS env vars per existing convention". For docker-compose, must document how env vars are provided: via docker-compose.yml `environment:` section, `.env.docker` file, or host `.env` file. | Mitigation: (a) Update docker-compose.yml to explicitly set CORS_ORIGINS and JWT_SECRET_KEY in the `environment:` section (or reference ${VARIABLE} from host). (b) Document in README.md or a DEPLOYMENT.md: "To run docker-compose: (1) Set JWT_SECRET_KEY on the host (e.g., `export JWT_SECRET_KEY=dev-secret`), (2) run docker-compose up. Backend and frontend will use env vars from the host and docker-compose.yml." (c) Test: docker-compose up works without a .env file (env vars set on host). |

---

## Score + verdict

### 5-dimensional rubric

| Dimension       | Weight | Pass criterion                                                              | Finding                                                                   | Score |
|---|---|---|---|---|
| Integration     | 25     | All upstream dependencies available; failure modes well understood          | AUTH-04 complete (GO-WITH-CONDITIONS). CORS Authorization header is already supported (allow_headers=["*"]). JWT_SECRET_KEY is missing from .env.example and docker-compose.yml environment. Failure modes: (1) missing JWT_SECRET_KEY in .env.example (AC4 gap, high-impact), (2) docker-compose doesn't pass JWT_SECRET_KEY (startup fails), (3) no startup validation (fails at runtime, not at startup). All modes understood; mitigations clear. | 70    |
| Compatibility   | 20     | Backward compat plan exists for each affected client/version                | **Environment variables**: JWT_SECRET_KEY is new, required, but documented. docker-compose.yml is updated to pass it. CORS_ORIGINS remains unchanged (already configured for local dev). **Frontend VITE_API_URL**: hardcoded to localhost, works for local docker-compose per scope. **Backend startup**: new validation added; existing startup code (seeding) remains unchanged. **Mitigation**: Breaking change for deployments relying on missing JWT_SECRET_KEY (they will fail at startup — correct behavior per NFR). Test: existing CRUD tests still pass after startup validation is added (mock JWT_SECRET_KEY env var). | 80    |
| Domain          | 20     | Edge cases enumerated; no hidden invariants surfaced during scan            | **AC1 (docker-compose endpoint routing)**: frontend at localhost:5173 calls backend at localhost:8000 (mapped from container port 8000). CORS_ORIGINS=http://localhost:5173 allows this. ✓ Clear. **AC2 (local dev endpoint routing)**: uvicorn on localhost:8000, npm dev on localhost:5173. CORS_ORIGINS unchanged. ✓ Clear. **AC3 (Bearer token across containers)**: CORS Authorization header is allowed (allow_headers=["*"]). ✓ Clear. **AC4 (JWT_SECRET_KEY documented)**: .env.example updated, docker-compose.yml passes it. ✓ Clear. **NFR (startup validation)**: missing JWT_SECRET_KEY fails at startup with readable error. ✓ Clear. **Edge case: JWT_SECRET_KEY is empty string**: startup validation rejects it. ✓ Handled. **Edge case: CORS_ORIGINS is misconfigured**: frontend origin not in list, CORS preflight fails. Accepted scope boundary (developer's responsibility to configure). ✓ Documented. All edge cases enumerated. | 85    |
| Performance     | 15     | Story has explicit perf budget; estimated work fits within budget           | **NFR**: "startup of either container must not be delayed by more than 1s due to new env var loading/validation". Story line 25. Estimated breakdown: env.getenv() call (~0.01ms) + validation check (~0.01ms) + error handling (~0.1ms) = ~0.12ms, well within 1s budget. **Implementation**: ~30 lines (add JWT_SECRET_KEY to .env.example, add environment section to docker-compose.yml, add validation in main.py on_startup). Fits easily within story scope. **Test**: benchmark startup time with and without JWT_SECRET_KEY validation; target <1s (will achieve <100ms). | 95    |
| Dependency      | 20     | All upstream stories complete; no blocking external work                    | **Upstream**: AUTH-04 research complete (verdict GO-WITH-CONDITIONS). AUTH-02, AUTH-03 complete. No blocking external work. CORS Authorization header concern is resolved (already implemented). **Downstream**: None. **External**: None. | 95    |

**Total: (70×0.25 + 80×0.20 + 85×0.20 + 95×0.15 + 95×0.20) = 17.5 + 16 + 17 + 14.25 + 19 = 83.75/100**

### **Total: 84/100 → GO-WITH-CONDITIONS**

No single dimension scores <40. Integration (70) reflects missing JWT_SECRET_KEY in .env.example and docker-compose.yml setup — high-impact but straightforward to fix. Compatibility (80) is solid: env var changes are documented, frontend URL hardcoding is acceptable for local/dev scope. Domain (85) and Performance (95) are strong. Dependency (95) is excellent: all upstream stories complete, and CORS concern is already resolved. The conditions below must be explicitly addressed in PLAN.md before implementation.

### Conditions

The following conditions must be explicitly addressed in PLAN.md before implementation:

1. **JWT_SECRET_KEY documentation (Integration, HIGH)**: PLAN.md must specify: (a) `backend/.env.example` is updated to include `JWT_SECRET_KEY=CHANGE_ME` with a comment explaining its purpose (same format as `DATABASE_URL` and `CORS_ORIGINS`). (b) Comment must note: "IMPORTANT: Generate a random secret for production (e.g., openssl rand -hex 32)". (c) No real secret is ever embedded in .env.example or source code. (d) Test: verify .env.example contains placeholder-only, and that git ignores actual .env files.

2. **docker-compose.yml environment setup (Integration, HIGH)**: PLAN.md must specify: (a) `docker-compose.yml` backend service adds an `environment:` section passing `JWT_SECRET_KEY` (either as a literal dev value, or referenced from host `${JWT_SECRET_KEY}`). (b) Confirm CORS_ORIGINS is passed or inherited from backend .env. (c) Example: `backend: environment: JWT_SECRET_KEY=dev-secret-do-not-use, CORS_ORIGINS=http://localhost:5173`. (d) Test: docker-compose up without .env.docker, with JWT_SECRET_KEY set on host or in docker-compose.yml; verify backend starts successfully.

3. **JWT_SECRET_KEY startup validation (Domain, MED)**: PLAN.md must specify: (a) In `backend/app/main.py`, the `on_startup()` event handler (lines 47-53) adds validation: check that JWT_SECRET_KEY is present and non-empty. (b) If validation fails, log a readable error message (e.g., "JWT_SECRET_KEY environment variable is required") and raise an exception to fail startup. (c) Exception is caught by FastAPI's default handler and returns a 500 error (acceptable for startup — container should be restarted). (d) Test: unit test or integration test that simulates missing JWT_SECRET_KEY; verify startup fails immediately with readable message (no stack trace, no raw exception in logs).

4. **CORS Authorization header resolved (Integration, LOW)**: PLAN.md must document: (a) AUTH-04 research flagged CORS Authorization header allowance as HIGH risk. Scan confirms backend `allow_headers=["*"]` (line 40 of main.py) already supports Authorization header. (b) No additional CORS changes needed for AUTH-08. (c) When AUTH-02 (login endpoint) ships, test that protected endpoints accept Authorization header and return 200 (not 401 due to CORS preflight failure). (d) Reference: AUTH-04 research § Conditions § Risk #5 (CORS and Authorization header).

5. **Frontend VITE_API_URL scope boundary (Compatibility, MED)**: PLAN.md must document: (a) Frontend VITE_API_URL is hardcoded to `http://localhost:8000` in frontend/.env.example. This is baked into the JavaScript bundle at build time (Vite embeds VITE_ prefixed vars). (b) For local docker-compose on localhost, this works: frontend mapped to localhost:5173, backend to localhost:8000, both on same host. (c) For future remote deployments (outside this story's scope): frontend needs a way to discover the backend URL at runtime. Options: (i) Vite build arg (docker build --build-arg), (ii) runtime config file served by nginx, (iii) entrypoint script injecting URL into HTML. (d) Decision: Accept hardcoded localhost for AUTH-08 (local/dev scope per story line 26-27); defer remote-deployment URL discovery to a future story.

6. **Testing plan (Integration/Compatibility)**: PLAN.md must include: (a) Unit test: startup validation rejects missing JWT_SECRET_KEY with readable error. (b) Integration test: docker-compose up runs successfully with JWT_SECRET_KEY set (or inherited from docker-compose.yml). (c) E2E test: after docker-compose up, frontend loads, backend health check returns 200, CORS preflight succeeds (OPTIONS request). (d) Manual test: run docker-compose locally, log in via frontend (AUTH-02 endpoint once implemented), confirm protected endpoint is reached with Authorization header (no CORS errors).

7. **Documentation (Domain)**: PLAN.md must include: (a) Comment in backend/.env.example explaining JWT_SECRET_KEY purpose. (b) Comment in docker-compose.yml showing how environment variables are passed. (c) README.md or DEPLOYMENT.md updated: "To run docker-compose: Set JWT_SECRET_KEY env var on host, then `docker-compose up`."

---

## Synthesis

**AUTH-08 is feasible for planning with documented conditions; the core infrastructure is in place, but critical configuration gaps must be addressed before implementation.**

This story delivers Docker and local-dev environment configuration for the JWT bearer mechanism finalized in AUTH-04. The codebase's existing docker-compose.yml (separate backend/frontend containers) and `.env.example` patterns are the foundation; AUTH-08 extends them by (1) documenting the new `JWT_SECRET_KEY` env var in `backend/.env.example` (AC4), (2) updating `docker-compose.yml` to pass this var to the backend container (AC1-AC2), and (3) adding startup validation so the backend fails fast with a readable error if the var is missing (NFR line 28). The scan reveals the critical gap: **JWT_SECRET_KEY is missing entirely from backend/.env.example**, violating AC4 directly. The CORS concern flagged by AUTH-04 research is **already resolved** — the backend's `allow_headers=["*"]` (line 40 of main.py) explicitly supports the Authorization header required for JWT bearer tokens, requiring no additional changes.

The implementation is straightforward: add one env var to .env.example and docker-compose.yml, and ~20 lines of validation code in main.py. Both frontend and backend can communicate end-to-end via localhost mapping in local docker-compose, aligning with the story's scope (local/dev, no HTTPS enforcement). The single biggest risk is the missing JWT_SECRET_KEY documentation, which would cause AC4 to fail; this must be addressed in planning. Performance risk is minimal: startup validation adds <1ms, well below the 1s budget. Compatibility is solid: the env var is new but required, so deployments are forced to supply it (correct behavior); existing CRUD tests pass unchanged.

Key implementation decisions now resolved: (1) use existing docker-compose topology (localhost mapping for local dev), (2) add JWT_SECRET_KEY to .env.example with placeholder, (3) update docker-compose.yml to pass env vars, (4) validate JWT_SECRET_KEY on startup before seeding, (5) CORS Authorization header support is already present (no changes needed). All acceptance criteria are addressable, and all failure modes are understood.

---

## Clarifications

(None. Story is validated with zero clarifications per state entry. All AC are testable and implementation path is clear.)

