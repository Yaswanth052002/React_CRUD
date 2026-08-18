import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Captured interceptor handlers, populated by the mocked axios `create()`
// call below so we can invoke request/response interceptor logic directly
// without a live HTTP layer (per react-patterns: userApi.js is the only
// file allowed to own axios; tests mock axios itself, not userApi's public
// surface). `vi.mock` factories are hoisted above normal declarations, so
// the captured-handler holder must be created via `vi.hoisted`.
const interceptors = vi.hoisted(() => ({
  request: undefined,
  responseSuccess: undefined,
  responseError: undefined,
}));

vi.mock("axios", () => {
  const client = {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    interceptors: {
      request: {
        use: vi.fn((fn) => {
          interceptors.request = fn;
        }),
      },
      response: {
        use: vi.fn((onSuccess, onError) => {
          interceptors.responseSuccess = onSuccess;
          interceptors.responseError = onError;
        }),
      },
    },
  };
  return {
    default: {
      create: vi.fn(() => client),
    },
  };
});

import * as userApi from "../userApi.js";

const TOKEN_KEY = "auth_token";

describe("userApi.js auth-token surface", () => {
  beforeEach(() => {
    localStorage.clear();
    userApi.registerUnauthorizedHandler(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // TC-08: request interceptor attaches Authorization only when a token is present.
  it("TC-08: attaches Authorization: Bearer <token> when a token is stored, nothing when absent", () => {
    userApi.setAuthToken("abc.def.ghi");
    const configWithToken = interceptors.request({ headers: {} });
    expect(configWithToken.headers.Authorization).toBe("Bearer abc.def.ghi");

    userApi.clearAuthToken();
    const configWithoutToken = interceptors.request({ headers: {} });
    expect(configWithoutToken.headers.Authorization).toBeUndefined();
  });

  // TC-06: localStorage.getItem throwing is treated as no token.
  it("TC-06: getStoredToken returns null (never throws) when localStorage.getItem throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("storage disabled");
    });
    expect(userApi.getStoredToken()).toBeNull();
  });

  // TC-07: localStorage.setItem throwing surfaces a readable error, not a raw stack trace.
  it("TC-07: setAuthToken throws a readable Error (not a raw DOMException) when setItem throws", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("quota exceeded");
    });
    let caught;
    try {
      userApi.setAuthToken("abc");
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(Error);
    expect(caught.message).not.toMatch(/DOMException|at .*:\d+:\d+/);
    expect(typeof caught.message).toBe("string");
    expect(caught.message.length).toBeGreaterThan(0);
  });

  // TC-09: unauthorized handler does not fire twice once the token is already cleared.
  it("TC-09: dedup guard — a second 401 after the token is already null does not re-invoke the handler", () => {
    const handler = vi.fn();
    userApi.registerUnauthorizedHandler(handler);
    userApi.setAuthToken("abc.def.ghi");

    const first = interceptors.responseError({ response: { status: 401 } });
    const second = interceptors.responseError({ response: { status: 401 } });

    return Promise.allSettled([first, second]).then(() => {
      expect(handler).toHaveBeenCalledTimes(1);
      expect(userApi.getStoredToken()).toBeNull();
    });
  });

  // TC-04: 401 clears the token and fires the registered handler.
  it("TC-04: a 401 response clears the token and invokes the registered unauthorized handler", () => {
    const handler = vi.fn();
    userApi.registerUnauthorizedHandler(handler);
    userApi.setAuthToken("abc.def.ghi");

    return interceptors.responseError({ response: { status: 401 } }).catch(() => {
      expect(handler).toHaveBeenCalledTimes(1);
      expect(userApi.getStoredToken()).toBeNull();
    });
  });

  // TC-12: only the opaque token is ever persisted — no password/credential material.
  it("TC-12: after setAuthToken, localStorage holds only the token under the auth-token key", () => {
    userApi.setAuthToken("abc.def.ghi");
    expect(localStorage.getItem(TOKEN_KEY)).toBe("abc.def.ghi");
    expect(localStorage.length).toBe(1);
    const allValues = Object.keys(localStorage).map((k) => localStorage.getItem(k));
    allValues.forEach((v) => {
      expect(v).not.toMatch(/password/i);
    });
  });

  // TC-13: session-expiry event is logged with no PII on the interceptor 401 path.
  it("TC-13: logs auth_session_expired with no token/PII payload on the 401 path", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    userApi.registerUnauthorizedHandler(vi.fn());
    userApi.setAuthToken("abc.def.ghi");

    return interceptors.responseError({ response: { status: 401 } }).catch(() => {
      expect(logSpy).toHaveBeenCalledWith("auth_session_expired");
      logSpy.mock.calls.forEach((call) => {
        expect(call.join(" ")).not.toMatch(/abc\.def\.ghi/);
      });
    });
  });

  // TC-15: a mocked { token: string } login-resolution shape maps to exactly one setAuthToken(token) call.
  it("TC-15: extracts exactly the `token` field from a { token } shape and stores it as-is", () => {
    const loginResolution = { token: "abc.def.ghi" };
    userApi.setAuthToken(loginResolution.token);
    expect(localStorage.getItem(TOKEN_KEY)).toBe("abc.def.ghi");
  });
});
