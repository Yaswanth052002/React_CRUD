import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import Dashboard from "../Dashboard.jsx";
import * as userApi from "../../services/userApi.js";

// Mock at the service boundary (per react-patterns: components/pages never call
// Axios directly — mock ../services/userApi.js, not axios).
vi.mock("../../services/userApi.js", () => ({
  getUsers: vi.fn(),
  getUser: vi.fn(),
  createUser: vi.fn(),
  updateUser: vi.fn(),
  deleteUser: vi.fn(),
  getDashboardStats: vi.fn(),
}));

// Tells React 18 this jsdom environment supports `act(...)`, silencing the
// spurious "environment not configured" warning (no behavior change).
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("Dashboard overview (USR-01-FR-2, post-extraction)", () => {
  let container;
  let root;

  beforeEach(() => {
    userApi.getDashboardStats.mockResolvedValue({
      total_users: 8,
      active_users: 5,
      admin_users: 2,
      regular_users: 6,
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
  });

  async function renderDashboard() {
    root = createRoot(container);
    await act(async () => {
      root.render(<Dashboard />);
    });
  }

  // TC-21: stats cards render for Total/Active/Admins/Regular Users.
  it("TC-21: renders the Total/Active/Admins/Regular Users stats cards once stats resolve", async () => {
    await renderDashboard();

    const labels = Array.from(container.querySelectorAll(".stats-grid")).map((el) => el.textContent);
    const gridText = labels.join(" ");
    expect(gridText).toContain("Total Users");
    expect(gridText).toContain("Active Users");
    expect(gridText).toContain("Admins");
    expect(gridText).toContain("Regular Users");
    expect(userApi.getDashboardStats).toHaveBeenCalledTimes(1);
    // Dashboard no longer fetches the user list at all (search/filter/CRUD moved to Users.jsx).
    expect(userApi.getUsers).not.toHaveBeenCalled();
  });

  // TC-22: loadingStats skeleton state is shown before stats resolve, and there is
  // no search input on the trimmed Dashboard (that toolbar moved to Users.jsx).
  it("TC-22: shows the loadingStats skeleton state and has no search input", async () => {
    let resolveStats;
    userApi.getDashboardStats.mockReturnValue(
      new Promise((resolve) => {
        resolveStats = resolve;
      })
    );

    root = createRoot(container);
    await act(async () => {
      root.render(<Dashboard />);
    });

    // While the stats promise is pending, the stats-grid renders in its loading state.
    expect(container.querySelector(".stats-grid")).not.toBeNull();
    expect(container.querySelector('input[aria-label="Search users"]')).toBeNull();

    await act(async () => {
      resolveStats({ total_users: 8, active_users: 5, admin_users: 2, regular_users: 6 });
      await Promise.resolve();
    });

    expect(container.querySelector('input[aria-label="Search users"]')).toBeNull();
  });
});
