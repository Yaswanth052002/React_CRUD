# Story: AUTH-03 — Password security and server-side hashing

**Epic**: AUTH
**Status**: Validated
**Priority**: P1
**Independent test**: true
**Owner**: Backend lead
**Updated**: 2026-08-17

**Source**: intake:raw-input (RTM: docs/requirements/RTM.md#AUTH-03)

## User story

As an Admin managing user accounts and as any authenticated user of the dashboard, I want passwords to be hashed server-side and never stored, transmitted, or displayed as plaintext, so that credentials remain secure even if the database or API responses are exposed.

## Acceptance criteria

1. Given a new user record is created with a password, when the service layer persists the record, then the `users` table's `password_hash` column (schema added by AUTH-02, not this story — see Dependencies) stores only a salted hash of the password (never the plaintext value), generated using the approved hashing library in the service layer (not the API router or repository layer), replacing the stdlib placeholder hash AUTH-02 uses until this story ships.
2. Given a login attempt (AUTH-02) submits a plaintext password over the login endpoint, when the service layer verifies credentials, then it compares the submitted plaintext against the stored hash using the library's constant-time verify function and never re-derives or logs the plaintext password.
3. Given any API response that includes a user object (including `GET /api/users`, `GET /api/users/{id}`, `POST /api/users`, `PUT /api/users/{id}`, and the current-user/me endpoint introduced by AUTH-04), when the response is serialized, then the `password`/`password_hash` field is excluded entirely from the response schema — not masked, not null-filled, simply absent.
4. Given a user is created without the client supplying a password (e.g. an existing seed/import path), when the service layer processes the request, then it MUST reject the request or require an explicit password rather than inventing a default password.

## Non-functional requirements

- Performance: Password hashing adds ≤ 300ms to the p95 latency of the create-user and login endpoints under normal load (single request, no concurrent contention); this bounds the bcrypt work factor chosen below.
- Security: Use bcrypt (via `passlib[bcrypt]` or `bcrypt` package) with a work/cost factor of 12 — an industry-standard default balancing brute-force resistance against the ≤300ms budget above. Plaintext passwords must never appear in logs, error messages, or stack traces (aligns with the project convention of never surfacing raw stack traces).
- Accessibility: N/A (no new UI surface — this story is backend-only; password *input* UX is covered by AUTH-01).
- Observability: Log hash/verify failures (e.g. bcrypt errors) at WARN level with user id only, never with password material; a hashing-library exception must be caught in the service layer and surfaced to the API layer as a generic readable error, not a raw exception.

## Dependencies

- Upstream: AUTH-02 — its PLAN.md (decision D-04) already adds the `password_hash` and `must_reset_password` columns to the `users` table, using a stdlib `pbkdf2_hmac` placeholder hash so AUTH-02 can be independently planned/tested without waiting on this story. AUTH-03 does NOT add or migrate any schema; it replaces AUTH-02's placeholder hash function with the real bcrypt implementation, applied to the same existing columns.
- Downstream: AUTH-02 (login validation calls this story's hash-verify function, replacing the placeholder); any future credential-provisioning or password-reset step.

## Test mapping

- E2E: NA — no independent frontend flow; covered indirectly by AUTH-01/AUTH-02 E2E flows.
- Unit: `backend/tests/test_users.py` (extend) and a new `backend/tests/test_password_hashing.py` covering: hash-on-create persists a bcrypt hash distinct from plaintext, verify succeeds for correct password and fails for incorrect password, and every `UserResponse`/`UserOut`-style schema serialization omits the password/hash field.
- Manual: Inspect `users.db` directly after creating a user via the API to confirm no plaintext password column value exists.

## Clarifications

## Decision log

- 2026-08-17 Hashing library: `passlib[bcrypt]` (or `bcrypt` directly), added as the minimum-necessary new backend dependency — chosen over alternatives (argon2, scrypt) because it is the most widely adopted, zero-config choice for this stack and satisfies the "minimum-necessary new dependency" constraint (per intake instruction).
- 2026-08-17 Work factor: bcrypt cost factor 12, chosen as the current industry-standard default that keeps hashing time within the ≤300ms p95 budget (per requirement-planner best judgment; revisit if load testing shows otherwise).
- 2026-08-17 Owner: resolved to Backend lead, consistent with AUTH-04's owner resolution — this is backend-only hashing/verification logic; resolved during story validation round 2.
- 2026-08-17 post-plan-implementation scope decision (round 3): AUTH-02's PLAN.md (decision D-04) added the `password_hash`/`must_reset_password` columns and a stdlib placeholder hash ahead of AUTH-03, so AUTH-02 could be independently planned/tested. AUTH-03's Dependencies were rescoped from "Upstream: none" to "Upstream: AUTH-02" and AC1 reworded to make clear AUTH-03 replaces AUTH-02's placeholder hash function rather than adding schema — explicit product direction, avoiding both stories claiming ownership of the same column addition. Status reverted to `Draft` pending re-validation.

## Validation log

- 2026-08-17T11:36:00Z v1 total=95 Clarity-Unresolved=0 (FAIL)
- 2026-08-17T12:00:00Z v2 total=100 PASS
- 2026-08-17T18:00:00Z v3 total=100 PASS (post-plan-implementation rescoping: Upstream=AUTH-02)
