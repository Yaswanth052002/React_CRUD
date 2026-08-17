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

  const SAMPLE_USERS = [
    { id: 1, name: "Alice Example", email: "alice@test.com", phone: "5551234567", role: "Admin", status: "Active", created_at: "2026-08-10T00:00:00Z" },
    { id: 2, name: "Bob Example", email: "bob@test.com", phone: "5551234568", role: "User", status: "Active", created_at: "2026-08-11T00:00:00Z" },
    { id: 3, name: "Carol Example", email: "carol@test.com", phone: "5551234569", role: "User", status: "Inactive", created_at: "2026-08-12T00:00:00Z" },
    { id: 4, name: "Dana Example", email: "dana@test.com", phone: "5551234570", role: "User", status: "Active", created_at: "2026-08-13T00:00:00Z" },
    { id: 5, name: "Eve Example", email: "eve@test.com", phone: "5551234571", role: "User", status: "Active", created_at: "2026-08-14T00:00:00Z" },
    { id: 6, name: "Frank Example", email: "frank@test.com", phone: "5551234572", role: "User", status: "Active", created_at: "2026-08-15T00:00:00Z" },
  ];

  beforeEach(() => {
    userApi.getDashboardStats.mockResolvedValue({
      total_users: 8,
      active_users: 5,
      admin_users: 2,
      regular_users: 6,
    });
    userApi.getUsers.mockResolvedValue({ items: SAMPLE_USERS, total: SAMPLE_USERS.length, page: 1, page_size: 50 });
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
    // As of SRF-01-FR-3, Dashboard also fetches the users page once (read-only) to derive the
    // "Recent Users" preview — search/filter/CRUD still live exclusively on Users.jsx.
    expect(userApi.getUsers).toHaveBeenCalledTimes(1);
    expect(userApi.getUsers).toHaveBeenCalledWith({ page: 1, pageSize: 50 });
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

  // SRF-01-TC-10: Inactive Users is derived client-side as total_users - active_users.
  it("SRF-01-TC-10: derives Inactive Users as total_users - active_users", async () => {
    await renderDashboard();

    const gridText = container.querySelector(".stats-grid").textContent;
    expect(gridText).toContain("Inactive Users");
    // 8 total - 5 active = 3 inactive (mocked stats from beforeEach).
    const cards = Array.from(container.querySelectorAll(".stat-card"));
    const inactiveCard = cards.find((c) => c.textContent.includes("Inactive Users"));
    expect(inactiveCard.querySelector(".stat-card__value").textContent).toBe("3");
  });

  // SRF-01-TC-11: all five stat cards render with the correct labels and values.
  it("SRF-01-TC-11: renders all five User Overview stat cards with correct values", async () => {
    await renderDashboard();

    const cards = Array.from(container.querySelectorAll(".stat-card"));
    const byLabel = (label) => cards.find((c) => c.textContent.includes(label));

    expect(byLabel("Total Users").querySelector(".stat-card__value").textContent).toBe("8");
    expect(byLabel("Active Users").querySelector(".stat-card__value").textContent).toBe("5");
    expect(byLabel("Inactive Users").querySelector(".stat-card__value").textContent).toBe("3");
    expect(byLabel("Admins").querySelector(".stat-card__value").textContent).toBe("2");
    expect(byLabel("Regular Users").querySelector(".stat-card__value").textContent).toBe("6");
  });

  // SRF-01-TC-12: the overview is wrapped in a bordered panel with a heading, not a bare grid.
  it("SRF-01-TC-12: wraps the User Overview stats in a titled panel section", async () => {
    await renderDashboard();

    const section = container.querySelector('section[aria-labelledby="user-overview-heading"]');
    expect(section).not.toBeNull();
    expect(section.classList.contains("panel")).toBe(true);
    expect(section.querySelector("#user-overview-heading").textContent).toBe("User Overview");
    expect(section.querySelector(".stats-grid")).not.toBeNull();
  });

  // SRF-01-TC-13: Dashboard introduces no CRUD/mutation service calls.
  it("SRF-01-TC-13: calls getDashboardStats and getUsers exactly once each, and no CRUD functions", async () => {
    await renderDashboard();

    expect(userApi.getDashboardStats).toHaveBeenCalledTimes(1);
    // As of SRF-01-FR-3, Dashboard calls getUsers once (read-only, for the Recent Users
    // preview) but never a per-record getUser or any mutation function.
    expect(userApi.getUsers).toHaveBeenCalledTimes(1);
    expect(userApi.getUser).not.toHaveBeenCalled();
    expect(userApi.createUser).not.toHaveBeenCalled();
    expect(userApi.updateUser).not.toHaveBeenCalled();
    expect(userApi.deleteUser).not.toHaveBeenCalled();
  });

  // SRF-01-TC-16: User Status panel renders Active/Inactive counts with proportional bars.
  it("SRF-01-TC-16: renders the User Status breakdown panel with Active/Inactive counts and bar widths", async () => {
    await renderDashboard();

    const section = container.querySelector('section[aria-labelledby="breakdown-user-status"]');
    expect(section).not.toBeNull();
    const rows = Array.from(section.querySelectorAll(".breakdown-row"));
    const byLabel = (label) => rows.find((r) => r.textContent.includes(label));

    const active = byLabel("Active");
    expect(active.querySelector(".breakdown-row__value").textContent).toBe("5");
    expect(active.querySelector(".stat-card__bar-fill").style.width).toBe("63%"); // round(5/8*100)

    const inactive = byLabel("Inactive");
    expect(inactive.querySelector(".breakdown-row__value").textContent).toBe("3");
    expect(inactive.querySelector(".stat-card__bar-fill").style.width).toBe("38%"); // round(3/8*100)
  });

  // SRF-01-TC-17: Users by Role panel renders Admin/Regular counts with proportional bars.
  it("SRF-01-TC-17: renders the Users by Role breakdown panel with Admin/Regular counts and bar widths", async () => {
    await renderDashboard();

    const section = container.querySelector('section[aria-labelledby="breakdown-users-by-role"]');
    expect(section).not.toBeNull();
    const rows = Array.from(section.querySelectorAll(".breakdown-row"));
    const byLabel = (label) => rows.find((r) => r.textContent.includes(label));

    expect(byLabel("Admins").querySelector(".breakdown-row__value").textContent).toBe("2");
    expect(byLabel("Regular Users").querySelector(".breakdown-row__value").textContent).toBe("6");
  });

  // SRF-01-TC-18: Recent Users table shows the 5 most-recently-created users, newest first.
  it("SRF-01-TC-18: shows the 5 most-recently-created users in the Recent Users table", async () => {
    await renderDashboard();

    const section = container.querySelector('section[aria-labelledby="recent-users-heading"]');
    expect(section).not.toBeNull();

    const headerText = section.querySelector("thead").textContent;
    expect(headerText).toContain("Name");
    expect(headerText).toContain("Email");
    expect(headerText).toContain("Role");
    expect(headerText).toContain("Status");
    expect(headerText).toContain("Created");

    const rows = Array.from(section.querySelectorAll("tbody tr"));
    expect(rows).toHaveLength(5);
    // SAMPLE_USERS has 6 users; newest-first by created_at excludes the oldest (Alice, id 1).
    expect(rows[0].textContent).toContain("Frank Example");
    expect(rows.some((r) => r.textContent.includes("Alice Example"))).toBe(false);
  });

  // SRF-01-TC-20: "View All Users →" calls onNavigate("users").
  it('SRF-01-TC-20: calls onNavigate("users") when "View All Users" is activated', async () => {
    const onNavigate = vi.fn();
    root = createRoot(container);
    await act(async () => {
      root.render(<Dashboard onNavigate={onNavigate} />);
    });

    const button = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent.includes("View All Users")
    );
    expect(button).not.toBeUndefined();

    await act(async () => {
      button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onNavigate).toHaveBeenCalledWith("users");
  });

  // SRF-01-TC-21 (regression): existing behavior is unaffected — see backend/tests/test_users.py
  // and frontend/src/pages/__tests__/Users search/filter/CRUD coverage for the Users.jsx side of
  // this regression guard; this Dashboard suite itself is the frontend regression evidence that
  // Dashboard.jsx's pre-existing getDashboardStats-driven stats cards still render unchanged
  // (see TC-11/TC-12/TC-21 above) alongside the new getUsers-driven Recent Users section.
});
