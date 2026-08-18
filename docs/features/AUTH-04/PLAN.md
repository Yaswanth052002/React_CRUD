# PLAN: AUTH-04 — Authentication state management and persistence across page refresh

- Status: Accepted
- Story: AUTH-04
- Research verdict: GO-WITH-CONDITIONS (87/100)

## 1. Architecture Decisions

### ADR-1: Axios interceptor pair + plain-boolean auth state (ratifies story/research decision) · Accepted · 2026-08-17 · Backend lead

**Context**: `App.jsx` has no auth concept and no router; `userApi.js` is the sole HTTP layer per project convention. The story's Decision log already locks the mechanism (JWT bearer token in `localStorage`, axios interceptor, 60-minute TTL) and research condition C-9 locks `isAuthenticated` as a plain `useState` boolean (never `null`/loading) with a separate `sessionExpiredMessage` string state. This ADR ratifies those decisions as the PLAN's implementation contract rather than re-litigating them, so the file/task plan below has a single unambiguous shape to build against.

**Decision**: Add a request/response interceptor pair to the shared axios `client` in `userApi.js`: the request interceptor reads `getStoredToken()` on every call and attaches `Authorization: Bearer <token>` only when present; the response interceptor's `401` branch calls `clearAuthToken()` then invokes the registered unauthorized handler exactly once, guarded by checking `getStoredToken()` is still non-null at the moment of the 401 (prevents double-invocation from two in-flight requests both 401-ing after the first already cleared the token). `App.jsx` holds `isAuthenticated` (`useState(() => Boolean(userApi.getStoredToken()))`, plain boolean) and `sessionExpiredMessage` (`useState(null)`, `string | null`), both set synchronously before first render of any protected view.

**Consequences**:
- Positive: single source of truth for the token lives in `userApi.js` (the only file allowed to touch `localStorage` for auth), matching the existing single-HTTP-layer convention; the dedup guard eliminates the HIGH-severity 401-loop risk (research risk #1) without any cross-component event bus.
- Negative: `App.jsx` and `userApi.js` are coupled via the `registerUnauthorizedHandler` callback registration, which must run on `App.jsx` mount before any other component issues a protected call — ordering is enforced by task sequencing (T-02 before T-03), not by the type system. Reversible mechanically — the interceptor pair and the two `useState` calls are additive; removing them reverts to the current unconditional-render behavior with no data migration.

### ADR-2: `jwt-decode` library for client-side expiry check (per condition C-8) · Accepted · 2026-08-17 · Backend lead

**Context**: The client must extract a JWT's `exp` claim to decide `isAuthenticated` on mount without a network round-trip, and must never throw on a malformed token. Two options exist: add the `jwt-decode` npm package, or hand-roll a ~20-line base64url-decode-and-JSON.parse helper.

**Decision**: Add `jwt-decode` (`^4.x`, ~2KB, zero runtime dependencies) to `frontend/package.json`. The expiry check imports `jwtDecode` from it, wraps the call in `try/catch`, and treats a thrown decode as "no token" per FR-1.

**Alternatives considered**:
- Manual base64url decode + `JSON.parse`: rejected — reinventing a well-tested, widely-used (10M+ weekly downloads), maintained micro-library adds maintenance surface (base64url padding edge cases, unicode payload handling) for zero benefit over a 2KB dependency with no transitive deps.

**Consequences**:
- Positive: expiry extraction is tested upstream by the library maintainers; the malformed-token fallback is a single `try/catch`, not custom parsing logic that could itself throw in an unhandled way.
- Negative: one new npm dependency to track for supply-chain hygiene (mitigated — no critical CVEs, no transitive deps, per research risk #8). Reversible mechanically — swapping to manual parsing is a same-file, same-signature change confined to the expiry-check call site.

### ADR-3: AUTH-04 is the authoritative implementer of `userApi.js`'s auth-token surface, superseding AUTH-01 PLAN.md's F-06 forward-reference · Accepted · 2026-08-17 · Backend lead

**Context**: `docs/features/AUTH-01/PLAN.md` § 2 already has an F-06 row (`modify frontend/src/services/userApi.js` — "Add `setAuthToken(token)` export") because AUTH-01's `LoginScreen` needs to call `setAuthToken` before `onLoginSuccess`, per the locked cross-story call-sequence contract. AUTH-01's F-06, however, only adds a single in-memory `client.defaults.headers.common.Authorization` setter — it explicitly does not add `localStorage` persistence, `getStoredToken`, `clearAuthToken`, `registerUnauthorizedHandler`, or the interceptor pair (AUTH-01's own § 4 states "persistence across reloads is AUTH-04's scope"). AUTH-04's REQUIREMENTS.md FR-2 defines the full, `localStorage`-backed auth-token API surface with a different `setAuthToken` implementation (writes to `localStorage`, not `client.defaults.headers`). As of this PLAN's authoring, `docs/features/AUTH-01/state.json` has no `impl` field — AUTH-01 has not been implemented yet — so there is no risk of AUTH-04 "overwriting" already-shipped AUTH-01 code; but the plan must still make explicit which story owns the final shape of `setAuthToken`, regardless of implementation order.

**Decision**: AUTH-04 owns and ships the FULL, authoritative `userApi.js` auth-token surface: `getStoredToken()`, `setAuthToken(token)` (localStorage-backed, per FR-2 — NOT the in-memory-header variant AUTH-01's PLAN describes), `clearAuthToken()`, `registerUnauthorizedHandler(callback)`, plus the request/response interceptor pair. If AUTH-01 implements its F-06 first (adding the in-memory-only `setAuthToken`), AUTH-04's T-02 (below) replaces that implementation with the `localStorage`-backed version specified by FR-2 — this is an intentional supersession, not a conflicting duplicate, and is called out explicitly here so `/arh-implement` does not treat AUTH-04's `userApi.js` edit as touching a file "outside its scope" per `surgical-changes`. If AUTH-04 implements first, AUTH-01's later `LoginScreen` work calls the already-`localStorage`-backed `setAuthToken` with no change needed to AUTH-01's PLAN.

**Consequences**:
- Positive: exactly one story (AUTH-04) is the source of truth for the final `setAuthToken` signature and persistence mechanism, eliminating ambiguity about which PLAN's file-table row "wins" regardless of merge order.
- Negative: whichever story lands second must diff against the other's already-merged `userApi.js` changes rather than starting from the pre-both-stories baseline — mitigated because both changes are purely additive/superseding at the same named export, not structurally conflicting (no other export in either PLAN touches the same lines). Reversible mechanically — a single-function replacement, not a schema or data migration.

## 2. File and Module Plan

| ID   | Action | Path                                                          | Reason                                                                                                    |
|------|--------|----------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------|
| F-01 | modify | `frontend/src/services/userApi.js`                              | Add request/response interceptor pair + `getStoredToken`/`setAuthToken`/`clearAuthToken`/`registerUnauthorizedHandler` exports per FR-2/FR-4; supersedes AUTH-01 PLAN.md's F-06 forward-reference per ADR-3 |
| F-02 | modify | `frontend/src/App.jsx`                                          | Add `isAuthenticated`/`sessionExpiredMessage` state, mount-time `jwt-decode` expiry check, `registerUnauthorizedHandler` wiring, `handleLoginSuccess`/`handleLogout` handler functions per FR-1/FR-3 |
| F-03 | modify | `frontend/package.json`                                         | Add `jwt-decode` runtime dependency per ADR-2/condition C-8                                                 |
| F-04 | create | `frontend/src/services/__tests__/userApi.auth.test.js`          | Unit/integration coverage for TC-04, TC-06, TC-07, TC-08, TC-09, TC-12, TC-13, TC-15 (interceptor pair, token exports, localStorage error handling, dedup guard, no-PII logging, contract-shape) |
| F-05 | create | `frontend/src/__tests__/App.auth.test.jsx`                      | Integration coverage for TC-01, TC-02, TC-03, TC-05, TC-13, plus TC-10 and TC-14 as partial/proxy tests (mount restoration, no-token render, expiry, malformed token, mount-path logging, prop-threading proxy, session-expired-message-state proxy). TC-14's full aria-live DOM check requires `LoginScreen` (AUTH-01/AUTH-05 scope) — deferred, see FLAGS.md AF-04. |
| F-06 | create | `frontend/src/__tests__/App.auth.perf.test.jsx`                 | Performance micro-benchmark for TC-11 (100-iteration mount-to-`isAuthenticated` p95 < 100ms)                |
| F-07 | modify | `docs/config/project-commands.yaml`                              | `preflight:` — append a smoke-check for the new `jwt-decode` runtime dependency (config drift C1)          |

### Cross-plan wiring note (no new production module created)

Every `create` row above (F-04, F-05, F-06) is a test file — a leaf per the `plan-validation` wiring-dimension exception (test files/fixtures require no consumer/entry-registration site). No new production module is introduced by this story: F-01, F-02, and F-03 are all `modify` actions against existing, already-wired files (`userApi.js` is already the sole HTTP entry point per `CLAUDE.md`; `App.jsx` is already the root component; `package.json` is the dependency manifest). The one cross-story wiring concern — AUTH-01 PLAN.md's own F-06 row for `setAuthToken` — is resolved explicitly by ADR-3 above rather than left as an implicit assumption.

## 3. Module Hierarchy

```
services/
└── userApi (F-01, modify)
    ├── getStoredToken() -> string | null
    │   - input:  none
    │   - output: token string, or null if absent or if localStorage.getItem throws
    │   - public: exported function; never propagates a thrown localStorage error
    ├── setAuthToken(token: string) -> void
    │   - input:  token string
    │   - output: none (side effect: localStorage.setItem); throws a caught, readable Error
    │     (not a raw DOMException) if localStorage.setItem throws (e.g. quota exceeded)
    │   - public: exported function; supersedes AUTH-01 PLAN.md F-06's in-memory-header variant
    │     per ADR-3
    ├── clearAuthToken() -> void
    │   - input:  none
    │   - output: none (side effect: localStorage.removeItem)
    │   - public: exported function
    ├── registerUnauthorizedHandler(callback: () => void) -> void
    │   - input:  callback with no args
    │   - output: none (side effect: stores callback in module-level variable)
    │   - public: exported function; called once by App.jsx (F-02) on mount
    ├── request interceptor (internal, registered on `client`)
    │   - input:  outgoing axios request config
    │   - output: config with `Authorization: Bearer <token>` header attached when
    │     `getStoredToken()` is non-null; unmodified config when null (no empty header)
    └── response interceptor (internal, registered on `client`)
        - input:  axios response/error
        - output: on 401 — calls clearAuthToken(), then invokes the registered
          unauthorized-handler callback ONLY IF getStoredToken() was still non-null at the
          moment the 401 arrived (dedup guard per FR-4); on any other status, passes through
          to the existing normalizeError() path unchanged

App.jsx (F-02, modify)
├── isAuthenticated: useState(() => Boolean(userApi.getStoredToken()))
│   - plain boolean, never null/loading, per FR-3/condition C-9
├── sessionExpiredMessage: useState(null)
│   - string | null; set to "Your session has expired. Please log in again." on
│     on-mount expiry detection (FR-1) or on registered-handler invocation (FR-4)
├── mount-time expiry check (useEffect, runs once)
│   - input:  userApi.getStoredToken()
│   - output: if a token exists but jwt-decode's exp claim is in the past (or jwt-decode
│     throws on a malformed token), calls userApi.clearAuthToken(), setIsAuthenticated(false),
│     setSessionExpiredMessage(...), and logs the auth_session_expired event (no PII)
├── registerUnauthorizedHandler wiring (useEffect, runs once on mount)
│   - registers a handler that calls setIsAuthenticated(false),
│     setSessionExpiredMessage("Your session has expired. Please log in again."), and logs
│     auth_session_expired (no PII)
├── handleLoginSuccess(token: string) -> void
│   - input:  token string (from LoginScreen's onLoginSuccess callback, per AUTH-01's locked
│     contract — LoginScreen itself already calls userApi.setAuthToken before invoking this)
│   - output: setIsAuthenticated(true), setSessionExpiredMessage(null)
│   - forward-reference: consumed by AUTH-05 when it wires LoginScreen into the render tree
├── handleLogout() -> void
│   - input:  none
│   - output: userApi.clearAuthToken(), setIsAuthenticated(false), setSessionExpiredMessage(null)
│   - forward-reference: exists so AUTH-07's logout action has a ready-made handler to call;
│     this story does not add any logout-triggering UI element (per Scope -> Out)
└── (unchanged) activeView, sidebarOpen, userCount state and Sidebar/Header/Dashboard/Users
    render logic — NOT gated by isAuthenticated in this story; AUTH-05 owns the conditional
    render switch between LoginScreen and the protected view tree
```

## 4. State and Data Management

- **New client-side persistent state**: a single `localStorage` key (introduced by F-01) holding the opaque JWT string. No new key naming is left ambiguous at implementation time — the implementation task (T-02) names the constant once (e.g. a module-level `const TOKEN_KEY` used consistently by all four exported functions) so `getStoredToken`/`setAuthToken`/`clearAuthToken` never drift to different key names. No backend schema change, no migration — this is a browser-only, additive key with no counterpart in `backend/`.
- **No new React Context/global store**: `isAuthenticated` and `sessionExpiredMessage` are local `useState` in `App.jsx`, consistent with `react-patterns` § State management (no Redux/Zustand/Context in this repo). `App.jsx` passes them down as props to whatever AUTH-05 mounts (`LoginScreen`/protected views) — this story does not itself add the conditional-render branch that consumes them (per Scope -> Out), it only guarantees both state values and their setters exist and are correctly maintained.
- **Cache/TTL**: the token's effective TTL is enforced server-side (60 minutes, AUTH-02/AUTH-03 scope); the client never re-derives or extends TTL — it only reads the `exp` claim already embedded in the token to decide `isAuthenticated`, and defers final authority to the server's `401` on every subsequent call (per Constraints: "no signature verification on the client... this is a UX optimization, not a security boundary"). No client-side cache invalidation event is needed beyond `clearAuthToken()` on 401/expiry/logout.
- **No password/credential persistence**: per NFR-security and `.claude/rules/security-baseline.md`, no password or password hash is ever written to any client-persistent storage by this story's code — `setAuthToken` only ever receives and stores the opaque JWT string (verified by TC-12).

## 5. Task Breakdown

| #     | Title                                                                                          | Complexity | [P] | Predecessors | Files | Notes                                                                                                     |
|-------|--------------------------------------------------------------------------------------------------|------------|-----|---------------|-------|---------------------------------------------------------------------------------------------------------------|
| T-01  | Add `jwt-decode` to `frontend/package.json`                                                      | S          | [P] | —             | F-03  | Runtime dependency only, no devDependency change; version pinned `^4.x` per ADR-2                              |
| T-02  | Implement `userApi.js` auth-token exports + request/response interceptor pair                    | M          | [P] | —             | F-01  | Adds `getStoredToken`/`setAuthToken`/`clearAuthToken`/`registerUnauthorizedHandler` + the two interceptors; `setAuthToken`/`getStoredToken` wrap all `localStorage` calls in try/catch per FR-2/condition C-7; response-interceptor 401 branch includes the dedup guard per FR-4/ADR-1; inline comment on the interceptor block notes the guard and why (per REQUIREMENTS.md § Documentation requirements — Inline code comments); supersedes AUTH-01 PLAN.md F-06 per ADR-3 |
| T-03  | Wire `App.jsx` auth state, mount-time expiry check, handler registration                         | M          |     | T-01, T-02    | F-02  | Adds `isAuthenticated`/`sessionExpiredMessage` state (FR-3), the mount `useEffect` expiry check using `jwt-decode` (FR-1), `registerUnauthorizedHandler` wiring, `handleLoginSuccess`/`handleLogout`; logs `auth_session_expired` (no PII) on both the mount-expiry path and the registered-handler path per NFR-observability; does NOT add the Login-vs-protected-view conditional render (AUTH-05 scope) |
| T-04  | Unit/integration tests: `userApi.auth.test.js`                                                   | M          |     | T-02          | F-04  | Covers TC-04, TC-06, TC-07, TC-08, TC-09, TC-12 (localStorage content inspection after `setAuthToken` — asserts only the token key is present), TC-13 (interceptor-path `auth_session_expired` log assertion, no PII in payload), TC-15 (contract: mocked `{ token }` shape maps to `setAuthToken` call) |
| T-05  | Integration tests: `App.auth.test.jsx`                                                            | M          |     | T-03          | F-05  | Covers TC-01, TC-02, TC-03, TC-05 fully, TC-13 (mount-expiry-path log assertion). TC-10 and TC-14 are partial/proxy only, NOT full passes: TC-10 asserts the unauthorized handler registers and runs without throwing (full `sessionExpiredMessage` prop threading needs `LoginScreen`); TC-14 asserts the `sessionExpiredMessage` state value is set to the exact required copy on the unauthorized-handler path and never set when there's nothing to expire (the full aria-live DOM check needs `LoginScreen`, which does not exist on this branch). Both partials are deferred to AUTH-01/AUTH-05 landing `LoginScreen` — see FLAGS.md AF-04. |
| T-06  | Performance micro-benchmark: `App.auth.perf.test.jsx`                                             | S          |     | T-03          | F-06  | Mounts `App` 100 times with a valid token pre-seeded in `localStorage`, measures time to `isAuthenticated === true`, asserts p95 < 100ms per TC-11/condition C-3                                              |
| T-07  | Config drift: append `jwt-decode` smoke-check to `docs/config/project-commands.yaml preflight:`  | S          |     | T-01          | F-07  | Config drift C1 (new runtime dependency); appends `test -d frontend/node_modules/jwt-decode` after the existing `cd frontend && npm install` line, mirroring AUTH-03's T-10 precedent for a new dependency |

Predecessor DAG: T-01 and T-02 have no predecessors and touch disjoint files (F-03, F-01 respectively) — both are `[P]`. T-03 depends on both (needs the real `jwt-decode` dependency present and the real `userApi.js` exports to call). T-04 depends only on T-02 (tests `userApi.js` in isolation). T-05 and T-06 depend on T-03 (test the composed `App.jsx`). T-07 depends on T-01 (smoke-checks the exact dependency T-01 adds) and is not marked `[P]` because its predecessor is not guaranteed merged when dispatched.

## 6. Carry-Forward Risks and Conditions

### Risks addressed by tasks

| Risk id | Severity | Addressed by |
|---------|----------|---------------|
| #1      | HIGH     | T-02, T-03    |
| #2      | HIGH     | T-03, T-06    |

### Risks accepted (carry-forward)

| Risk id | Severity | Rationale                                                                                                                                                                                                                                                    |
|---------|----------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| #4      | HIGH     | accepted (ADR-1 consequences; story Mechanism section, security-baseline reviewed) — JWT in `localStorage` is readable by any script on the page (XSS exposure). This is the documented, accepted tradeoff for a desktop-only internal admin tool with no regulated data and no CSP hardening today. CSP hardening is explicitly deferred to a future security-hardening story; no mitigation code is added in AUTH-04. |
| #5      | HIGH     | accepted — documented out-of-scope per REQUIREMENTS.md § Scope -> Out and story § Dependencies ("Informational (not a gating dependency)"): AUTH-08 owns the CORS/`Access-Control-Allow-Headers: Authorization` configuration for this mechanism. AUTH-04 assumes it is configured correctly and does not implement or verify it end-to-end. Revisit only if AUTH-08's PLAN.md ships without the `Authorization` header allowance. |

### Conditions for GO (research_verdict GO-WITH-CONDITIONS)

| Cond | Condition (verbatim, abbreviated)                                                                                     | Addressed by |
|------|---------------------------------------------------------------------------------------------------------------------------|---------------|
| C-1  | 401 infinite redirect prevention — Login never calls protected endpoints on mount; `setAuthToken` before `onLoginSuccess`; dedup guard on the 401 handler | T-02, T-03    |
| C-2  | CORS Authorization header allowance — out of scope for this story, AUTH-08 owns it                                        | (accepted, risk #5 above — no task; documented, not silently assumed resolved) |
| C-3  | Token expiry check benchmark — mount-to-`isAuthenticated` p95 < 100ms over 100 iterations                                 | T-06          |
| C-4  | AUTH-02 login response shape alignment — consume `{ token: string }` as-is, no redefinition                              | T-04 (TC-15 contract test), T-02 (extraction logic assumes exactly this shape) |
| C-5  | XSS risk acknowledgment — documented, accepted tradeoff, no CSP code added                                                | (accepted, risk #4 above — documented in ADR-1 consequences) |
| C-6  | Login component scope/accessibility — out of scope for this story's file ownership; `sessionExpiredMessage` prop threading only | T-03, T-05 (TC-10) |
| C-7  | localStorage error handling — `getStoredToken`/`setAuthToken`/`clearAuthToken` wrap all localStorage calls in try/catch    | T-02, T-04 (TC-06, TC-07) |
| C-8  | jwt-decode library decision — added as a dependency, malformed-token fallback treated as "no token"                       | T-01, T-03, T-05 (TC-05) |
| C-9  | App.jsx auth state init/clearance — plain boolean `isAuthenticated`, separate `sessionExpiredMessage`, correct on-mount/on-login/on-401 transitions | T-03, T-05    |
| C-10 | Observability: session-expiry logging — `auth_session_expired` event, no PII                                              | T-03, T-04 (TC-13), T-05 (TC-13) |

### Cross-Feature Dependency Notes

- **AUTH-01** (`docs/features/AUTH-01/PLAN.md` F-06): see ADR-3 above — AUTH-04's T-02 is the authoritative implementer of `setAuthToken`'s final (`localStorage`-backed) shape, superseding AUTH-01's in-memory-header forward-reference regardless of which story's tasks merge first.
- **AUTH-05**: consumes `isAuthenticated`/`sessionExpiredMessage`/`handleLoginSuccess` (F-02) to add the conditional Login-vs-protected-view render switch; this story deliberately does not add that switch (per Scope -> Out).
- **AUTH-06**: will read auth state (e.g. decoded token claims) from the same `isAuthenticated`/token-retrieval surface this story establishes; no code changes required in this story beyond what F-01/F-02 already expose.
- **AUTH-07**: will call `userApi.clearAuthToken()` and the `handleLogout()` handler (F-02) from its logout button; this story adds no logout-triggering UI (per Scope -> Out).
- **AUTH-08**: owns CORS/`Authorization` header allowance (risk #5 above); AUTH-04 assumes it is configured correctly, per the story's one-directional, non-gating dependency note.

## 7. Test Strategy

| Layer                          | Test path                                                    | TCs covered                                    | Notes                                                                                                                    |
|---------------------------------|----------------------------------------------------------------|-------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------|
| Integration                    | `frontend/src/services/__tests__/userApi.auth.test.js`         | TC-04, TC-06, TC-07, TC-08, TC-09                | Vitest; mocks the axios adapter and `localStorage` directly (per story's own Test mapping: "injecting a token directly into localStorage") |
| Security                       | `frontend/src/services/__tests__/userApi.auth.test.js`         | TC-12                                            | Inspects `localStorage` contents after `setAuthToken(token)`; asserts only the token key is present, never password material |
| Contract                       | `frontend/src/services/__tests__/userApi.auth.test.js`         | TC-15                                            | Structural assertion that a mocked `{ token: string }` login-resolution maps to exactly one `setAuthToken(token)` call; runs under the existing, already-configured Vitest runner — no new contract-testing tool (e.g. Pact) is introduced, matching AUTH-02/AUTH-03's precedent for their own contract-typed TCs |
| Observability (interceptor path) | `frontend/src/services/__tests__/userApi.auth.test.js`       | TC-13 (partial — 401 path)                       | Captures `console.log`/spy output on the response interceptor's 401 branch; asserts event name only, no PII               |
| Integration                    | `frontend/src/__tests__/App.auth.test.jsx`                      | TC-01, TC-02, TC-03, TC-05, TC-10 (partial)      | Vitest + React Testing Library (manual `createRoot`/`act`, no RTL package installed); seeds `localStorage` before render to simulate refresh/first-visit/expired/malformed scenarios. TC-10 is partial — see F-05/T-05 notes above |
| Observability (mount path)      | `frontend/src/__tests__/App.auth.test.jsx`                      | TC-13 (partial — mount-expiry path)              | Captures `console.log`/spy output on the mount `useEffect` expiry branch; asserts event name only, no PII                  |
| Accessibility (declared `e2e`)  | `frontend/src/__tests__/App.auth.test.jsx`                      | TC-14 (partial — deferred to AUTH-05)            | **Corrected 2026-08-18 (round-1 fix per VALIDATION-20260818-0710.md):** this row previously claimed full TC-14 coverage; it does not exist yet. `App.jsx` has no `LoginScreen` to render an aria-live region into (AUTH-01/AUTH-05 scope), so no DOM/aria query is possible today. The test added under this row is a state-value proxy only — it asserts `sessionExpiredMessage` is set to the exact required string ("Your session has expired. Please log in again.") when the unauthorized handler fires, and never set to that value when there is nothing to expire. Full TC-14 (aria-live region rendering on the Login screen) is deferred to AUTH-01/AUTH-05 — see FLAGS.md AF-04. |
| Performance                     | `frontend/src/__tests__/App.auth.perf.test.jsx`                 | TC-11                                            | 100-iteration mount-to-`isAuthenticated` benchmark; budget: p95 < 100ms                                                    |

Every TC in `docs/test-cases/AUTH-04.json` (TC-01 through TC-15) appears in the table above; none are flagged `manual: true`. Coverage gate: frontend unit/integration coverage follows the repo's existing threshold (no `harness.yaml` override present -> 80% default, per `docs/config/project-commands.yaml`). No e2e or contract runner is installed or configured by this story — TC-15 executes fully under the already-configured Vitest runner per the rationale in its row above, consistent with AUTH-01/AUTH-02/AUTH-03's precedent for declared-but-runner-less TC types in this repo; TC-14 executes only a partial/proxy assertion under the same runner today (see its row above and FLAGS.md AF-04 for why full coverage needs AUTH-05's `LoginScreen`). Performance test (T-06/F-06) runs as part of the default `npm run test` invocation (no `perf`-label gating is declared for this story, unlike AUTH-02's backend load-test harness, because this is a fast in-process DOM benchmark, not a sustained-load test).

### Plan validation rounds

| Round | Verdict | Failing dimensions | Action                       |
|-------|---------|---------------------|-------------------------------|
| 1     | PASS    | —                   | Continue to tracker push      |

## Plan validation

- Date: 2026-08-17T22:45:00Z
- Verdict: PASS
- Wiring: PASS (no new production module is `create`d — F-01/F-02/F-03 are `modify` rows against already-wired files; F-04/F-05/F-06 are test-file leaves per the wiring-dimension exception. The one cross-plan wiring concern, AUTH-01 PLAN.md's F-06 `setAuthToken` forward-reference, is resolved explicitly by ADR-3 and the § 2 "Cross-plan wiring note" rather than left implicit.)
- Docs: PASS (no trigger fires — T1: no new runnable surface; T2: no new HTTP route, this story consumes AUTH-02's existing `/api/auth/login` response shape without modifying any backend router; T3: no new env var; T4: no new service dir/port. REQUIREMENTS.md § Documentation requirements explicitly defers the one user-visible README note to AUTH-05, which is the story that adds the visible entry point this story's state feeds — not a silently-skipped doc obligation.)
- Runner-setup: PASS (TC-14 is `e2e`-typed and TC-15 is `contract`-typed in `docs/test-cases/AUTH-04.json`, but neither requires a new runner: TC-14 is a DOM/aria query executable under the already-configured Vitest/jsdom runner (no browser-automation tool needed, and this repo declares `test_e2e: n/a` repo-wide per `docs/config/project-commands.yaml`); TC-15 is a structural shape assertion executable under the same already-configured Vitest runner (no consumer-driven contract tool like Pact is needed for an in-repo mock-shape check), matching the identical precedent set by AUTH-01's PLAN.md for its own e2e-typed TCs and AUTH-02/AUTH-03's PLAN.md for their own contract-typed TCs. TC-11 (`performance`) is addressed by a dedicated task, T-06, which is sequenced after T-03 (the code it benchmarks).)
- Cross-section: PASS (every TC-01..TC-15 in `docs/test-cases/AUTH-04.json` appears in § 7's table; every file table row F-01..F-07 is referenced by at least one task's Files column in § 5 — F-03 by T-01, F-01 by T-02, F-02 by T-03, F-04 by T-04, F-05 by T-05, F-06 by T-06, F-07 by T-07; every task's Files column references only F-NN ids present in § 2; all 10 research conditions C-1..C-10 appear in § 6's Conditions for GO sub-section with non-empty Addressed-by cells.)
- Config drift: PASS (C1 fires — new runtime dependency `jwt-decode` added via F-03 — addressed by T-07, which appends a smoke-check to `docs/config/project-commands.yaml preflight:`, mirroring AUTH-03's T-10 precedent; C2/C3 do not fire — no new service dir, `docker-compose.yml` entry, or port is introduced by this story.)
- Rounds: 1
