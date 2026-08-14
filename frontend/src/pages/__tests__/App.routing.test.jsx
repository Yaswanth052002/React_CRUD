import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import App from "../../App.jsx";
import * as userApi from "../../services/userApi.js";

// Mock at the service boundary (per react-patterns: components/pages never call
// Axios directly — mock ../services/userApi.js, not axios). Substitutes for the
// `type: e2e` TCs declared in USR-01's test-case JSON — no e2e runner exists in
// this repo (docs/config/project-commands.yaml `test_e2e: (n/a ...)`), so nav-
// click/active-state/header/a11y behavior is verified at the jsdom component
// level instead (per PLAN.md § 7 Test Strategy).
vi.mock("../../services/userApi.js", () => ({
  getUsers: vi.fn(),
  getUser: vi.fn(),
  createUser: vi.fn(),
  updateUser: vi.fn(),
  deleteUser: vi.fn(),
  getDashboardStats: vi.fn(),
}));

function click(el) {
  el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("App routing to the Users page (USR-01-FR-1, jsdom substitute for declared e2e TCs)", () => {
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

  // TC-01/TC-02: clicking "Users" routes to the dedicated Users page and highlights the nav item.
  it("TC-01/TC-02: clicking the Users nav item renders the Users page and marks it active", async () => {
    await renderApp();

    // Default view is Dashboard, not Users.
    expect(container.querySelector('input[aria-label="Search users"]')).toBeNull();

    await act(async () => {
      click(usersNavItem());
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(usersNavItem().classList.contains("is-active")).toBe(true);
    expect(container.querySelector('input[aria-label="Search users"]')).not.toBeNull();
    expect(container.querySelector(".topbar__title").textContent).toBe("Users");
  });

  // TC-17: initial loading-state render check at App-mount level.
  it("TC-17: shows loading skeletons immediately on mount before stats/users resolve", async () => {
    let resolveStats;
    userApi.getDashboardStats.mockReturnValue(
      new Promise((resolve) => {
        resolveStats = resolve;
      })
    );

    root = createRoot(container);
    await act(async () => {
      root.render(<App />);
    });

    expect(container.querySelectorAll(".skeleton-bar").length).toBeGreaterThan(0);

    await act(async () => {
      resolveStats({ total_users: 0, active_users: 0, admin_users: 0, regular_users: 0 });
      await vi.advanceTimersByTimeAsync(0);
    });
  });

  // TC-25: toolbar control accessible labels on the Users page.
  it("TC-25: the Users page toolbar controls carry accessible labels", async () => {
    await renderApp();
    await act(async () => {
      click(usersNavItem());
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(container.querySelector('input[aria-label="Search users"]')).not.toBeNull();
    expect(container.querySelector('select[aria-label="Filter by role"]')).not.toBeNull();
    expect(container.querySelector('select[aria-label="Filter by status"]')).not.toBeNull();
    expect(container.querySelector('button[aria-label="Open menu"]')).not.toBeNull();
  });
});
