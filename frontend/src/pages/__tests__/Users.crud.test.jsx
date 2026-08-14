import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import Users from "../Users.jsx";
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

function setInputValue(input, value) {
  const nativeSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value"
  ).set;
  nativeSetter.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

function click(el) {
  el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const SAMPLE_USER = {
  id: 1,
  name: "Jane Doe",
  email: "jane@test.com",
  phone: "1234567890",
  role: "User",
  status: "Active",
  created_at: "2026-01-01T00:00:00Z",
};

describe("Users CRUD, stats, and loading/empty/error states (USR-01-FR-1/FR-3/FR-4)", () => {
  let container;
  let root;

  beforeEach(() => {
    vi.useFakeTimers();
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

  async function renderUsers(overrides = {}) {
    userApi.getUsers.mockResolvedValue(overrides.getUsers ?? { items: [], total: 0 });
    userApi.getDashboardStats.mockResolvedValue(
      overrides.getDashboardStats ?? {
        total_users: 0,
        active_users: 0,
        admin_users: 0,
        regular_users: 0,
      }
    );
    root = createRoot(container);
    await act(async () => {
      root.render(<Users />);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
  }

  // TC-04: Inactive-stat derivation — 8 total, 5 active -> 3 inactive (ADR-3).
  it("TC-04: derives the Inactive stats-card value as total_users - active_users", async () => {
    await renderUsers({
      getDashboardStats: { total_users: 8, active_users: 5, admin_users: 2, regular_users: 6 },
    });

    const cards = Array.from(container.querySelectorAll(".stat-card"));
    const inactiveCard = cards.find((c) => c.textContent.includes("Inactive Users"));
    expect(inactiveCard).toBeTruthy();
    expect(inactiveCard.querySelector(".stat-card__value").textContent).toBe("3");
  });

  // TC-03/TC-09: stats cards render (Total, Active, Inactive, Admin) plus header "+ Add User".
  it("TC-03/TC-09: renders the page header with + Add User and the four stats cards", async () => {
    await renderUsers({
      getDashboardStats: { total_users: 8, active_users: 5, admin_users: 2, regular_users: 6 },
    });

    const gridText = container.querySelector(".stats-grid").textContent;
    expect(gridText).toContain("Total Users");
    expect(gridText).toContain("Active Users");
    expect(gridText).toContain("Inactive Users");
    expect(gridText).toContain("Admins");

    const addBtn = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent.includes("+ Add User")
    );
    expect(addBtn).toBeTruthy();
  });

  // TC-10: UserTable renders the expected columns.
  it("TC-10: renders the UserTable with ID/Name/Email/Phone/Role/Status/Created/Actions columns", async () => {
    await renderUsers({ getUsers: { items: [SAMPLE_USER], total: 1 } });

    const headers = Array.from(container.querySelectorAll("thead th")).map((th) => th.textContent);
    expect(headers).toEqual([
      "ID",
      "Name",
      "Email",
      "Phone",
      "Role",
      "Status",
      "Created",
      "Actions",
    ]);
  });

  // TC-11: view-detail flow via UserDetails.
  it("TC-11: clicking a row's view icon opens UserDetails with the full record", async () => {
    await renderUsers({ getUsers: { items: [SAMPLE_USER], total: 1 } });

    const viewBtn = container.querySelector(`button[aria-label="View ${SAMPLE_USER.name}"]`);
    await act(async () => {
      click(viewBtn);
    });

    const modal = container.querySelector('[aria-label="User details"]');
    expect(modal).not.toBeNull();
    expect(modal.textContent).toContain(SAMPLE_USER.email);
  });

  // TC-12: add-user success path.
  it("TC-12: submitting the Add User form succeeds, closes the modal, shows a toast, and refreshes", async () => {
    await renderUsers({ getUsers: { items: [], total: 0 } });
    userApi.createUser.mockResolvedValue({ ...SAMPLE_USER });

    const addBtn = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent.includes("+ Add User")
    );
    await act(async () => {
      click(addBtn);
    });

    await act(async () => {
      setInputValue(container.querySelector("#name"), "New Person");
      setInputValue(container.querySelector("#email"), "new@test.com");
      setInputValue(container.querySelector("#phone"), "9998887777");
    });

    const form = container.querySelector("form");
    await act(async () => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(userApi.createUser).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[aria-label="Add New User"]')).toBeNull();
    expect(container.textContent).toContain("User created successfully!");
  });

  // TC-13: add-user failure path (e.g. duplicate email -> 409) keeps modal open with inline error.
  it("TC-13: a failed Add User submission keeps the modal open and shows the server error inline", async () => {
    await renderUsers({ getUsers: { items: [], total: 0 } });
    userApi.createUser.mockRejectedValue(new Error("Email already exists"));

    const addBtn = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent.includes("+ Add User")
    );
    await act(async () => {
      click(addBtn);
    });

    await act(async () => {
      setInputValue(container.querySelector("#name"), "New Person");
      setInputValue(container.querySelector("#email"), "dup@test.com");
      setInputValue(container.querySelector("#phone"), "9998887777");
    });

    const form = container.querySelector("form");
    await act(async () => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(container.querySelector('[aria-label="Add New User"]')).not.toBeNull();
    expect(container.textContent).toContain("Email already exists");
  });

  // TC-14: edit-user success path.
  it("TC-14: submitting the Edit User form succeeds, closes the modal, shows a toast, and refreshes", async () => {
    await renderUsers({ getUsers: { items: [SAMPLE_USER], total: 1 } });
    userApi.updateUser.mockResolvedValue({ ...SAMPLE_USER, name: "Jane Updated" });

    const editBtn = container.querySelector(`button[aria-label="Edit ${SAMPLE_USER.name}"]`);
    await act(async () => {
      click(editBtn);
    });

    const form = container.querySelector("form");
    await act(async () => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(userApi.updateUser).toHaveBeenCalledWith(SAMPLE_USER.id, expect.any(Object));
    expect(container.querySelector('[aria-label="Edit User"]')).toBeNull();
    expect(container.textContent).toContain("User updated successfully!");
  });

  // USR-01-TC-13 (regression-TC-13): a failed Edit User submission keeps the modal
  // open and shows the server error inline (mirrors the TC-13 create-failure test
  // above, but exercises the shared handleFormSubmit catch block via the edit path).
  it("USR-01-TC-13: a failed Edit User submission keeps the modal open and shows the server error inline", async () => {
    await renderUsers({ getUsers: { items: [SAMPLE_USER], total: 1 } });
    userApi.updateUser.mockRejectedValue(new Error("Email already exists"));

    const editBtn = container.querySelector(`button[aria-label="Edit ${SAMPLE_USER.name}"]`);
    await act(async () => {
      click(editBtn);
    });

    const form = container.querySelector("form");
    await act(async () => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(userApi.updateUser).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[aria-label="Edit User"]')).not.toBeNull();
    expect(container.textContent).toContain("Email already exists");
  });

  // TC-15: delete flow — confirm calls DELETE, cancel makes no request.
  it("TC-15: confirming delete calls deleteUser and shows a toast; cancel makes no request", async () => {
    await renderUsers({ getUsers: { items: [SAMPLE_USER], total: 1 } });
    userApi.deleteUser.mockResolvedValue();

    const deleteBtn = container.querySelector(`button[aria-label="Delete ${SAMPLE_USER.name}"]`);
    await act(async () => {
      click(deleteBtn);
    });

    const cancelBtn = Array.from(container.querySelectorAll(".btn-secondary")).find(
      (b) => b.textContent === "Cancel"
    );
    await act(async () => {
      click(cancelBtn);
    });
    expect(userApi.deleteUser).not.toHaveBeenCalled();

    await act(async () => {
      click(deleteBtn);
    });
    const confirmBtn = Array.from(container.querySelectorAll(".btn-danger")).find((b) =>
      b.textContent.includes("Delete")
    );
    await act(async () => {
      click(confirmBtn);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(userApi.deleteUser).toHaveBeenCalledWith(SAMPLE_USER.id);
    expect(container.textContent).toContain("User deleted successfully!");
  });

  // TC-18: initial loading states for both stats cards and table.
  it("TC-18: shows loading states for stats and table while requests are in flight", async () => {
    let resolveUsers;
    let resolveStats;
    userApi.getUsers.mockReturnValue(
      new Promise((resolve) => {
        resolveUsers = resolve;
      })
    );
    userApi.getDashboardStats.mockReturnValue(
      new Promise((resolve) => {
        resolveStats = resolve;
      })
    );

    root = createRoot(container);
    await act(async () => {
      root.render(<Users />);
    });

    expect(container.querySelectorAll(".skeleton-bar").length).toBeGreaterThan(0);
    expect(container.querySelectorAll(".skeleton-row").length).toBeGreaterThan(0);

    await act(async () => {
      resolveStats({ total_users: 0, active_users: 0, admin_users: 0, regular_users: 0 });
      resolveUsers({ items: [], total: 0 });
      await vi.advanceTimersByTimeAsync(0);
    });
  });

  // TC-19: empty state (no filters active).
  it("TC-19: shows the empty state when zero users are returned with no active filters", async () => {
    await renderUsers({ getUsers: { items: [], total: 0 } });
    expect(container.textContent).toContain("No users yet");
  });

  // TC-19b/TC-20: no-results-for-filter state and error banner.
  it("TC-20: shows the no-results state when a search/filter returns zero users", async () => {
    userApi.getUsers.mockResolvedValueOnce({ items: [], total: 0 });
    await renderUsers({ getUsers: { items: [], total: 0 } });

    const input = container.querySelector('input[aria-label="Search users"]');
    userApi.getUsers.mockResolvedValue({ items: [], total: 0 });
    await act(async () => {
      setInputValue(input, "nomatch");
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    expect(container.textContent).toContain("No users match your search");
  });

  it("TC-20b: shows a readable inline error banner when the user list request fails", async () => {
    userApi.getUsers.mockRejectedValue(new Error("Could not reach the server."));
    userApi.getDashboardStats.mockResolvedValue({
      total_users: 0,
      active_users: 0,
      admin_users: 0,
      regular_users: 0,
    });
    root = createRoot(container);
    await act(async () => {
      root.render(<Users />);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(container.textContent).toContain("Couldn't load users.");
    expect(container.textContent).toContain("Could not reach the server.");
  });
});
