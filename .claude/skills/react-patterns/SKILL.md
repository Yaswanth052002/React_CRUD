---
name: react-patterns
description: react patterns for this project — fill body with team conventions. Used by implementation/validation/arh-review agents.
when_to_use: Writing or reviewing react code.
user-invocable: false
allowed-tools: Read Write Edit Bash Grep Glob
---
# react Patterns

<!-- Harness scaffold: stack=react — STRUCTURE only; -->
<!-- Fill every CORE section below. Under OPTIONAL, keep only the sections that apply to -->
<!-- this stack and DELETE the heading+slot of the rest BEFORE filling. Keep ≤ 200 lines. -->
<!-- Deletion is safe: OPTIONAL slots use the word OPTIONAL (not TODO) so the lint does not -->
<!-- nag for them; CORE TODO slots are nagged until filled — that is intentional. -->
<!-- Loaded by implementation-, impl-planning-, validation-, code-review-, security-review-, -->
<!-- scaffold-, and cicd-agents when this stack is active. -->

## Idioms

- Function components + hooks only; no class components.
- One component per file, filename matches the component name (`UserForm.jsx`).
- Component vocabulary: `pages/` = route-level views (`Dashboard.jsx`), `components/` = reusable/presentational units (`UserTable`, `UserForm`, `Modal`, `Notification`).
- Props destructured in the function signature, not accessed via `props.x`.
- Local UI state via `useState`; derived values computed inline, not duplicated into state.
- Async work (data fetch, mutation) lives in `services/`, never inline `axios` calls in components.

## Project structure

- `src/components/` — presentational + reusable components (Sidebar, Header, StatsCard, UserTable, UserForm, Modal, Notification, DeleteConfirmation, UserDetails).
- `src/pages/` — route-level composition (`Dashboard.jsx`) that wires components + services together.
- `src/services/` — the only layer allowed to call the backend (`userApi.js`); each API call is an exported async function.
- `src/styles/index.css` — shared design tokens and global styles.
- `App.jsx` — top-level shell/router wiring; `main.jsx` — Vite/React entry point.

## Layering & dependency rules

- `components/` may not import from `services/` directly — data flows in via props/callbacks from `pages/`.
- `pages/` may import both `components/` and `services/`; this is the only layer allowed to do so.
- `services/` may not import from `components/` or `pages/` — it is a leaf module wrapping Axios only.
- No component reaches into another component's internals; shared logic goes in a hook or `services/`, not a cross-import.

## Error handling

- All backend errors are normalized once in `userApi.js` (`normalizeError`) into a plain `Error` with a user-facing message — components never see raw Axios/HTTP errors.
- Components catch errors from service calls and render them via `Notification`, never a raw stack trace or `error.message` from Axios directly.
- Network/timeout failures surface as a specific, actionable message (e.g. "Could not reach the server...") rather than a generic failure.
- No swallowed errors: every `catch` either renders a `Notification` or rethrows — never an empty catch block.

## Anti-patterns

- Calling `axios` directly from a component — violates the single-entry-point rule for `services/userApi.js`.
- Storing server data that can be derived from existing state (e.g. filtered lists) instead of computing it on render — violates reusability-baseline "avoid premature abstraction/duplication".
- Catching an error and not showing feedback to the user — violates the no-swallow error-handling rule above.
- Fetching the full user list on every keystroke without debouncing the search input — violates performance-baseline "no unbounded fan-out reads".

## Examples

```jsx
// BAD — component calls axios directly
function UserTable() {
  useEffect(() => {
    axios.get("http://localhost:8000/api/users").then(setUsers);
  }, []);
}
```

```jsx
// GOOD — component delegates to the service layer
import { getUsers } from "../services/userApi";

function UserTable() {
  useEffect(() => {
    getUsers({ search, role, status })
      .then(setUsers)
      .catch((err) => setError(err.message));
  }, [search, role, status]);
}
```

## References

- `frontend/src/services/userApi.js` — canonical error-normalization + API-call pattern.
- `README.md` §2 (Architecture) and §4 (Project Structure) — layering diagram this section mirrors.
- `.claude/rules/reusability-baseline.md`, `.claude/rules/performance-baseline.md` — cross-cutting rules referenced above.

<!-- ============================================================================ -->
<!-- OPTIONAL sections — keep only what applies to react; DELETE the rest    -->
<!-- (heading + slot). OPTIONAL markers are NOT lint-nagged; once you keep one,    -->
<!-- change its OPTIONAL marker to a real convention. Do not leave empty OPTIONALs.-->
<!-- ============================================================================ -->

## Design system + visual conventions

- Plain modern CSS (no UI framework); custom design system defined in `src/styles/index.css`.
- Components import shared classes/tokens from `src/styles/index.css` — no inline `style={{}}` for anything token-covered (color, spacing, radius).
- Forms follow the existing `UserForm.jsx` layout conventions (label-above-input, inline validation message per field).

## State management

- No global store (Redux/Zustand/Context) — state is local `useState` in `pages/Dashboard.jsx`, passed down via props.
- Server state (users list, dashboard stats) is fetched in `Dashboard.jsx` and re-fetched after every mutation — no client-side cache layer.
- Filter/search state (search text, role, status) lives in `Dashboard.jsx` and is passed to `services/userApi.js` calls as query params, not applied client-side.
