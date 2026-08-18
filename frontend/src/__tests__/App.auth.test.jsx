import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import App from "../App.jsx";
import * as userApi from "../services/userApi.js";

// Mock at the service boundary (per react-patterns: components never call
// axios directly — mock ../services/userApi.js, not axios).
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

// TC-14 proxy scaffolding (see FLAGS.md AF-04): App.jsx keeps
// `sessionExpiredMessage` as internal state that isn't threaded to any DOM
// surface yet (LoginScreen — the only thing that would render it in an
// aria-live region — is AUTH-01/AUTH-05 scope). To assert AUTH-04's actual
// owned behavior (the state is set to the exact required copy, not just
// "some truthy value"), this wraps React's `useState` to observe the values
// passed to every setter across the render tree — delegating to the real
// hook unchanged — and checks whether the exact session-expired string was
// ever set. This is NOT a DOM/aria-live check; it cannot be until AUTH-05
// lands LoginScreen.
const { capturedStateSets } = vi.hoisted(() => ({ capturedStateSets: [] }));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useState: (initial) => {
      const [value, setValue] = actual.useState(initial);
      const trackedSetValue = (next) => {
        capturedStateSets.push(next);
        return setValue(next);
      };
      return [value, trackedSetValue];
    },
  };
});

// Duplicated here (App.jsx does not export it) because this is a black-box
// behavioral assertion, not a white-box import of the implementation detail.
const SESSION_EXPIRED_MESSAGE = "Your session has expired. Please log in again.";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function base64url(obj) {
  return btoa(JSON.stringify(obj))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function makeToken(exp) {
  return `${base64url({ alg: "none" })}.${base64url({ exp })}.signature`;
}

describe("App.jsx auth-state restoration on mount", () => {
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
    capturedStateSets.length = 0;
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

  // TC-01: a valid, unexpired token restores the session without treating it as expired.
  it("TC-01: a valid unexpired token does not trigger the session-expired path", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    userApi.getStoredToken.mockReturnValue(makeToken(Math.floor(Date.now() / 1000) + 3600));

    await renderApp();

    expect(userApi.clearAuthToken).not.toHaveBeenCalled();
    expect(logSpy).not.toHaveBeenCalledWith("auth_session_expired");
  });

  // TC-02: no stored token mounts cleanly with no session-expired handling triggered.
  it("TC-02: no stored token mounts without a session-expired event (nothing to expire)", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    userApi.getStoredToken.mockReturnValue(null);

    await renderApp();

    expect(userApi.clearAuthToken).not.toHaveBeenCalled();
    expect(logSpy).not.toHaveBeenCalledWith("auth_session_expired");
  });

  // TC-03: an expired stored token is cleared and logged as a session-expiry event.
  it("TC-03: an expired stored token is cleared and auth_session_expired is logged", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    userApi.getStoredToken.mockReturnValue(makeToken(Math.floor(Date.now() / 1000) - 3600));

    await renderApp();

    expect(userApi.clearAuthToken).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalledWith("auth_session_expired");
  });

  // TC-05: a malformed/unparseable token is treated as no token, with no uncaught exception.
  it("TC-05: a malformed token is cleared with no uncaught exception", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    userApi.getStoredToken.mockReturnValue("not-a-valid-jwt");

    await expect(renderApp()).resolves.not.toThrow();

    expect(userApi.clearAuthToken).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalledWith("auth_session_expired");
  });

  // TC-10 (partial — this story's scope): the unauthorized-handler is registered on mount and,
  // when invoked, does not throw. Full prop-threading to LoginScreen's `sessionExpiredMessage`
  // (never `authError`) is AUTH-05's rendering scope; see FLAGS.md for the noted gap.
  it("TC-10 (partial): registers the unauthorized handler on mount and it runs without throwing", async () => {
    userApi.getStoredToken.mockReturnValue(null);

    await renderApp();

    expect(userApi.registerUnauthorizedHandler).toHaveBeenCalledTimes(1);
    const registeredHandler = userApi.registerUnauthorizedHandler.mock.calls[0][0];
    expect(() => {
      act(() => {
        registeredHandler();
      });
    }).not.toThrow();
  });

  // TC-14 (partial — this story's scope): AUTH-04 owns setting the exact
  // required session-expired copy into state on the unauthorized-handler
  // path, and NOT setting it when there is nothing to expire. Full TC-14 (an
  // aria-live region rendering this text on the Login screen after redirect)
  // requires `LoginScreen`, which is AUTH-01/AUTH-05 scope — see FLAGS.md
  // AF-04. This test cannot substitute for that DOM/aria-live check.
  it("TC-14 (partial): sessionExpiredMessage state is set to the exact required string when the unauthorized handler fires", async () => {
    userApi.getStoredToken.mockReturnValue(null);

    await renderApp();

    const registeredHandler = userApi.registerUnauthorizedHandler.mock.calls[0][0];
    act(() => {
      registeredHandler();
    });

    expect(capturedStateSets).toContain(SESSION_EXPIRED_MESSAGE);
  });

  // TC-14 (partial — this story's scope): the counterpart to the above — when
  // there is nothing to expire (no stored token), the exact session-expired
  // string is never set.
  it("TC-14 (partial): sessionExpiredMessage state is never set to the required string when there is nothing to expire", async () => {
    userApi.getStoredToken.mockReturnValue(null);

    await renderApp();

    expect(capturedStateSets).not.toContain(SESSION_EXPIRED_MESSAGE);
  });
});
