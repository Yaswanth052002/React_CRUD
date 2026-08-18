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

function percentile(values, p) {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

describe("App.jsx mount-to-auth-state-set performance (TC-11 / NFR-performance)", () => {
  beforeEach(() => {
    userApi.getUsers.mockResolvedValue({ items: [], total: 0 });
    userApi.getDashboardStats.mockResolvedValue({
      total_users: 0,
      active_users: 0,
      admin_users: 0,
      regular_users: 0,
    });
    userApi.getStoredToken.mockReturnValue(makeToken(Math.floor(Date.now() / 1000) + 3600));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("TC-11: p95 mount-to-isAuthenticated-set latency is under 100ms across 100 iterations", async () => {
    const durations = [];

    for (let i = 0; i < 100; i++) {
      const container = document.createElement("div");
      document.body.appendChild(container);
      const root = createRoot(container);

      const start = performance.now();
      await act(async () => {
        root.render(<App />);
      });
      durations.push(performance.now() - start);

      await act(async () => {
        root.unmount();
      });
      container.remove();
    }

    const p95 = percentile(durations, 95);
    expect(p95).toBeLessThan(100);
  });
});
