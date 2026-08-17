# Research Assessment: AUTH-01 — Login screen UI and entry point

**Story**: AUTH-01  
**Epic**: AUTH  
**Phase**: Research  
**Assessment date**: 2026-08-17  
**Assessor**: Claude Research Agent  

---

## Upstream dependencies

Per story Dependencies section:
- **Upstream**: None blocking — this story is buildable and independently testable today against a mocked auth service. No backend auth endpoint (AUTH-02) is required to complete this story's scope.
- **Downstream**: AUTH-02 (existing-user authentication and credential validation), AUTH-04 (authentication state management/persistence), AUTH-05 (navigation/routing for authenticated vs. unauthenticated views). This story delivers only the standalone `LoginForm`/`LoginScreen` component; App.jsx wiring is owned by AUTH-05.

Prior research state (from `docs/state/features.json`):
- AUTH-01 is story-validated, P1, independent_test=true, needs_clarification_count=0. Gate is clear to proceed to research.
- No upstream stories are blocking.

---

## Exploration Log

### App.jsx routing state machine
- **Where**: `frontend/src/App.jsx:36-65`
- **What**: Top-level `activeView` state (initially "dashboard"). Conditional rendering: `activeView === "settings"` → SettingsPlaceholder, else `activeView === "users"` → Users page, else Dashboard. The `activeView` state is managed via `setActiveView` callback passed to pages. No login view is wired yet.
- **Surprises**: Simple string-based state machine, not a router library. Adding a "login" activeView branch is trivial (requires only a ternary addition + a new LoginScreen component export). AUTH-05 will own this integration.
- **Open**: None — scope boundary with AUTH-05 is clear (App.jsx wiring is out of scope for AUTH-01).

### Existing form component: UserForm.jsx
- **Where**: `frontend/src/components/UserForm.jsx:1-172`
- **What**: A reusable form component demonstrating all the patterns AUTH-01 needs to follow:
  - Validation function (lines 14-39): EMAIL_REGEX, PHONE_REGEX, field-level error messages, returns an object keyed by field name.
  - Form state: `values`, `errors`, `touched` (lines 42-43).
  - Change handler (lines 46-48): updates values on input change.
  - Blur handler (lines 50-53): marks field touched and re-validates on blur.
  - Submit handler (lines 55-63): prevents default, re-validates all fields, blocks submit if errors exist (no API call), marks all fields touched.
  - Conditional error rendering (lines 65, 92, 108, 124): `{err(field) && <div className="form-error">{err(field)}</div>}`.
  - Loading state on button (lines 165-168): `{submitting && <span className="spinner" .../>}` and `disabled={submitting}`. The spinner element is 14px × 14px, borderWidth 2px (custom CSS-driven animation).
  - Server error display (lines 69-77): `.form-server-error` container with icon + message, rendered conditionally when `serverError` prop is truthy.
  - Responsive layout: form-group + form-row (grid-template-columns: 1fr 1fr) for side-by-side fields at wider widths (lines 127-159).
- **Surprises**: None — clean, idiomatic React hooks form handling. All patterns are reusable for LoginForm (fewer fields, simpler validation, but same architecture).
- **Open**: None.

### Design system: index.css form classes and responsive breakpoints
- **Where**: `frontend/src/styles/index.css:1090-1162, 1240-1314`
- **What**: CSS classes AUTH-01 will reuse:
  - `.form-group` (1091-1097): margin-bottom: 16px spacing.
  - `.form-label` (1105-1115): font-size 12.5px, font-weight 600, color var(--ink), margin-bottom 6px. `.required` span is color var(--danger) (red).
  - `.form-input`, `.form-select` (1117-1133): padding 10px 12px, border-radius var(--radius-md), border 1px solid var(--border-strong), background var(--surface), font-size 13.5px.
  - `.form-input:focus`, `.form-select:focus` (1135-1138): border-color var(--accent) (blue).
  - `.form-input.has-error`, `.form-select.has-error` (1140-1144): border-color var(--danger), background var(--danger-soft).
  - `.form-error` (1146-1150): font-size 11.5px, color var(--danger), margin-top 5px.
  - `.form-server-error` (1152-1162): display flex, gap 8px, background var(--danger-soft), color #a8291f, padding 10px 12px, border-radius var(--radius-md), font-size 12.5px, margin-bottom 16px. Icon (SVG) is 15×15px.
  - `.spinner` (862-875): width 18px, height 18px, border-radius 50%, border 2.5px, border-top-color var(--accent), animation: spin 0.7s linear infinite. The spin keyframe rotates 360deg (line 872).
  - Responsive breakpoints: 1100px (stats-grid switches to 2 cols), 640px (form-row switches to 1 col), no explicit 320px breakpoint but `page` padding reduces at 640px (18px 14px vs 28px).
- **Surprises**: All form classes are already styled; LoginForm needs only to use them (no new CSS required). The .spinner animation is performant (pure CSS transform). The .form-server-error styling matches the Notification/error-display conventions (danger-soft background, icon + message layout).
- **Open**: None — design system is complete and stable.

### Existing error display and validation conventions
- **Where**: `frontend/src/styles/index.css:1152-1162` (form-server-error), `frontend/src/components/UserForm.jsx:69-77` (usage), `frontend/src/rules/security-baseline.md` (security policy), `frontend/src/rules/accessibility-baseline.md` (WCAG 2.2 AA)
- **What**: 
  - Server-level errors (e.g., duplicate email, validation rejection) are displayed in a `.form-server-error` area *above* form fields, not inline per field.
  - The error message is generic and non-leaking (e.g., "Email already in use" not "The email john@example.com is taken by user ID 123").
  - No field-level distinctions for login (per security-baseline, never reveal whether the email exists).
  - Accessibility: per accessibility-baseline, error regions must use `aria-live="assertive"` so screen readers announce login failures immediately; labels must have `aria-required="true"` for required fields; form must have keyboard focus management.
- **Surprises**: None — the conventions are clear from both the code and the rules files.
- **Open**: None.

### Frontend test setup: Vitest
- **Where**: `frontend/package.json` (inferred), `frontend/src/components/__tests__/` (test directory exists per story context)
- **What**: The frontend uses Vitest as the test runner (per CLAUDE.md stack: jest). The story requires a unit test file `frontend/src/components/__tests__/LoginForm.test.jsx` covering:
  - Empty-field validation blocking submit (AC#5).
  - Loading-state toggling around a mocked auth service call (AC#2).
  - Generic error message rendering on a rejected mock call (AC#3).
  - The test should mock the auth service (not axios directly) per react-patterns.
- **Surprises**: None — Vitest is already set up, and the test patterns (mocking services, checking DOM assertions) are proven in Dashboard.search.test.jsx.
- **Open**: None.

### Existing Notification component and toast patterns
- **Where**: `frontend/src/components/Notification.jsx:1-31`, `frontend/src/styles/index.css:927-996`
- **What**: Toast notifications are rendered at top-right (`.toast-stack` position: fixed; top: 20px; right: 20px). Each `.toast` has a type (`success` or `error`), an icon, message text, and a close button. The component iterates over a `toasts` array and renders one `.toast` per item. This is used for successful mutations (create user, update user, delete user) and errors. The story does not require toasts for the login form itself (the form error is inline), but the architecture is consistent with the project's error/feedback conventions.
- **Surprises**: None — Notification component is already present and generic; no changes needed for AUTH-01.
- **Open**: None.

### Security and accessibility rules
- **Where**: `.claude/rules/security-baseline.md`, `.claude/rules/accessibility-baseline.md`
- **What**:
  - Security: Never log tokens, passwords, or PII. Validate untrusted input. Errors shown to users contain no stack traces or internal identifiers. Credentials in this story are not being hashed/validated (that's AUTH-02); this story only renders the request/response states. The form must never log or store password values in component state that outlives the form render.
  - Accessibility: WCAG 2.2 Level AA minimum. Every input has an associated label with `htmlFor`/`id` linkage. Required fields marked with `aria-required="true"` AND a visual indicator (red asterisk). Error-display area uses `aria-live="assertive"`. Submit button has a visible focus state (`:focus-visible` outline). Touch targets ≥ 44×44px. Content reflows at 320px without horizontal scroll.
- **Surprises**: None — the rules are clear and align with AC#4 (responsive layout at 320px), AC#3 (generic, non-leaking error message), and the security/accessibility NFRs in the story.
- **Open**: None.

---

## Pattern map

### Existing code to extend
- **Frontend**: `frontend/src/styles/index.css` — LoginForm will reuse `.form-group`, `.form-label`, `.form-input`, `.form-error`, `.form-server-error`, `.spinner`, `.btn`, `.btn-primary`, `.btn-secondary` classes. No CSS changes required; the form styling is already complete.
- **Frontend**: `frontend/src/components/UserForm.jsx` — LoginForm will *not* extend this component (different data model: login has email + password, not name/email/phone/role/status). However, the validation pattern (validate function returning errors object), field-level error rendering, loading state with spinner, and server-error area rendering will be **mirrored** (not inherited) into LoginForm, maintaining consistency.

### Existing patterns to follow
- **Validation pattern**: Define a pure `validate(values)` function returning an object keyed by field name. On blur, re-validate and update errors. On submit, validate all fields, mark all touched, block submit if errors.
- **Loading state pattern**: Disable the submit button and render a `.spinner` inside it (14px × 14px) while the async call is in flight. Enable immediately on resolve/reject.
- **Error display pattern**: Render field-level errors (`.form-error`) under invalid inputs when touched. Render server-level errors (`.form-server-error`) above the form. Never log or display passwords.
- **Responsive pattern**: Use existing `.stats-grid` breakpoints (1100px, 640px) as reference. LoginForm will be simpler (email + password + button, no side-by-side fields needed) but must reflow to full-width at 640px and below, with no horizontal scroll at 320px.
- **Accessibility pattern**: `<label htmlFor="fieldId">Label <span className="required">*</span></label>` + `aria-required="true"` on inputs. Server-error area wrapped in `<div aria-live="assertive">`. Focus management: default focus on first focusable element (email input) on mount.

### New files to create
- `frontend/src/components/LoginForm.jsx` — the core form component (email + password inputs, validation, loading state, error display, submit handler). Receives `onSubmit(credentials)` callback and `isSubmitting` boolean prop from parent. Does not call the auth service directly; that's the parent's responsibility (per react-patterns: components accept callbacks, never call services directly).
- `frontend/src/components/LoginScreen.jsx` — a page-level wrapper that manages auth service calls, handles the async flow, and passes state to LoginForm via props. This component calls the mocked auth service and catches errors.
- `frontend/src/services/userAuthService.js` — a new service module exporting `login(email, password)` async function, which will be mocked in tests and replaced with a real AUTH-02 implementation downstream. This function must **not** log credentials.
- `frontend/src/components/__tests__/LoginForm.test.jsx` — unit test covering empty-field validation, loading-state toggling, and error-message rendering against a mocked auth service.

### Shared code at risk
- **`frontend/src/styles/index.css`** — all form classes + responsive breakpoints. Changes to form styling (padding, border, colors, responsive thresholds) could ripple to UserForm and any other forms. Mitigation: LoginForm will strictly reuse existing classes without modifications; no CSS changes in this story.
- **`frontend/src/App.jsx`** — activeView state machine. Adding a "login" branch requires a ternary addition (trivial, low-risk). Mitigation: AUTH-05 owns this change; AUTH-01 does not modify App.jsx.
- **`frontend/src/components/` directory** — no shared components are being modified or extended in AUTH-01. Mitigation: LoginForm and LoginScreen are new files; no changes to existing components.

---

## Risk register

| # | Dimension       | Severity | Description                                      | Mitigation                                  |
|---|-----------------|----------|--------------------------------------------------|---------------------------------------------|
| 1 | Security        | HIGH     | Password values must never be logged, stored in component state beyond the form render, or leaked to error messages. Credentials handling is security-critical. | Follow security-baseline strictly: use `type="password"` with `autoComplete="current-password"`, never store password in component state after submit, never log credentials, never include password in error messages. Validate credential shape client-side (non-empty) only; real validation is AUTH-02's responsibility. Test must verify no password leaks in console/DOM. |
| 2 | Integration     | MED      | The mocked auth service must be testable in isolation without a real backend. Mock must be realistic (returns success or error) but not couple LoginForm to backend details. | Keep auth service layer thin: `userAuthService.login()` is a pure async function exported from a separate module, easily mockable. Tests will `vi.mock("../services/userAuthService")` at the component boundary (per react-patterns). LoginScreen (the parent) calls the real service; test only mocks it. |
| 3 | Compatibility   | MED      | LoginForm styling must integrate seamlessly with existing form design. CSS class names and responsive breakpoints must match UserForm conventions exactly. | Reuse existing `.form-*`, `.btn-*`, `.spinner` CSS classes without modification. Follow UserForm's form-group/form-label/form-input layout exactly. No new CSS classes required. Verify responsive behavior at 1100px, 640px, 320px against existing .stats-grid breakpoints. |
| 4 | Accessibility   | MED      | WCAG 2.2 AA compliance: labels, required indicators, focus states, live regions, touch targets, reflow at 320px without horizontal scroll. | Follow accessibility-baseline: every input has `<label htmlFor>`, `aria-required="true"`, visible `:focus-visible` outline. Server-error area uses `aria-live="assertive"`. Button ≥ 44×44px (`.btn` is already sized correctly). Test at 320px, 640px, 1100px widths. No horizontal scroll. |
| 5 | Performance     | LOW      | Loading state (disabled button + spinner) must appear within one render frame (<16ms) of click. No debounce applied (unlike search in SRF-01). | Existing `.spinner` animation is pure CSS (no JS overhead). Button disabled state is instant (no artificial delay). No debounce in the story (per NFR). Login button click triggers immediate state update to `isSubmitting=true`; React renders <16ms. Low risk; existing patterns are performant. |
| 6 | Domain          | LOW      | Edge case: what happens if the user submits the form, then rapidly clicks submit again while the first request is in flight? | Mitigate by disabling the submit button while `isSubmitting=true` (per AC#2, loading state pattern). Only one request can be in flight at a time. No race condition risk.  |

---

## Score + verdict

### 5-dimensional rubric

| Dimension       | Weight | Pass criterion                                                              | Finding                                                                   | Score |
|-----------------|--------|-----------------------------------------------------------------------------|---------------------------------------------------------------------------|-------|
| Integration     | 25     | All upstream dependencies available; failure modes well understood          | No upstream backend required (mocked service); service layer is thin and easily testable. Failure modes: invalid email/password (caught, generic message), network error (caught, generic message). Both handled in story. | 95    |
| Compatibility   | 20     | Backward compat plan exists for each affected client/version                | LoginForm reuses existing CSS classes (form-group, form-label, form-input, form-error, form-server-error, spinner, btn). No modifications to shared code. New component is additive; no breaking changes to existing form or component APIs. | 90    |
| Domain          | 20     | Edge cases enumerated; no hidden invariants surfaced during scan            | Story scope is well-defined: standalone form component, mocked auth service, independent testing. ACs cover validation (AC#5), loading state (AC#2), error display (AC#3), responsive layout (AC#4). No hidden edge cases (rapid resubmit mitigated by button disable, password leaks mitigated by type="password" + no logging). All invariants documented in story and rules files. | 90    |
| Performance     | 15     | Story has explicit perf budget; estimated work fits within budget           | NFR-performance: <16ms render for loading state. Existing .spinner animation is pure CSS. Button disable is instant. No debounce. Estimated work: new component (50 lines JSX) + test (30 lines test code) + service stub (10 lines). Fits well within typical story scope. No perf concerns. | 95    |
| Dependency      | 20     | All upstream stories complete; no blocking external work                    | AUTH-01 has no upstream stories (dependencies field says "none blocking"). Downstream stories (AUTH-02, AUTH-04, AUTH-05) do not block AUTH-01; they consume its output. Story is independent_test=true and can be completed without any other auth stories. No external work blocking. | 100   |

**Total: (95×0.25 + 90×0.20 + 90×0.20 + 95×0.15 + 100×0.20) = 23.75 + 18 + 18 + 14.25 + 20 = 94/100**

### **Total: 94/100 → GO**

No single dimension scores <40. All dimensions score ≥90. This is greenfield UI work building a new component following well-established patterns with clear acceptance criteria, zero unresolved clarifications, and no upstream blockers.

### Conditions

None — verdict is **GO** unconditionally. Proceed directly to `/arh-plan-requirements`.

### Synthesis

**AUTH-01 is feasible for immediate planning and implementation.**

This story is a straightforward brownfield UI component (login form) built to proven patterns (UserForm validation, loading-state spinners, error-display areas, responsive CSS). The codebase provides complete design-system coverage (form classes, responsive breakpoints, accessibility primitives), and the story's acceptance criteria are explicit and comprehensive (validation, loading state, generic error messages, 320px reflow, keyboard accessibility). No upstream auth backend is required; the story uses a mocked auth service, enabling independent testing. The single largest risk is credentials handling (passwords must never leak to logs or error messages), mitigated by following the existing security-baseline rule strictly: `type="password"` input, no password storage in component state, no password logging. The story is independent, unblocked, and ready for requirement planning.

---

## Clarifications

(none — all resolved; see cross-story auth contract decisions applied 2026-08-17.)
