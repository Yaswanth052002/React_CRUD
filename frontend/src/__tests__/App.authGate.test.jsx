import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import App from "../App.jsx";
import * as userApi from "../services/userApi.js";
import LoginScreen from "../components/LoginScreen.jsx";

// Mock at the service boundary (per react-patterns: components never call
// axios directly — mock ../services/userApi.js, not axios). getStoredToken
// controls isAuthenticated's initial value; registerUnauthorizedHandler lets
// this suite capture and invoke the true->false transition (TC-06/TC-07).
vi.mock("../services/userApi.js", () => ({
  getUsers: vi.fn(),
  getUser: vi.fn(),
  createUser: vi.fn(),
  updateUser: vi.fn(),
  deleteUser: vi.fn(),
  getDashboardStats: vi.fn(),
  getStoredToken: vi.fn(),
  setAuthToken: vi.fn(),
  clearAuthToken: vi.fn(),
  registerUnauthorizedHandler: vi.fn(),
}));

// Mock LoginScreen to a stub that exposes the exact props it received (for
// the no-authError contract check, TC-08) and renders a control that invokes
// the received onLoginSuccess callback, plus the received sessionExpiredMessage
// verbatim (TC-07). Never re-implements LoginScreen's own internals.
vi.mock("../components/LoginScreen.jsx", () => ({
  default: vi.fn(({ onLoginSuccess, sessionExpiredMessage }) => (
    <div data-testid="login-screen">
      {sessionExpiredMessage && (
        <div data-testid="session-expired-message">{sessionExpiredMessage}</div>
      )}
      <button data-testid="mock-login-success" onClick={() => onLoginSuccess("mock-token")}>
        mock login
      </button>
    </div>
  )),
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

function click(el) {
  el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("App.jsx auth gate (AUTH-05-TC-01..TC-11)", () => {
  let container;
  let root;

  beforeEach(() => {
    vi.useFakeTimers();
    userApi.getUsers.mockResolvedValue({ items: [], total: 0 });
    userApi.getDashboardStats.mockResolvedValue({
      total_users: 0,
      active_users: 0,
      admin_users: 0,
      regular_users: 0,
    });
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  async function renderApp() {
    root = createRoot(container);
    await act(async () => {
      root.render(<App />);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
  }

  function usersNavItem() {
    return Array.from(container.querySelectorAll(".nav-item")).find(
      (b) => b.textContent === "Users"
    );
  }

  function lastLoginScreenProps() {
    const calls = LoginScreen.mock.calls;
    return calls[calls.length - 1][0];
  }

  // TC-01: unauthenticated visitor sees Login-only view, no Sidebar/Header mounted.
  it("TC-01: renders LoginScreen only, with Sidebar/Header/protected views absent from the DOM", async () => {
    userApi.getStoredToken.mockReturnValue(null);

    await renderApp();

    expect(container.querySelector('[data-testid="login-screen"]')).not.toBeNull();
    expect(container.querySelector(".sidebar")).toBeNull();
    expect(container.querySelector(".topbar")).toBeNull();
    expect(container.querySelector(".app-shell")).toBeNull();
  });

  // TC-02: no rendered control can set activeView to a protected view while unauthenticated.
  it("TC-02: no nav control capable of setting activeView is exposed while unauthenticated", async () => {
    userApi.getStoredToken.mockReturnValue(null);

    await renderApp();

    expect(container.querySelectorAll(".nav-item").length).toBe(0);
  });

  // TC-03: authenticated user sees Sidebar with exactly three working nav entries (regression).
  it("TC-03: authenticated user sees exactly three nav entries and can switch views", async () => {
    userApi.getStoredToken.mockReturnValue(VALID_TOKEN);

    await renderApp();

    const navItems = container.querySelectorAll(".nav-item");
    expect(navItems.length).toBe(3);
    expect(Array.from(navItems).map((b) => b.textContent)).toEqual([
      "Dashboard",
      "Users",
      "Settings",
    ]);

    await act(async () => {
      click(usersNavItem());
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(container.querySelector('input[aria-label="Search users"]')).not.toBeNull();
  });

  // TC-04: successful login transitions directly to Dashboard without reload.
  it("TC-04: onLoginSuccess transitions to the authenticated Dashboard tree", async () => {
    userApi.getStoredToken.mockReturnValue(null);

    await renderApp();

    await act(async () => {
      click(container.querySelector('[data-testid="mock-login-success"]'));
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(container.querySelector('[data-testid="login-screen"]')).toBeNull();
    expect(container.querySelector(".sidebar")).not.toBeNull();
    expect(container.querySelector(".topbar__title").textContent).toBe("Dashboard");
  });

  // TC-05: post-login activeView resets to dashboard even if a prior session left it on users.
  it("TC-05: activeView resets to dashboard on login even after a prior users-view session", async () => {
    userApi.getStoredToken.mockReturnValue(VALID_TOKEN);
    await renderApp();

    // Leave the prior session on the Users view.
    await act(async () => {
      click(usersNavItem());
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(container.querySelector('input[aria-label="Search users"]')).not.toBeNull();

    // Session expires -> falls back to Login.
    const registeredHandler = userApi.registerUnauthorizedHandler.mock.calls[0][0];
    await act(async () => {
      registeredHandler();
    });

    // Log in again.
    await act(async () => {
      click(container.querySelector('[data-testid="mock-login-success"]'));
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(container.querySelector(".topbar__title").textContent).toBe("Dashboard");
    expect(container.querySelector('input[aria-label="Search users"]')).toBeNull();
  });

  // TC-06: auth state becoming invalid falls back to Login-only, unmounting the stale protected view.
  it("TC-06: isAuthenticated flipping false unmounts the protected tree and renders LoginScreen", async () => {
    userApi.getStoredToken.mockReturnValue(VALID_TOKEN);
    await renderApp();

    await act(async () => {
      click(usersNavItem());
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(container.querySelector('input[aria-label="Search users"]')).not.toBeNull();

    const registeredHandler = userApi.registerUnauthorizedHandler.mock.calls[0][0];
    await act(async () => {
      registeredHandler();
    });

    expect(container.querySelector(".sidebar")).toBeNull();
    expect(container.querySelector(".topbar")).toBeNull();
    expect(container.querySelector('input[aria-label="Search users"]')).toBeNull();
    expect(container.querySelector('[data-testid="login-screen"]')).not.toBeNull();
  });

  // TC-07: sessionExpiredMessage is threaded through to LoginScreen unchanged on session expiry.
  it("TC-07: sessionExpiredMessage reaches LoginScreen verbatim after session expiry", async () => {
    userApi.getStoredToken.mockReturnValue(VALID_TOKEN);
    await renderApp();

    const registeredHandler = userApi.registerUnauthorizedHandler.mock.calls[0][0];
    await act(async () => {
      registeredHandler();
    });

    const message = container.querySelector('[data-testid="session-expired-message"]');
    expect(message).not.toBeNull();
    expect(message.textContent).toBe("Your session has expired. Please log in again.");
  });

  // TC-08: no authError prop is ever passed to LoginScreen.
  it("TC-08: LoginScreen is never called with an authError prop", async () => {
    userApi.getStoredToken.mockReturnValue(null);
    await renderApp();

    await act(async () => {
      click(container.querySelector('[data-testid="mock-login-success"]'));
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(LoginScreen.mock.calls.length).toBeGreaterThan(0);
    for (const [props] of LoginScreen.mock.calls) {
      expect(Object.keys(props).sort()).toEqual(["onLoginSuccess", "sessionExpiredMessage"]);
      expect(props).not.toHaveProperty("authError");
    }
  });

  // TC-09: auth-gate branch adds no additional network round trip on login/logout toggle.
  it("TC-09: no userApi calls fire while unauthenticated, across a false->true->false toggle", async () => {
    userApi.getStoredToken.mockReturnValue(null);
    await renderApp();

    expect(userApi.getUsers).not.toHaveBeenCalled();
    expect(userApi.getDashboardStats).not.toHaveBeenCalled();

    await act(async () => {
      click(container.querySelector('[data-testid="mock-login-success"]'));
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    const dashboardCallsAfterLogin = userApi.getDashboardStats.mock.calls.length;
    const usersCallsAfterLogin = userApi.getUsers.mock.calls.length;

    const registeredHandler = userApi.registerUnauthorizedHandler.mock.calls[0][0];
    await act(async () => {
      registeredHandler();
    });

    // No further calls are made once back on the unauthenticated branch —
    // the auth-gate re-render itself issues no network request.
    expect(userApi.getDashboardStats.mock.calls.length).toBe(dashboardCallsAfterLogin);
    expect(userApi.getUsers.mock.calls.length).toBe(usersCallsAfterLogin);
  });

  // TC-10: protected components do not mount (not merely CSS-hide) when unauthenticated.
  it("TC-10: no protected view mounts and no protected-endpoint call fires when unauthenticated", async () => {
    userApi.getStoredToken.mockReturnValue(null);

    await renderApp();

    expect(container.querySelector(".sidebar")).toBeNull();
    expect(container.querySelector(".topbar")).toBeNull();
    expect(container.querySelector(".page")).toBeNull();
    expect(userApi.getUsers).not.toHaveBeenCalled();
    expect(userApi.getDashboardStats).not.toHaveBeenCalled();
  });

  // TC-11: Sidebar nav-item buttons remain keyboard-reachable with visible focus when authenticated.
  it("TC-11: nav-item buttons are Tab-reachable in order and carry no focus-outline override", async () => {
    userApi.getStoredToken.mockReturnValue(VALID_TOKEN);
    await renderApp();

    const navItems = Array.from(container.querySelectorAll(".nav-item"));
    expect(navItems.length).toBe(3);

    for (const button of navItems) {
      // Native <button> elements are keyboard-focusable by default; no
      // explicit tabIndex=-1 (which would remove them from Tab order) and no
      // `disabled` attribute (which would do the same).
      expect(button.tagName).toBe("BUTTON");
      expect(button.tabIndex).not.toBe(-1);
      expect(button.disabled).toBe(false);

      button.focus();
      expect(document.activeElement).toBe(button);

      // No inline style/class suppresses the global `:focus-visible` outline
      // rule (src/styles/index.css) that gives every focused control its
      // visible outline.
      expect(button.style.outline).toBe("");
    }
  });
});
