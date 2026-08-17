# PLAN: AUTH-02 — Existing-user authentication and credential validation

Status: Draft
Source: `docs/features/AUTH-02/REQUIREMENTS.md` (APPROVED) · `docs/research/AUTH-02.md` (86/100, GO-WITH-CONDITIONS) · `docs/stories/AUTH-02.md` (v4, PASS)

## 1. Architecture Decisions

### ADR-1: `AuthService` as a module separate from `UserService` · Accepted · 2026-08-17 · impl-planning-agent

**Context**: Login (AC1-3), the AC4 startup migration, and the AC5 provisioning script all need to read/write `password_hash` and `must_reset_password` via `UserRepository`. `UserService` already owns CRUD business rules (uniqueness, 404s) for the same `User` model, so the auth logic could technically be added there instead of a new module.

**Decision**: A new `backend/app/services/auth_service.py` exposes `AuthService` with three public methods — `login`, `provision_existing_users_with_random_password`, `set_user_initial_password` — plus a private `_verify_credentials` stub and a private in-process rate limiter. `AuthService` calls `UserRepository` directly, the same way `UserService` does; no new repository is introduced. `UserService` gains no auth-related methods.

**Consequences**:
- Positive: auth and CRUD concerns stay independently testable and reviewable (single-responsibility, per `.claude/rules/reusability-baseline.md`); `AUTH-02-TC-11` can assert the boundary mechanically (`inspect` on both classes).
- Negative: two service objects now depend on `UserRepository`, so a future repository-shape change must update both call sites. Reversible mechanically — the two methods could be merged into `UserService` in a follow-up commit with no data migration involved.

### ADR-2: In-process sliding-window counter for login rate-limiting (v1) · Accepted · 2026-08-17 · impl-planning-agent

**Context**: `.claude/rules/security-baseline.md` requires auth endpoints throttled per (hashed) email at 3/60min rolling with HTTP 429 + `Retry-After`. No shared cache (Redis/Memcached) exists in this stack, and the README's target platform is single-server deployment — introducing a new external dependency solely for rate-limiting is not justified at this stage.

**Decision**: `AuthService` holds a private `dict[str, list[float]]` keyed by `sha256(lowercased email)`, mapping to a list of failed-attempt UTC timestamps. Each login attempt prunes entries older than 3600s, then checks `len(remaining) >= 3` before proceeding; on limit, raises an HTTP 429 with `Retry-After` computed from the oldest remaining timestamp's expiry.

**Alternatives considered**:
- Redis-backed counter: rejected — no Redis instance exists in this deployment; adds an external dependency and an ops burden not justified by current single-server scale.

**Consequences**:
- Positive: zero new dependencies, no new infrastructure, ships within this story's scope.
- Negative: rate-limit state is lost on process restart and does not synchronize across multiple server instances (documented as a known v1 limitation, not a defect, revisit if/when this deployment goes multi-server). Reversible at medium cost — swapping the dict for a Redis client is a contained change inside `AuthService`, no schema migration needed.

### ADR-3: AC5 password input via interactive `getpass` stdin prompt, never a CLI argument · Accepted · 2026-08-17 · impl-planning-agent

**Context**: The AC5 operator script must accept a real plaintext password without ever persisting it to shell history or exposing it via `ps`/process listing, per `.claude/rules/security-baseline.md` and NFR-security.

**Decision**: `set_initial_password.py` takes only `<email>` as a positional CLI argument and reads the password via Python's stdlib `getpass.getpass()` (non-echoing stdin prompt). The plaintext is hashed immediately and never logged, stored, or echoed; the script prints only `"Password set for user <email>"` (email stripped of control characters) on success, exit code `0`, or a generic error to stderr with exit code `1` on failure.

**Consequences**:
- Positive: eliminates shell-history and `ps`-based plaintext exposure at zero cost (`getpass` is stdlib, no new dependency).
- Negative: script cannot be scripted/piped non-interactively (e.g. from a secrets-manager pipe) in v1 — acceptable given AC5 explicitly targets a human operator with direct server access. Reversible mechanically — a `--stdin` flag could be added later without breaking the default interactive path.

### ADR-4: `password_hash` + `must_reset_password` columns land now, in AUTH-02, ahead of AUTH-03 · Accepted · 2026-08-17 · impl-planning-agent

**Context**: Per the story's Brownfield findings and Constraints, AUTH-03 formally "owns" the `password_hash` column and the real hash/verify implementation, while AUTH-02 "stubs" the hash-verify interface. But AUTH-02's own AC4/AC5 test cases (`AUTH-02-TC-06..09`) require seeding fixture rows with and without a `password_hash` value and asserting real column state after migration/script runs — which is impossible without the column existing in the schema today, and AUTH-02 is required to be independently testable now (`Independent test: true`), not gated on AUTH-03 landing first.

**Decision**: `backend/app/models/user.py` adds both columns in this story: `password_hash` (`String`, nullable, default `NULL`) and `must_reset_password` (`Boolean`, `nullable=False`, `default=True`). `AuthService._verify_credentials` implements the interface AUTH-03 will later supply using a stdlib-only placeholder (`hashlib.pbkdf2_hmac("sha256", ...)` with a per-hash random salt, stored as `salt$hex_digest`) — not bcrypt/argon2, since introducing AUTH-03's actual hashing library is explicitly out of this story's scope. When AUTH-03 lands, it replaces `_verify_credentials`'s body with the real argon2id/bcrypt scheme against the same two columns; no further schema migration is needed at that point.

**Alternatives considered**:
- Wait for AUTH-03 to land the column first, block AUTH-02 implementation on it: rejected — contradicts the story's `Independent test: true` re-scoping and research's explicit resolution that AUTH-02's validation does not wait on AUTH-03's real implementation.

**Consequences**:
- Positive: AUTH-02 ships and is fully testable today; AUTH-03's own PLAN will find the columns already present and can focus purely on swapping the hashing implementation.
- Negative: the placeholder hash format (`salt$hex_digest`) is not the final production scheme and must be re-hashed or migrated once AUTH-03 lands (existing provisioned rows using the placeholder scheme will need re-provisioning via the AC5 script, or a one-time re-hash pass owned by AUTH-03 — tracked there, not here). Reversible at medium cost — no user-facing data is lost, since AC4-provisioned hashes are already "unusable" placeholders and AC5-set passwords can be re-set by the operator if AUTH-03 changes the format.

### ADR-5: Real JWT signing via `PyJWT` (HS256, `JWT_SECRET_KEY`) replaces the stub token — amendment · Accepted · 2026-08-17 · impl-planning-agent

**Context**: A cross-plan audit during AUTH-08's planning found that no story across the AUTH epic (AUTH-02, AUTH-03, AUTH-04) actually implements JWT signing/verification: AUTH-02's `AuthService.login` returned a stub `LoginResponse {token: str}` with no JWT library and no use of `JWT_SECRET_KEY` (tracked as AUTH-08's accepted risk `R-08-jwt-signing-not-yet-implemented`); AUTH-03 only hashes passwords; AUTH-04 is frontend-only and merely decodes the `exp` claim client-side via `jwt-decode`, never signing or verifying server-side. Since `AuthService.login` (owned by this story) is the only place a token is issued, and `docker-compose.yml`/`backend/.env.example` already document and startup-validate `JWT_SECRET_KEY` (AUTH-08), this story is the correct owner to close the gap by making the login response's `token` field a real, cryptographically signed JWT rather than a placeholder string. `docs/features/AUTH-04/PLAN.md`'s `jwt-decode` expiry check requires only a standard `exp` claim (Unix timestamp) in the payload, and `docs/stories/AUTH-04.md`'s Decision log fixes the access-token TTL at 60 minutes — this amendment's payload must satisfy both without introducing claims AUTH-04 doesn't consume.

**Decision**: Add `PyJWT` (`==2.9.0`) to `backend/requirements.txt` and use it inside `AuthService.login` to encode a real JWT: `jwt.encode({"sub": <user's email>, "exp": <now + 60min, UTC, as a Unix timestamp>}, os.getenv("JWT_SECRET_KEY"), algorithm="HS256")`. `HS256` (symmetric, single shared secret) is used rather than an asymmetric scheme (e.g. `RS256`) because this is a single-backend-service internal admin tool with no separate token-issuing/verifying services — there is nothing for asymmetric keys to buy here. The payload carries exactly two claims: `exp` (required by AUTH-04's `jwt-decode` check and by any future server-side verification) and `sub` (the authenticated user's email — already no more revealing than AUTH-06's `GET /api/auth/me` contract, which returns `{name, email}` to the same authenticated caller). No `role`, no `iat`, and no other claim is added — AUTH-04's client-side check reads only `exp`, and adding unused claims would be scope creep against `.claude/rules/reusability-baseline.md`. If `JWT_SECRET_KEY` is unset or empty at the moment `login` runs (defense in depth — AUTH-08's `on_startup()` fail-fast check should already prevent this), `AuthService.login` catches the resulting error and raises a generic `HTTPException(500, "Could not process login. Please try again later.")` — never a raw stack trace or the underlying `jwt`/`os.environ` exception text, per `.claude/rules/surgical-changes.md` and the project's no-raw-stack-trace convention.

**Alternatives considered**:
- `python-jose`: rejected — bundles a broader cryptography surface (multiple algorithm families, JWE support) than this story needs; `PyJWT` is the minimal, widely-used library for HS256-only encode/decode with no unnecessary transitive crypto-backend complexity.
- `RS256`/asymmetric signing: rejected — there is only one backend service in this deployment that both issues and (eventually) verifies tokens; an asymmetric keypair adds key-management overhead (generation, storage, rotation) with no corresponding benefit at this scale, per README's target-platform note (single-server, internal admin tool).

**Consequences**:
- Positive: closes AUTH-08's carried-forward risk `R-08-jwt-signing-not-yet-implemented` — the JWT is now a real, verifiable, time-bounded credential rather than an opaque placeholder string; AUTH-04's existing client-side `exp`-only decode logic continues to work unmodified, since the response shape (`{token: str}`) is unchanged and the token value is now a syntactically real, three-part JWT string.
- Negative: `PyJWT` is a new runtime dependency to track for supply-chain hygiene (mitigated — no transitive crypto dependency beyond the stdlib on the HS256 path; no CVEs at the pinned version). HS256's single shared secret means any future split into multiple verifying services would require distributing `JWT_SECRET_KEY` to each of them — reversible at medium cost (swapping to RS256 is a contained change inside `AuthService.login`/a future verification module, requiring key regeneration but no data migration, since tokens are not persisted server-side).

## 2. File and Module Plan

| ID    | Action | Path                                          | Reason                                                              |
|-------|--------|------------------------------------------------|----------------------------------------------------------------------|
| F-01  | create | `backend/app/services/auth_service.py`          | New `AuthService`: login, rate limiter, provisioning (ADR-1, ADR-2); `login` now issues a real `PyJWT`-signed HS256 token instead of a stub (ADR-5) |
| F-02  | create | `backend/app/schemas/auth.py`                   | `LoginRequest` / `LoginResponse {token: str}` (FR-1, condition C-6) — response shape unchanged; the `token` value is now a real signed JWT per ADR-5, not a placeholder string |
| F-03  | create | `backend/app/api/auth.py`                       | `POST /api/auth/login` router (FR-1)                                |
| F-04  | create | `backend/app/scripts/__init__.py`               | Makes `app.scripts` a package (FR-5, condition C-10)                |
| F-05  | create | `backend/app/scripts/set_initial_password.py`   | AC5 operator CLI (`python -m app.scripts.set_initial_password <email>`), ADR-3 |
| F-06  | create | `backend/tests/test_auth.py`                    | AC1-3 login TCs, rate-limit TC-10, log-hygiene TC-13, contract TC-11 |
| F-07  | create | `backend/tests/test_provisioning.py`            | AC4 migration TC-06/07, AC5 script TC-08/09                         |
| F-08  | modify | `backend/app/models/user.py`                    | Add `password_hash`, `must_reset_password` columns (ADR-4)          |
| F-09  | modify | `backend/app/main.py`                           | Register `auth.router`; call provisioning migration at startup, ordered after `seed_if_empty` (FR-4) |
| F-10  | create | `backend/tests/perf/conftest.py`                | Live-uvicorn-instance fixture for the sustained-load perf harness (TC-12) |
| F-11  | create | `backend/tests/perf/test_login_perf.py`         | p95 < 400ms @ 50 RPS / 60s sustained-load test for `/api/auth/login` (TC-12) |
| F-12  | modify | `README.md`                                     | Document `POST /api/auth/login`, the `set_initial_password` operator workflow, and a troubleshooting row |
| F-13  | modify | `backend/requirements.txt`                      | Add `PyJWT==2.9.0` runtime dependency (ADR-5) |
| F-14  | modify | `docs/config/project-commands.yaml`             | `preflight:` — append a smoke-import for the new `PyJWT` dependency (config drift C1, ADR-5) |

`F-05` (`set_initial_password.py`) is a CLI entry point invoked directly via `python -m app.scripts.set_initial_password <email>` — it has no in-process consumer/import site to wire; it is its own entry point (leaf, per `plan-validation` wiring exception for CLI/script entries). `F-01`'s (`auth_service.py`) entry-registration site is `F-09` (`main.py`, registers `auth.router` which imports `AuthService`); `F-02`/`F-03` are consumed directly by each other within this same file set (`api/auth.py` imports `schemas/auth.py`). `F-13` (`requirements.txt`) and `F-14` (`project-commands.yaml`) are configuration/manifest files with no in-process import site to register — leaves, per the same wiring exception applied to `F-01`'s dependency manifest in AUTH-03's PLAN.md precedent.

## 3. Module Hierarchy

```
backend/app/
├── services/
│   └── auth_service.py
│       - input:  Session, LoginRequest-shaped (email, password) | email + plaintext (provisioning)
│       - output: LoginResponse {token: <real HS256-signed JWT>} | raises HTTPException(401|429|500) | int (rows provisioned) | None
│       - public: AuthService(db).login(email, password) -> LoginResponse
│                 AuthService(db).provision_existing_users_with_random_password() -> int
│                 AuthService(db).set_user_initial_password(email, plaintext_password) -> None
│       - private: _verify_credentials(user_or_none, plaintext) -> bool   (constant-work stub, ADR-4)
│                  _check_rate_limit(email) -> None                        (raises 429, ADR-2)
│                  _generate_unusable_hash() -> str                        (os.urandom-seeded, never verifies)
│                  _issue_token(email) -> str                              (real `jwt.encode({"sub": email, "exp": <now+60min>}, os.getenv("JWT_SECRET_KEY"), algorithm="HS256")`; raises HTTPException(500, "Could not process login. Please try again later.") if `JWT_SECRET_KEY` is unset/empty, ADR-5)
├── schemas/
│   └── auth.py
│       - input:  n/a (DTOs only)
│       - output: LoginRequest {email: EmailStr, password: str}
│                 LoginResponse {token: str}
│       - public: both classes exported for `api/auth.py` and `tests/test_auth.py`
├── api/
│   └── auth.py
│       - input:  LoginRequest (HTTP body), Session (Depends(get_db))
│       - output: LoginResponse (200) | HTTPException(401|429)
│       - public: router = APIRouter(prefix="/api/auth", tags=["auth"]); POST ""  -> login
└── scripts/
    ├── __init__.py            (empty; package marker)
    └── set_initial_password.py
        - input:  sys.argv[1] (email), interactive getpass() stdin (plaintext password)
        - output: stdout "Password set for user <email>" + exit 0, OR stderr message + exit 1
        - public: main() -> int   (invoked via `if __name__ == "__main__": sys.exit(main())`)
```

## 4. State and Data Management

- **New persistent state**: `users.password_hash` (`String`, nullable, default `NULL`) and `users.must_reset_password` (`Boolean`, `nullable=False`, `default=True`) — added directly to the SQLAlchemy model (no Alembic in this repo; `Base.metadata.create_all` picks up the new columns on the next `users.db` creation, same pattern `docs/research/AUTH-03.md` documents for dev/test). Any row created via the existing `POST /api/users` flow after this change gets `password_hash=NULL, must_reset_password=True` by column default — correctly signalling "needs AC5 provisioning" without any `UserService`/`UserCreate` schema change.
- **Migration lifecycle** (FR-4): `provision_existing_users_with_random_password` runs once at every startup, `WHERE password_hash IS NULL`, setting a random unusable hash + `must_reset_password=True`. Fixed startup order in `main.py`: `Base.metadata.create_all` → `seed_if_empty` → `provision_existing_users_with_random_password`. If the migration raises, startup aborts (no partial credential state runs) — this is the default behavior of an unhandled exception inside the `@app.on_event("startup")` handler; no extra try/except is added to suppress it.
- **Rate-limiter state** (ADR-2): in-process `dict` inside a single `AuthService`-module-level singleton (constructed once, not per-request) so attempt counts persist across requests within a process lifetime; explicitly NOT persisted to `users.db` or any other store. TTL: 3600s rolling per key, pruned lazily on each access — no background eviction thread.
- **No client-side/frontend state** — this story is backend-only (`design = n/a`).
- **JWT signing (ADR-5, amendment)**: `AuthService.login` reads `JWT_SECRET_KEY` from the process environment via `os.getenv` on every login call (not cached, not read at import time) and signs a two-claim payload (`sub`: user's email, `exp`: now + 60 minutes UTC as a Unix timestamp) with HS256. No token is persisted server-side — the JWT is stateless and self-describing; nothing to invalidate server-side within this story's scope (revocation/logout is AUTH-04/AUTH-07's client-side concern, per those stories' own PLANs). `JWT_SECRET_KEY` itself is documented, passed through `docker-compose.yml`, and fail-fast-validated at startup entirely by AUTH-08 (already shipped in that story's PLAN) — this story only consumes the variable, it does not redefine or re-validate its presence at startup.

## 5. Task Breakdown

| #     | Title                                                                 | Complexity | [P] | Predecessors | Files       | Notes                                                                 |
|-------|------------------------------------------------------------------------|------------|-----|---------------|-------------|------------------------------------------------------------------------|
| T-01  | Add `password_hash` + `must_reset_password` columns to `User` model    | S          | [P] | —             | F-08        | ADR-4; defaults per §4                                                 |
| T-02  | Add `LoginRequest`/`LoginResponse` schemas                             | S          | [P] | —             | F-02        | Condition C-6 (AUTH-04 response-shape alignment: `{token: str}` — shape is fixed here; the `token` value itself becomes a real signed JWT via T-12/ADR-5, not a stub) |
| T-03  | Implement `AuthService.login` + rate limiter + `_verify_credentials`   | L          |     | T-01, T-02    | F-01        | ADR-1, ADR-2, ADR-4; conditions C-3, C-4, C-5, C-9; issues a placeholder token string at this stage — superseded by T-12's real JWT signing (ADR-5) |
| T-04  | Extend `AuthService`: provisioning migration + `set_user_initial_password` | M      |     | T-03          | F-01        | FR-4, FR-5; conditions C-1, C-5, C-9                                   |
| T-05  | Add `POST /api/auth/login`; wire `main.py` (router + startup migration order) | M   |     | T-03, T-04    | F-03, F-09  | FR-1, FR-4; condition C-1 (startup ordering)                           |
| T-06  | Add `backend/app/scripts/` package + `set_initial_password.py` CLI     | M          |     | T-04          | F-04, F-05  | ADR-3; conditions C-2, C-9, C-10                                       |
| T-07  | Write `test_auth.py` (AC1-3, rate-limit, log-hygiene, contract boundary) | M        |     | T-05          | F-06        | Covers TC-01..05, TC-10, TC-11, TC-13; condition C-3, C-7 (stub-based) |
| T-08  | Write `test_provisioning.py` (AC4 idempotence, AC5 script)             | M          |     | T-04, T-06    | F-07        | Covers TC-06..09; conditions C-1, C-2, C-9                             |
| T-09  | Add performance harness (`conftest.py` live-server fixture) + p95 sustained-load test | L |     | T-05     | F-10, F-11  | Covers TC-12; condition C-8; runner-setup (see §7)                     |
| T-10  | `docs(readme)`: document login endpoint, `set_initial_password` operator workflow, troubleshooting row | S | | T-05, T-06 | F-12    | Documentation requirements section; condition C-7 (README part)        |
| T-11  | Add `PyJWT==2.9.0` to `backend/requirements.txt`                       | S          | [P] | —             | F-13        | ADR-5; new runtime dependency, disjoint file, no predecessor           |
| T-12  | Replace stub token with real HS256-signed JWT in `AuthService.login` (`_issue_token`) | M |  | T-03, T-11    | F-01        | ADR-5; reads `JWT_SECRET_KEY` via `os.getenv`; payload = `{sub: email, exp: now+60min}`; raises `HTTPException(500, "Could not process login. Please try again later.")` on missing/empty secret (defense in depth — AUTH-08 already validates at startup) |
| T-13  | Unit test: `login` returns a real 3-part JWT with correct `exp`/`sub` claims | S |  | T-12          | F-06        | Extends existing `backend/tests/test_auth.py`; asserts `token.count(".") == 2` and `jwt.decode(token, JWT_SECRET_KEY, algorithms=["HS256"])` yields `exp` ≈ now+60min and `sub` == login email — the same claim `jwt-decode`-style client parsing (AUTH-04) reads |
| T-14  | Unit test: `login` fails gracefully (generic 500, no stack trace) when `JWT_SECRET_KEY` is unset | S | | T-12 | F-06 | Extends existing `backend/tests/test_auth.py`; `monkeypatch.delenv("JWT_SECRET_KEY")`, asserts `HTTPException(500)` with the exact readable message, never the raw `jwt`/`os.environ` exception text |
| T-15  | Config drift: append `PyJWT` smoke-import to `docs/config/project-commands.yaml preflight:` | S |  | T-11          | F-14        | Config drift C1 (new runtime dependency); appends a `python -c "import jwt"` smoke-import after the existing backend install line, mirroring AUTH-03's T-10 precedent for `passlib[bcrypt]` |

`[P]` holds for T-01/T-02/T-11 — each touches a disjoint file (F-08, F-02, F-13 respectively), no predecessors, no shared mutable state with another `[P]` task. All other tasks touch `F-01`/`F-09` or depend on earlier tasks' outputs and run sequentially.

## 6. Carry-Forward Risks and Conditions

Risks from `docs/research/AUTH-02.md` § Risk register. HIGH-severity risk #1 is already marked RESOLVED in research (the provisioning-gap carry-forward that this story itself closes via AC4/AC5) and is not re-listed below.

### Risks addressed by tasks

| Risk id | Severity | Addressed by     |
|---------|----------|-------------------|
| R-02    | HIGH     | T-03, T-07         |
| R-03    | HIGH     | T-03               |
| R-04    | HIGH     | T-04, T-05, T-08   |
| R-05    | HIGH     | T-06, T-08         |

### Risks accepted (carry-forward)

None — all HIGH-severity risks are addressed by tasks above; MED/LOW risks (R-06..R-12) inherit their mitigation from `docs/research/AUTH-02.md` directly and require no PLAN-level task per `plan-authoring`.

### Conditions for GO (research_verdict GO-WITH-CONDITIONS)

| Cond | Condition (verbatim, abbreviated)                                                              | Addressed by       |
|------|--------------------------------------------------------------------------------------------------|----------------------|
| C-1  | AC4 migration idempotence and startup integration (order + `WHERE password_hash IS NULL`)        | T-04, T-05, T-08     |
| C-2  | AC5 script security and password input method (interactive `getpass`, minimal output)            | T-06, T-08           |
| C-3  | Error message consistency audit (single constant, constant-time verify)                          | T-03, T-07           |
| C-4  | Rate-limiter implementation scope (in-process sliding window for v1)                              | T-03                 |
| C-5  | Service/API structure decision (`AuthService` separate from `UserService`)                        | T-03, T-04 (ADR-1)   |
| C-6  | Response model alignment with AUTH-04 (`LoginResponse {token: str}`; token value now a real HS256-signed JWT, ADR-5) | T-02, T-12            |
| C-7  | Test fixtures and schema updates (README docs now; `test_users.py` password-field update deferred to AUTH-03's own PLAN since `UserCreate` is unchanged by this story) | T-07, T-10 |
| C-8  | Latency benchmarks for AC4 and AC5 (p95 login benchmark; AC4/AC5 duration assertions)              | T-07, T-08, T-09     |
| C-9  | Logging strategy for failed attempts and provisioning (opaque keys only, no plaintext)             | T-03, T-06, T-07, T-08 |
| C-10 | Scripts infrastructure and entry point (`backend/app/scripts/` package, `python -m` invocation)    | T-06                 |

**Note on C-7**: this story does not modify `UserCreate`/`UserUpdate` (that remains AUTH-03's scope, per REQUIREMENTS.md Constraints — "AUTH-03 supplies `password_hash`... AUTH-02's own validation stubs that interface"). Since `POST/PUT /api/users` request bodies are unchanged by AUTH-02, `backend/tests/test_users.py` requires no edits in this story; the condition's `test_users.py` clause applies once AUTH-03 actually adds `password: str` to `UserCreate`, and is tracked there. The README documentation clause of C-7 is in scope now and is covered by T-10.

### Cross-Feature Dependency Notes

- **AUTH-03** (password security/hashing, research complete, GO-WITH-CONDITIONS): AUTH-02's `_verify_credentials` stub (T-03) and the placeholder hash format (ADR-4) will be replaced by AUTH-03's real argon2id/bcrypt implementation against the same `password_hash` column added here — no new schema migration expected when AUTH-03 lands, per ADR-4.
- **AUTH-04** (token/session persistence, PLAN written): `LoginResponse {token: str}` (T-02) locks the response shape per condition C-6; as of this amendment (ADR-5, T-11..T-15) the `token` value is a real HS256-signed JWT with `exp`/`sub` claims, not a placeholder string — AUTH-04's existing `jwt-decode`-based, `exp`-only client-side check (per `docs/features/AUTH-04/PLAN.md` ADR-2/F-02) continues to work unmodified, since it only reads the `exp` claim from whatever token string this endpoint returns.
- **AUTH-08** (Docker/deployment env configuration, PLAN written): AUTH-08 already documents, passes through (`docker-compose.yml`), and fail-fast-validates `JWT_SECRET_KEY` at startup, but explicitly does not implement signing (out of its own scope). AUTH-08's `pending_carry_forward` entry `R-08-jwt-signing-not-yet-implemented` is resolved by this amendment: `AuthService.login` (T-12) is now the first and only backend code that actually reads `JWT_SECRET_KEY` to sign a JWT, closing the gap AUTH-08's cross-plan audit identified. This story does not edit AUTH-08's files — the resolution is a factual consequence of ADR-5 landing here.
- **AUTH-01** (login screen UI, downstream): consumes this story's endpoint contract and generic error message; no AUTH-02 task depends on AUTH-01.

### Amendment note — resolves AUTH-08 risk R-08

This amendment (ADR-5; T-11 through T-15) replaces `AuthService.login`'s stub token with a real `PyJWT`-signed HS256 JWT, reading `JWT_SECRET_KEY` via `os.getenv`. This directly resolves the gap tracked in `docs/features/AUTH-08/state.json` `.pending_carry_forward[]` as `R-08-jwt-signing-not-yet-implemented` ("no backend code in AUTH-02/AUTH-03/AUTH-04's written PLANs reads `JWT_SECRET_KEY` to sign or verify a JWT"). No other AUTH-02 file, task, or decision changes as a result of this amendment beyond what is listed in this section and in §1 ADR-5, §2 (F-01/F-02/F-13/F-14), §3, §4, and §5 (T-11..T-15) above.

## 7. Test Strategy

| Layer       | Test path                                   | TCs covered                        | Notes                                                                                   |
|-------------|-----------------------------------------------|-------------------------------------|-------------------------------------------------------------------------------------------|
| Integration | `backend/tests/test_auth.py`                  | AUTH-02-TC-01, TC-02, TC-03, TC-04, TC-05 | AC1-3; FastAPI `TestClient` against isolated in-memory SQLite, same pattern as `test_users.py`; asserts row-count unchanged (TC-01) and response never contains `password_hash`/`must_reset_password` (TC-02) |
| Security    | `backend/tests/test_auth.py`                  | AUTH-02-TC-10, TC-13                | TC-10: 4th attempt within 60min window asserts `429` + `Retry-After`; TC-13: captures `caplog`, asserts no plaintext email/password in any log record |
| Contract    | `backend/tests/test_auth.py`                  | AUTH-02-TC-11                       | `inspect.getmembers` on `AuthService`/`UserService`; asserts `login`/`provision_existing_users_with_random_password`/`set_user_initial_password` exist only on `AuthService`. Runner: existing `pytest` (already configured in `docs/config/project-commands.yaml` `test_unit`) — a structural assertion, not a consumer-driven contract test against an external system, so no new contract-testing tool (e.g. Pact) is installed |
| Integration | `backend/tests/test_provisioning.py`          | AUTH-02-TC-06, TC-07, TC-08          | AC4: fixture rows with/without `password_hash`, asserts only null rows change and re-run is a no-op; AC5: calls `AuthService.set_user_initial_password` directly, asserts hash change + `must_reset_password=False` + verifiable via `_verify_credentials` |
| Security    | `backend/tests/test_provisioning.py`          | AUTH-02-TC-09                       | Captures stdout/stderr/logs around a `set_initial_password.main()` invocation (password piped via monkeypatched `getpass.getpass`); asserts plaintext never appears in any captured stream |
| Performance | `backend/tests/perf/test_login_perf.py` (+ `conftest.py` fixture) | AUTH-02-TC-12 | Runner: custom lightweight harness — `conftest.py`'s `live_server` fixture boots `uvicorn.Server` in a background thread on an ephemeral port against the isolated test DB; `test_login_perf.py` drives sustained load via `httpx.AsyncClient` + `asyncio.gather`, computes p95, asserts < 400ms. **Author-time smoke** (per `plan-authoring` § Test strategy): the harness itself is exercised at normal `pytest` collection time with a 3-request/2-second reduced-load smoke variant (`test_login_perf_smoke`) that always runs in `pytest`; the full 50 RPS/60s run is gated behind a `perf` marker (`pytest -m perf`) and is **not** part of the default `pytest` invocation in `docs/config/project-commands.yaml`, matching the story NFR ("Performance test runs only on PRs marked `perf` label; not gating CI for every PR") |
| Manual      | Swagger UI (`/docs`) manual inspection        | (per story Manual test mapping)     | Byte-for-byte response diff for invalid-email vs wrong-password is spot-checked manually until an automated diff assertion is added beyond TC-04's equality check; manually confirm `set_initial_password` is not reachable via any route in `/docs`'s route table |
| Unit        | `backend/tests/test_auth.py`                  | ADR-5 (amendment, T-13)             | Decodes the token returned by a successful `login` call with `jwt.decode(token, JWT_SECRET_KEY, algorithms=["HS256"])`; asserts a 3-part JWT string, `exp` ≈ now + 60 minutes (within a small tolerance window), and `sub` equals the login email |
| Unit        | `backend/tests/test_auth.py`                  | ADR-5 (amendment, T-14)             | `monkeypatch.delenv("JWT_SECRET_KEY")` before calling `login` with valid credentials; asserts `HTTPException(500)` with the exact generic message, and asserts no raw `jwt`/`os.environ` exception text or stack trace appears in the response body or `caplog` |

Coverage gate: unit/integration coverage for `backend/` follows the repo's existing threshold (no `harness.yaml` override present → 80% default). E2E: not applicable — `docs/config/project-commands.yaml` declares `test_e2e: (n/a)` repo-wide, and this story's own Test mapping confirms no e2e suite is used, per `docs/stories/AUTH-02.md` § Test mapping.

## Plan validation

- Date: 2026-08-17T16:00:00Z
- Verdict: PASS
- Wiring: PASS (F-01/F-02/F-03's entry-registration site F-09 `main.py` is listed as `modify`; F-05 `set_initial_password.py` is a `python -m` CLI leaf entry with no import-site to wire, per the wiring exception for leaf/entry scripts)
- Docs: PASS (T2 fires — new `POST /api/auth/login` route — addressed by T-10 updating root `README.md` §10 API table, plus the operator-workflow subsection and §14 troubleshooting row per REQUIREMENTS.md § Documentation requirements. T1/T3/T4 do not fire: no new top-level runnable surface, no new env var, no new service/port introduced)
- Runner-setup: PASS (TC-12 is `performance`-typed — addressed by T-09, which adds the `conftest.py` live-server fixture and `test_login_perf.py` invocation script, sequenced after T-05 which produces the endpoint under test. TC-11 is `contract`-typed but requires no new runner — it is a structural `inspect`-based assertion executed by the project's existing, already-configured `pytest` runner (`docs/config/project-commands.yaml` `test_unit`); no e2e TCs exist per repo-wide `test_e2e: n/a`)
- Cross-section: PASS (every `F-NN` file is referenced by at least one task's Files column; every task's Files column references only `F-NN` ids present in §2; every TC type declared in `docs/test-cases/AUTH-02.json` — integration, security, contract, performance — has a matching row in §7 Test Strategy backed by a §5 task)
- Config drift: PASS (no new runtime dependency added — `_verify_credentials`, the rate limiter, and the performance harness use only the stdlib (`hashlib`, `getpass`, `asyncio`) plus already-declared `httpx`/`uvicorn`/`pytest`; no new service or port introduced — `docs/config/project-commands.yaml` `preflight:` and `docs/config/stack-smoke.md` require no edits)
- Rounds: 1

### Amendment validation (ADR-5 — real JWT signing)

- Date: 2026-08-17T23:45:00Z
- Verdict: PASS
- Wiring: PASS (F-01, F-02, F-13, F-14 are all `modify`/`create` against already-wired or leaf files — F-01's entry-registration site remains F-09 `main.py` as before; F-13 `requirements.txt` and F-14 `project-commands.yaml` are configuration manifests with no import-site to register, per the wiring test/config-file leaf exception already applied elsewhere in this PLAN and in AUTH-03/AUTH-04's PLANs for their own dependency-manifest edits)
- Docs: PASS (no new doc trigger fires — T1/T2/T3/T4 do not fire: no new runnable surface, no new HTTP route (the existing `POST /api/auth/login` route and its documented response shape `{token: str}` are unchanged by this amendment), no new env var (`JWT_SECRET_KEY` was already documented and startup-validated by AUTH-08), no new service/port. No additional README task is required)
- Runner-setup: PASS (the two new unit tests (T-13, T-14) execute under the already-configured `pytest` runner inside the existing `backend/tests/test_auth.py` file; no new test type — e2e/performance/contract — is introduced by this amendment)
- Cross-section: PASS (F-13 is referenced by T-11's Files column, F-14 by T-15's Files column; T-12/T-13/T-14 reference F-01/F-06, both already present in §2; the two new §7 Test Strategy rows are backed by T-13/T-14 respectively)
- Config drift: PASS (C1 fires — new runtime dependency `PyJWT==2.9.0` added via F-13 — addressed by T-15, which appends a smoke-import to `docs/config/project-commands.yaml preflight:`, mirroring AUTH-03's T-10/AUTH-04's T-07 precedent for their own new runtime dependencies; C2/C3 do not fire — no new service, port, or host is introduced)
- Rounds: 1
