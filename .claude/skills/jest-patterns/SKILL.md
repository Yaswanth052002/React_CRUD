---
name: jest-patterns
description: jest test patterns for this project — fill body with team test conventions. Used by validation/arh-implementation agents.
when_to_use: Writing or reviewing jest tests.
user-invocable: false
allowed-tools: Read Write Edit Bash Grep Glob
---
# jest Test Patterns

<!-- Harness scaffold: test-runner=jest — STRUCTURE only; -->
<!-- Fill every CORE section. Under OPTIONAL, keep only what applies and DELETE the rest -->
<!-- (heading+slot) before filling. OPTIONAL slots are not lint-nagged; CORE TODO slots are. -->
<!-- Loaded by validation-agent (and implementation-agent for test code) when this runner is active. -->

## Idioms

- Test files live beside the source file: `Component.jsx` → `Component.test.jsx`.
- Name test files `*.test.jsx` / `*.test.js`; describe blocks match the component/module name.
- Follow Arrange-Act-Assert: set up props/mocks, trigger the interaction, assert the outcome — one blank line between each phase.
- One `it(...)` per behavior; put the expected behavior in the test name (`"shows a validation error when email is invalid"`), not the implementation detail.
- Use factory functions (e.g. `buildUser({ overrides })`) for repeated fixture objects instead of copy-pasting literals across tests.
- Prefer React Testing Library queries (`getByRole`, `getByLabelText`) over `getByTestId`; reserve `data-testid` for elements with no accessible role/label.

## Test layering

- **Unit** — pure functions and single components in isolation (e.g. `userApi.js` helpers, `UserForm` validation logic). Mock all network calls.
- **Integration** — a page composed of multiple components (e.g. `Dashboard.jsx`) rendered together, asserting on user-visible flow (search → filter → table updates). Mock only the HTTP boundary (`userApi.js`), not internal components.
- **E2E** — out of scope for jest in this repo; backend contract is covered by pytest (`backend/tests/test_users.py`). Do not spin up the real FastAPI server from jest tests.
- Unit tests must not import from `pages/`; integration tests must not reach across to unrelated pages.

## Mocking & test data

- Mock the HTTP boundary only: `jest.mock('../services/userApi')` — never mock Axios directly, since components must always go through `userApi.js`.
- Component/unit tests must not make real network calls; assert against mocked resolved/rejected promises for both success and error paths.
- Use small, explicit fixture objects per test file (e.g. `const mockUser = { id: 1, name: 'Jane', email: 'jane@test.com', role: 'User', status: 'Active' }`) — do not import fixtures across unrelated test files.
- Reset mocks between tests with `beforeEach(() => jest.clearAllMocks())` to avoid cross-test leakage of call counts/resolved values.

## Examples

BAD — asserts on implementation, not behavior, and skips the error path:
```jsx
it("calls setUsers", () => {
  render(<Dashboard />);
  expect(mockSetUsers).toHaveBeenCalled();
});
```

GOOD — asserts on what the user sees, covers success and failure:
```jsx
it("shows an error toast when user creation fails", async () => {
  userApi.createUser.mockRejectedValueOnce(new Error("Email already exists"));
  render(<UserForm onSubmit={submit} />);
  await userEvent.click(screen.getByRole("button", { name: /save/i }));
  expect(await screen.findByText(/email already exists/i)).toBeVisible();
});
```

## References

- Canonical example: `frontend/src/services/userApi.js` (the only module tests should mock for HTTP).
- Component test example location: `frontend/src/components/` (co-located `*.test.jsx` files).
- Backend contract tests (for cross-checking API shape assumptions used in mocks): `backend/tests/test_users.py`.

<!-- ============================================================================ -->
<!-- OPTIONAL — keep only what applies to jest; DELETE the rest.            -->
<!-- ============================================================================ -->

## Coverage & flake policy

- No hard coverage gate enforced yet; new components and services should ship with tests covering the happy path and at least one error/edge case.
- A test that fails intermittently must be fixed (usually an unawaited async update) rather than retried or skipped — flaky tests are quarantined with a `TODO(flaky)` comment and a follow-up task, never silently disabled.
