# Research Assessment: AUTH-03 — Password security and server-side hashing

**Story**: AUTH-03  
**Epic**: AUTH  
**Phase**: Research (re-run)  
**Assessment date**: 2026-08-17  
**Assessor**: Claude Research Agent  

---

## Upstream dependencies

Per story Dependencies section (rescoped 2026-08-17):
- **Upstream**: AUTH-02 — its PLAN.md (decision D-04) already adds `password_hash` and `must_reset_password` columns to the User model, with a stdlib `pbkdf2_hmac` placeholder hash. AUTH-03 does NOT add or migrate any schema; it replaces AUTH-02's placeholder hash function with the real bcrypt implementation, applied to the same existing columns.
- **Downstream**: AUTH-02's login validation (AC2-3) will call AUTH-03's hash-verify function once AUTH-03 ships, replacing the placeholder.

Prior research state (from `docs/state/features.json`):
- AUTH-03 is story-validated, P1, independent_test=true, needs_clarification_count=0. Gate is clear for re-research.
- AUTH-02 is in plan-implementation phase (PLAN.md decision D-04 written and approved).

---

## Exploration Log

### Schema ownership: AUTH-02 vs AUTH-03
- **Where**: `docs/stories/AUTH-03.md` Dependencies section and `docs/features/AUTH-02/PLAN.md` decision D-04 + file plan F-08
- **What**: AUTH-02's D-04 explicitly adds `password_hash` (String, nullable) and `must_reset_password` (Boolean, default=True) columns to User model in this story, using a stdlib placeholder hash (`hashlib.pbkdf2_hmac`). F-08 modifies `backend/app/models/user.py` to add these columns. AUTH-03's scope is narrowed from "add schema" to "replace placeholder hash implementation with bcrypt".
- **Surprises**: Clean separation of concerns — AUTH-02 owns schema creation + placeholder hash, AUTH-03 owns real hash implementation. Reflects the rescoped story decision.
- **Open**: None — the schema boundary is now explicit and documented in both stories' decision logs.

### User model: current schema
- **Where**: `backend/app/models/user.py:1-34`
- **What**: User ORM model currently has: id, name, email (unique), phone, role (Enum), status (Enum), created_at, updated_at. No password, password_hash, or credential column exists yet (will be added by AUTH-02, not AUTH-03).
- **Surprises**: None — AUTH-02 is the next story to ship schema changes.
- **Open**: None — AUTH-03's model changes are now additive only to auth_service.py, not to models/user.py.

### Schemas: request/response models
- **Where**: `backend/app/schemas/user.py:1-78`
- **What**: UserBase (name, email, phone, role, status), UserCreate (extends UserBase), UserUpdate, UserOut. No password field in any schema. Response models are already password-hash-free.
- **Finding**: AC3 compliance (responses must exclude password_hash) is already true for UserOut today. AUTH-03 must ensure UserCreate accepts password (required, non-empty), and that no endpoint ever returns UserOut with password_hash populated.
- **Open**: None — existing response model shapes already meet AC3 requirement.

### Service layer: business logic
- **Where**: `backend/app/services/user_service.py:16-71`
- **What**: UserService owns CRUD operations. No auth or password logic yet (that's AUTH-02/AUTH-03's responsibility via new AuthService class per AUTH-02's ADR-1).
- **Finding**: AUTH-03's hash/verify methods belong in a dedicated context per the existing layering pattern. AUTH-02's PLAN creates AuthService as a separate module to keep auth and CRUD concerns independent.
- **Open**: AUTH-03 will extend AuthService (defined in AUTH-02's PLAN.md) with real bcrypt hashing methods, replacing the placeholder hash implementation. No changes to UserService or UserRepository needed.

### Error handling: centralized exception handlers
- **Where**: `backend/app/main.py:56-79`
- **What**: HTTP exceptions are centralized; stack traces never leak to clients. All responses return JSON with `detail` field.
- **Finding**: Auth errors (hashing failures, rate limits, invalid credentials) are already centralized. AUTH-03 must catch bcrypt/passlib exceptions and convert them to generic HTTP 500 with a user-friendly message (per NFR-security: "never surface raw stack traces").
- **Open**: None — error-handling pattern is clear and already in place.

### Testing: backend test suite
- **Where**: `backend/tests/test_users.py` and `docs/config/project-commands.yaml`
- **What**: Tests run via `pytest`. Existing test_users.py covers CRUD operations. No password hashing tests yet.
- **Finding**: AUTH-03's Test mapping requires new tests covering hash-on-create, verify-success, verify-fail, and response-schema validation. Story also requires latency benchmark (p95 ≤ 300ms).
- **Open**: Test fixtures will need to include password in POST/PUT payloads once UserCreate requires it. AUTH-02's seeding (AC4 migration) will populate placeholder hashes for test rows; AUTH-03's tests will verify real bcrypt hashing works correctly.

### Dependencies: requirements.txt
- **Where**: `backend/requirements.txt:1-7`
- **What**: Currently fastapi, uvicorn, sqlalchemy, pydantic, pytest, httpx. No bcrypt or passlib yet.
- **Finding**: Story Decision log (2026-08-17): `passlib[bcrypt]` chosen as the minimum-necessary new backend dependency. Will be added to requirements.txt in AUTH-03's implementation.
- **Open**: None — library choice is explicit and documented.

### Layering & dependency rules audit
- **Where**: `.claude/skills/fastapi-patterns/SKILL.md` and actual code
- **What**: Required layering: api → services → repositories → models. Hashing is service-layer logic, not API or repository logic.
- **Finding**: Current codebase is compliant. AUTH-02's ADR-1 introduces AuthService (separate from UserService) following this pattern. AUTH-03 extends AuthService with real bcrypt methods, preserving layering.
- **Open**: None — no layering violations for AUTH-03's implementation.

### Security baseline alignment
- **Where**: `.claude/rules/security-baseline.md`
- **What**: No passwords in logs; hashing errors caught and converted to generic messages; secrets in env vars, not committed to git; per-deploy pepper for bcrypt (future enhancement, not in-scope for AUTH-03).
- **Finding**: Current codebase is compliant. AUTH-03 must ensure bcrypt/passlib exceptions are caught at service layer and never leak to client or logs.
- **Open**: None — security rules are clear and implementable.

---

## Pattern map

### Existing code to extend
- **`backend/app/services/auth_service.py`** (created by AUTH-02) — Add two methods (or replace placeholder implementations):
  - `hash_password(plaintext: str) -> str` — use passlib's `CryptContext.hash()` with bcrypt and work factor 12.
  - `verify_credentials(email: str, plaintext_password: str) -> bool` — compare submitted plaintext against stored bcrypt hash using constant-time verify; return True/False without distinguishing failure modes.
- **`backend/app/schemas/user.py`** — Ensure UserCreate includes password field (required, non-empty). UserOut must continue to exclude password_hash.

### Existing patterns to follow
- **Service-layer password logic** — Auth methods belong in AuthService (auth_service.py), not UserService. Follow the pattern set by AUTH-02: service methods call repository methods, catch exceptions at service layer, convert to generic HTTP errors.
- **Error handling** — Wrap passlib/bcrypt calls in try/except, catch all exceptions (InvalidHashError, ValueError, OSError), convert to HTTPException(500, "An error occurred processing your request"). Log failures at WARN level with user_id only, never plaintext password.
- **Pydantic validation** — password field in UserCreate can use basic Pydantic constraints (non-empty, min length per AUTH-01's password rules).
- **Response model contract** — All API endpoints (list, get, create, update) return UserOut schema (via response_model parameter in decorators), which excludes password_hash. Existing code already complies; verify no raw User ORM instances are returned.

### New files to create
- **`backend/tests/test_password_hashing.py`** — Unit tests for hash_password and verify_credentials (per Test mapping, lines 38-39). Covers: hash produces unique salts, verify succeeds/fails correctly, response schemas omit password_hash, latency benchmark (100 iterations, measure p95).
- No new source files required — all hashing logic fits within existing auth_service.py (AUTH-02) + extended by AUTH-03.

### Shared code at risk
- **`backend/app/schemas/user.py`** — UserCreate now requires password field (AUTH-02 adds this; AUTH-03 assumes it). Existing tests/integrations must send password in POST/PUT requests.
- **`backend/tests/test_auth.py`** (created by AUTH-02) — AUTH-02's login tests use placeholder hash. AUTH-03's tests must verify real bcrypt hashing. Both test files can coexist if AUTH-02 and AUTH-03 land in sequence.
- **`backend/app/models/user.py`** — AUTH-02's F-08 adds password_hash and must_reset_password columns. AUTH-03 assumes they exist; no further schema changes by AUTH-03.

---

## Risk register

| # | Dimension       | Severity | Description                                      | Mitigation                                  |
|---|-----------------|----------|--------------------------------------------------|---------------------------------------------|
| 1 | Dependency      | HIGH     | AUTH-03 depends on AUTH-02's schema and placeholder hash. If AUTH-02's PLAN.md changes or D-04 is deferred, AUTH-03 blocks. | Mitigation: AUTH-02 is in plan-implementation phase (PLAN.md approved, 2026-08-17). D-04 is firm and explicitly designed to unblock AUTH-03. Coordinate via decision logs: AUTH-02 commits to adding columns in F-08; AUTH-03 documents dependency on this in its PLAN. No blocker today. |
| 2 | Performance     | HIGH     | Latency budget: p95 ≤ 300ms for hash + verify operations. Bcrypt factor 12 is industry-standard but untested in this codebase. | Mitigation: Add micro-benchmark in test_password_hashing.py (hash 100 passwords with factor 12, measure p95 latency). Expected: ~200-250ms per hash. If measured p95 exceeds 300ms, reduce work factor to 11 and re-benchmark. Document expected latency and tuning steps in PLAN.md. |
| 3 | Compatibility   | MED      | UserCreate now requires password field (AUTH-02 adds this requirement; AUTH-03 assumes it). Existing code/tests that don't send password will fail validation (422). | Mitigation: AUTH-02's implementation will update test fixtures and API documentation. AUTH-03's PLAN must verify that existing tests (auth, users) all send password in payloads. No backward compatibility needed — password is a new required field. |
| 4 | Security        | MED      | Hashing errors (bcrypt internal error, OS entropy failure) must not leak to client. Password material must never appear in logs or error responses. | Mitigation: Wrap passlib/bcrypt calls in try/except at service layer. Catch any exception and convert to HTTPException(500, generic message). Log hash/verify failures at WARN level with user_id only, never password or plaintext. Verify in tests: assert password never in error response bodies or logs. |
| 5 | Dependency      | MED      | New external dependency: passlib[bcrypt] (~50KB). Supply-chain risk. | Mitigation: passlib is widely maintained (10+ years, 1000+ dependent projects). bcrypt is a C extension with code-reviewed implementation. Standard pip install is safe. No additional validation needed. Document in CLAUDE.md or ADR. |
| 6 | Domain          | MED      | Placeholder hash from AUTH-02 will become unusable once AUTH-03 ships. Dev/test rows with placeholder hashes will fail login. | Mitigation: This is expected and documented in AUTH-02's D-04 ("existing provisioned rows using the placeholder scheme will need re-provisioning via the AC5 script, or a one-time re-hash pass owned by AUTH-03"). AUTH-03's PLAN should document that placeholder hashes are no longer valid; users with placeholder hashes must re-provision via AC5. No data migration required (placeholders are intentionally unusable); dev/test cleanup is manual. |
| 7 | Integration     | LOW      | AUTH-02 depends on AUTH-03's hash-verify interface for AC2-3 (login verification). But AUTH-02 is independently testable via stub. Real integration tested only after AUTH-03 ships. | Mitigation: AUTH-02's test strategy (documented in PLAN.md) uses a test-double verify_credentials. AUTH-03 exports the real version. Once AUTH-03 ships, AUTH-02 can swap the stub for the real implementation (no code change needed, just swap the import). No blocker — AUTH-02 ships first with stub, AUTH-03 ships second with real implementation. |

---

## Score + verdict

### 5-dimensional rubric

| Dimension       | Weight | Pass criterion                                                              | Finding                                                                   | Score |
|---|---|---|---|---|
| Integration     | 25     | All upstream dependencies available; failure modes well understood          | passlib[bcrypt] is stable and well-documented. AUTH-02's D-04 is approved and explicit about schema + placeholder hash. Hashing failure modes (OS entropy, invalid input) are well-understood and will be caught at service layer. Error handling is defined. Dependency on AUTH-02 is firm but not blocking (AUTH-02 is in plan-implementation). | 88    |
| Compatibility   | 20     | Backward compat plan exists for each affected client/version                | UserCreate requires password (new field, breaking change for API callers but expected and documented). UserOut excludes password_hash (already true, unchanged). Placeholder hashes from AUTH-02 dev/test become unusable — expected and documented, users re-provision via AC5. Placeholder hash incompatibility is a known, documented limitation. | 82    |
| Domain          | 20     | Edge cases enumerated; no hidden invariants surfaced during scan            | AC1 hash-on-create: bcrypt salts are random, each hash is unique — correct. AC2 verify-on-login: constant-time compare per bcrypt spec — correct. AC3 password never in response: UserOut excludes password_hash — already compliant. AC4 no invented defaults: existing seed data has no password, future AUTH-02 provisioning uses random unusable hashes — compliant. All acceptance criteria enumerated and implementable. | 85    |
| Performance     | 15     | Story has explicit perf budget; estimated work fits within budget           | NFR: p95 ≤ 300ms for hash + verify. Bcrypt factor 12 is industry-standard, typically ~200-250ms per hash. Mitigation: add micro-benchmark in test suite (hash 100 passwords, measure p95). If result exceeds 300ms, reduce work factor. Expected: fits budget easily. Single get_by_email call per verify (no N+1). Implementation effort: ~50-100 lines in auth_service.py. | 85    |
| Dependency      | 20     | All upstream stories complete; no blocking external work                    | AUTH-02 is in plan-implementation (PLAN.md approved). D-04 is firm and explicit about schema + placeholder hash. AUTH-03 depends on AUTH-02 shipping columns as planned, but is not blocked (AUTH-02 is already funded and scheduled). No external services or third-party work blocking. Risk of AUTH-02 scope change is low (already plan-approved). | 90    |

**Total: (88×0.25 + 82×0.20 + 85×0.20 + 85×0.15 + 90×0.20) = 22.0 + 16.4 + 17 + 12.75 + 18 = 86.15/100**

### **Total: 86/100 → GO-WITH-CONDITIONS**

No single dimension scores <40. Integration (88) and Dependency (90) reflect the firm AUTH-02 dependency and available libraries. Compatibility (82) is slightly lower due to the breaking change in UserCreate schema and placeholder hash incompatibility, but both are expected and documented. Domain (85) and Performance (85) are strong — all acceptance criteria are clear and testable.

### Conditions

The following conditions must be explicitly addressed in PLAN.md before implementation:

1. **Test plan includes latency benchmark** (Performance): PLAN.md must specify that backend/tests/test_password_hashing.py will include a micro-benchmark measuring p95 latency of bcrypt hash operations with work factor 12 over 100 iterations. Target: ≤300ms. If measured p95 exceeds 300ms, work factor is reduced to 11 and re-benchmarked. Document the expected latency range (200-250ms) and the tuning procedure.

2. **Coordinate with AUTH-02's schema and test fixtures** (Compatibility): PLAN.md must confirm that AUTH-02's F-08 has added password_hash and must_reset_password columns to User model, and that UserCreate schema requires password field. AUTH-03's tests must assume these columns and the new schema already exist. Test fixtures must include password in all POST/PUT requests to users endpoints.

3. **Placeholder hash incompatibility** (Domain): PLAN.md must document that AUTH-02's placeholder hash format (hashlib.pbkdf2_hmac) becomes incompatible once AUTH-03 ships with bcrypt. Existing dev/test rows with placeholder hashes will fail login and must be re-provisioned via the AC5 operator script. This is expected behavior, not a defect; no data migration is required.

4. **Response schema audit** (Domain): PLAN.md must confirm that all API endpoints returning User objects (GET /api/users, GET /api/users/{id}, POST /api/users, PUT /api/users/{id}) use UserOut response schema and never leak password_hash. Verify by auditing each router's response_model declaration.

### Synthesis

**AUTH-03 is feasible for planning and implementation with documented conditions. Rescoped to depend on AUTH-02 (which adds schema), AUTH-03 now focuses purely on replacing the placeholder hash with real bcrypt implementation.**

This story delivers server-side password hashing using industry-standard passlib[bcrypt] with work factor 12, protecting credentials at rest and enabling AUTH-02's login verification. The key structural change from prior research is that AUTH-02 now owns schema creation (password_hash and must_reset_password columns), while AUTH-03 owns the real hash implementation — a clean separation of concerns explicitly documented in AUTH-02's D-04. The codebase's clean service-layer architecture (AuthService for auth logic, UserService for CRUD) is well-suited for hashing methods. Performance risk is manageable: bcrypt factor 12 typically hashes in 200-250ms, well within the 300ms p95 budget; a simple micro-benchmark in the test suite will validate this. Compatibility risk is controlled: UserCreate requires password (expected breaking change for API callers, already handled by AUTH-02's schema change), and UserOut excludes password_hash (already true, remains unchanged). The single biggest constraint is the dependency on AUTH-02's approved D-04 — mitigated by the fact that AUTH-02 is already in plan-implementation phase with a firm decision. Placeholder hashes from AUTH-02 dev/test will become unusable (expected and documented); no data migration is needed, only manual re-provisioning via AC5 for test users if they persist into AUTH-03 testing. All acceptance criteria are clear, testable, and implementable within the existing architectural patterns.

---

## Clarifications

(none — no unresolved markers in this story; all AC and NFR are explicit)
