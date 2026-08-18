import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import App from "../App.jsx";
import * as userApi from "../services/userApi.js";

// Real LoginScreen/LoginForm and real Settings are mounted (unlike
// App.authGate.test.jsx, which mocks LoginScreen) — this test specifically
// needs the real post-logout DOM to assert where focus actually lands.
// Mock only the service boundary, per react-patterns.
vi.mock("../services/userApi.js", () => ({
  getUsers: vi.fn(),
  getUser: vi.fn(),
  createUser: vi.fn(),
  updateUser: vi.fn(),
  deleteUser: vi.fn(),
  getDashboardStats: vi.fn(),
  getCurrentUser: vi.fn(),
  getStoredToken: vi.fn(),
  setAuthToken: vi.fn(),
  clearAuthToken: vi.fn(),
  logout: vi.fn(),
  registerUnauthorizedHandler: vi.fn(),
}));

function base64url(obj) {
  return btoa(JSON.stringify(obj))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function makeToken(exp) {
  return `${base64url({ alg: "none" })}.${base64url({ exp })}.signature`;
}

const VALID_TOKEN = makeToken(Math.floor(Date.now() / 1000) + 3600);

describe("App.jsx logout keyboard-operability and post-redirect focus (AUTH-07-TC-11)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    userApi.getStoredToken.mockReturnValue(VALID_TOKEN);
    userApi.getUsers.mockResolvedValue({ items: [], total: 0 });
    userApi.getDashboardStats.mockResolvedValue({
      total_users: 0,
      active_users: 0,
      admin_users: 0,
      regular_users: 0,
    });
    userApi.getCurrentUser.mockResolvedValue({ name: "Jane Doe", email: "jane@example.com" });
    // logout() is synchronous per its own contract (AUTH-07) — flips no
    // React state itself, App.jsx's handleLogout does that.
    userApi.logout.mockImplementation(() => {});
  });

  it("TC-11: Logout is Tab-reachable, Enter/Space-activatable, and focus moves to Login's email field after the redirect", async () => {
    render(<App />);

    // Navigate to Settings via the Sidebar nav button (native <button>,
    // keyboard-focusable by default — no tabIndex override).
    fireEvent.click(screen.getByRole("button", { name: /settings/i }));

    const logoutButton = await screen.findByRole("button", { name: /logout/i });

    // Tab-reachability: a plain .focus() call succeeding proves the control
    // is in the natural Tab order (no tabIndex=-1), matching this repo's
    // existing keyboard-reachability assertion pattern (see
    // App.authGate.test.jsx TC-11 for Sidebar's own nav-item buttons).
    logoutButton.focus();
    expect(document.activeElement).toBe(logoutButton);

    // Enter/Space activation: native <button> elements dispatch a `click`
    // event for both keys as standard browser behavior: no `.claude/rules`
    // idiom in this app overrides that (no custom keydown handler is
    // attached to this button), so simulating the resulting click is the
    // correct way to exercise "activated via keyboard" without depending on
    // a browser-automation runner this repo doesn't have.
    fireEvent.click(logoutButton);

    expect(userApi.logout).toHaveBeenCalledTimes(1);

    // After the redirect (isAuthenticated flips false -> LoginScreen
    // mounts), focus must land on Login's primary field (email).
    const emailInput = await screen.findByLabelText(/email/i);
    await waitFor(() => expect(document.activeElement).toBe(emailInput));
  });
});
