# Feature: AUTH-05 — Navigation and routing for authenticated/unauthenticated views

## Problem

Today `App.jsx` unconditionally renders the `Sidebar`, `Header`, and the `activeView` state
machine (Dashboard/Users/Settings) with no auth-state check on mount. Once AUTH-04 lands
authentication and AUTH-01 lands the Login screen, an unauthenticated visitor can still see and
click into Dashboard/Users/Settings nav chrome — a security regression the AUTH epic is meant to
close — and a freshly logged-in user has no guarantee of landing anywhere sensible.

## Outcome

`App.jsx`'s render branches strictly on the `isAuthenticated` signal: unauthenticated visitors
see only the Login view (no Sidebar, no Header, no mounted protected views); authenticated users
see the full nav chrome with all three `NAV_ITEMS` working exactly as today; a successful login
transitions directly to Dashboard with no manual click or reload; and an auth state that becomes
invalid (expiry/logout) falls back to Login-only without leaving a stale protected view mounted.

## Constraints

- Must consume, not redefine, AUTH-04's locked `isAuthenticated` contract: a plain `useState`
  boolean in `App.jsx`, `const [isAuthenticated, setIsAuthenticated] = useState(() =>
  Boolean(userApi.getStoredToken()))` — never `null`/loading, never a Context or custom hook.
- Must consume, not redefine, AUTH-01's locked `LoginScreen` contract: props
  `onLoginSuccess={(token) => void}` and optional `sessionExpiredMessage={string | null}`. There
  is no `authError`/`onSuccess`-with-result-object shape — that framing is stale and superseded.
- No additional network round trip beyond AUTH-04's existing token check on mount/refresh.
- Sidebar/Header/protected-view components must not mount (not merely be CSS-hidden) when
  `isAuthenticated` is false, per `.claude/rules/security-baseline.md` (mounted-but-hidden
  components would still fire data-fetching calls against protected endpoints).
- No router library is introduced; the existing plain-state conditional-render pattern
  (already used for `activeView`) is extended one level up for the auth gate.

## Solution sketch

`App.jsx` wraps its existing Sidebar + Header + `activeView` render tree in a single conditional
on `isAuthenticated`: false renders `<LoginScreen onLoginSuccess={...}
sessionExpiredMessage={sessionExpiredMessage} />` only; true renders the current layout
unchanged. The `onLoginSuccess` handler sets `isAuthenticated=true` and resets
`activeView="dashboard"` so login always lands on Dashboard regardless of prior navigation
state. `sessionExpiredMessage` is threaded through from AUTH-04's state as-is, with no local
copy or transformation. Sidebar and Header receive no new props and require no code changes;
they are simply omitted from the tree, not hidden, when unauthenticated.

## Addressing Research Conditions

- C-1 (AUTH-04 `isAuthenticated` signal contract, Integration) — already locked, PLAN.md
  restates for implementer reference: `isAuthenticated` is a plain `useState` boolean
  (`useState(() => Boolean(userApi.getStoredToken()))`), never `null`/loading. AUTH-05's
  conditional render assumes this exact shape; no adapter or PR-review-and-adapt step needed.
- C-2 (AUTH-01 `LoginScreen` props contract, Integration) — already locked, PLAN.md restates
  for implementer reference: `LoginScreen` accepts `onLoginSuccess={(token) => void}` and
  optional `sessionExpiredMessage={string | null}`; no `authError`/`onSuccess`-with-result
  shape exists or is used anywhere in this PRD or downstream PLAN.md.
- C-3 (Existing test compatibility, Compatibility, open) — PLAN.md must include a task to audit
  existing frontend test files that render `App.jsx` and implicitly assume Sidebar/Header
  always render; each such test is updated to either mock `isAuthenticated=true` before render
  (if it tests protected-view behavior) or is scoped out of the auth-gate concern. New tests are
  added per FR-1 below to cover both auth states and the transition.
- C-4 (Session-expiry `sessionExpiredMessage` threading, Domain) — already locked, PLAN.md
  restates for implementer reference: AUTH-04 owns and sets `sessionExpiredMessage`
  (`string | null`) on 401/expiry; AUTH-05 only passes the value through to `LoginScreen`'s
  `sessionExpiredMessage` prop, unchanged and untransformed — it does not own, duplicate, or
  derive this state.
- C-5 (Post-login `activeView` reset, Domain, open) — PLAN.md must specify that the
  `onLoginSuccess` handler in `App.jsx` calls `setActiveView("dashboard")` unconditionally,
  overriding any `activeView` value left over from a prior session, so a re-login after
  logout always lands on Dashboard rather than the last-viewed protected screen.

## Scope

- In: `App.jsx`'s auth-gated render branch (Login-only vs. Sidebar+Header+activeView tree);
  wiring `isAuthenticated` to gate that branch; wiring `onLoginSuccess` to set
  `isAuthenticated=true` and reset `activeView="dashboard"`; passing `sessionExpiredMessage`
  through to `LoginScreen` unchanged; auditing/updating existing frontend tests that assume
  Sidebar/Header always render; new tests covering both auth states and the false→true
  transition.
- Out: AUTH-01's `LoginScreen`/`LoginForm` internals (validation, submit-loading state, its own
  error display) — AUTH-05 only consumes the component via its two locked props, does not
  implement or modify it. AUTH-04's auth-state internals (token storage/validation, 401
  interceptor wiring, `sessionExpiredMessage` derivation) — AUTH-05 only consumes the
  `isAuthenticated` and `sessionExpiredMessage` values, does not implement or modify their
  source. AUTH-06's Settings screen content and AUTH-07's logout/session-invalidation trigger
  logic — AUTH-05 only keeps the Settings nav entry available to authenticated users and reacts
  to `isAuthenticated` flipping false, it does not implement logout itself.

## Functional requirements

FRs trace 1:1 to story ACs; see `docs/stories/AUTH-05.md` for canonical wording.
New impl constraints introduced below (when any):

**AUTH-05-FR-1** — Auth-gated mount, not CSS-hide *(extends AC #1/#4 with: mounting discipline)*

When `isAuthenticated` is false, `Sidebar`, `Header`, and the `activeView`-selected protected
view component MUST NOT be present in the React tree (not rendered-then-hidden via CSS). This
applies both on initial unauthenticated load (AC #1) and on a transition from true→false while a
protected view was already mounted (AC #4) — the protected view must unmount, not remain mounted
with the auth gate rendered on top.

**AUTH-05-FR-2** — Post-login `activeView` reset *(extends AC #3 with: explicit override
behavior)*

The `onLoginSuccess(token)` handler MUST call `setActiveView("dashboard")` unconditionally on
every successful login, regardless of whatever `activeView` value was set before the user's auth
state went false (e.g. via a prior logout while on the Users or Settings view). This is an
override, not a preserve-if-unset default.

**AUTH-05-FR-3** — `sessionExpiredMessage` pass-through only *(extends AC #4 with: no local
ownership)*

`App.jsx` passes AUTH-04's `sessionExpiredMessage` value directly to `LoginScreen`'s
`sessionExpiredMessage` prop with no transformation, default substitution, or local copy in
AUTH-05's own state. AUTH-05 introduces no `authError` state or prop anywhere in its
implementation.

## Non-functional requirements

- Performance: The Login-vs-authenticated branch decision renders within the same paint as
  today's initial `App` render, with no added loading-spinner state beyond what AUTH-04 already
  introduces for auth-state resolution, and no additional network round trip introduced by
  AUTH-05's own code.
- Security: Per `.claude/rules/security-baseline.md`: applies to the auth-gated render branch —
  protected components (Sidebar, Header, Dashboard/Users/Settings views) must not mount when
  `isAuthenticated` is false, since a mounted-but-hidden component would still fire data-fetching
  calls against protected endpoints.
- Accessibility: Per `.claude/rules/accessibility-baseline.md`: applies to the Sidebar's
  `nav-item` buttons in the authenticated state — they retain their existing keyboard
  reachability (Tab order) and visible focus states; this story does not alter or duplicate
  AUTH-01's Login view, only mounts/unmounts it based on auth state.
- Observability: No new log event is added for nav-state transitions (unauthenticated ↔
  authenticated); this is covered by AUTH-04's own auth-state instrumentation per
  `.claude/rules/security-baseline.md` (no PII/token logging).

## Rollout plan

- **Strategy**: bang-bang — this is a same-PR conditional-render change to `App.jsx` with no
  independent runtime toggle; it ships atomically with (or after) AUTH-01 and AUTH-04.
- **Feature flag**: none — auth gating is not something to roll out gradually; it is a
  correctness/security fix that must apply to 100% of sessions immediately upon deploy.
- **Backout plan**: revert the `App.jsx` conditional-render commit; this restores the prior
  unconditional Sidebar/Header/activeView render (accepting the pre-AUTH-05 security gap as a
  known, temporary regression until re-applied).
- **Success signal**: zero unauthenticated sessions able to reach Dashboard/Users/Settings views
  (verified via the new App.test.jsx assertions in FR-1's coverage), and zero manual
  flash-of-protected-nav reports during post-deploy smoke testing.

## Documentation requirements

- **README updates**: none required — `README.md` § 11 (CRUD Usage) already assumes an
  authenticated context; no new user-facing workflow is introduced by AUTH-05 itself.
- **Runbook**: none.
- **API reference**: n/a — AUTH-05 makes no backend or API changes.
- **Inline code comments**: `frontend/src/App.jsx` — a short comment at the auth-gate
  conditional noting the locked `isAuthenticated`/`LoginScreen` contracts (per AUTH-04/AUTH-01)
  this branch depends on, so future edits don't accidentally reintroduce an `authError` prop or
  a `null`/loading tri-state.
- **Examples / how-to**: none.

## Open questions

Decisions logged in `docs/stories/AUTH-05.md` § Decision log.

## Approvals

- **2026-08-17** — yaswanth.panthangi@apexon.com (PO + Designer + BA, single-approver mode covers all when one human): **APPROVE**
  - Feature Summary, FRs, User Flows reviewed
  - UI specs: N/A, `integrations.design = none`
  - Edge Cases, Open Questions, test-case completeness reviewed
  - No-placeholder check ✓ · `[NEEDS CLARIFICATION]` count=0
  - Research verdict GO-WITH-CONDITIONS (all conditions addressed above)
  - Tracker subtask: n/a (`issue tracker = none`)
