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

// React tracks the native input value setter to decide whether onChange should
// fire; setting `.value` directly (bypassing React's tracker) does not trigger
// the synthetic event, so we go through the native setter + dispatch, same
// technique used by @testing-library/react's fireEvent under the hood.
function setInputValue(input, value) {
  const nativeSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value"
  ).set;
  nativeSetter.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

function setSelectValue(select, value) {
  const nativeSetter = Object.getOwnPropertyDescriptor(
    window.HTMLSelectElement.prototype,
    "value"
  ).set;
  nativeSetter.call(select, value);
  select.dispatchEvent(new Event("change", { bubbles: true }));
}

// Tells React 18 this jsdom environment supports `act(...)`, silencing the
// spurious "environment not configured" warning (no behavior change).
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("Users search/filter/pagination (USR-01-FR-3, relocated from Dashboard.search.test.jsx)", () => {
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

  async function renderUsers() {
    root = createRoot(container);
    await act(async () => {
      root.render(<Users />);
    });
    // Flush the initial mount's debounce effect (search === "" => 0ms delay).
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
  }

  function getSearchInput() {
    return container.querySelector('input[aria-label="Search users"]');
  }

  // Relocated verbatim from Dashboard.search.test.jsx (ADR-4 / TC-06).
  it("TC-06: delays the getUsers call by 300ms while typing a non-empty search value", async () => {
    await renderUsers();
    userApi.getUsers.mockClear();

    const input = getSearchInput();
    await act(async () => {
      setInputValue(input, "jane");
    });

    // Not yet fired just before the 300ms debounce window elapses.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(299);
    });
    expect(userApi.getUsers).not.toHaveBeenCalled();

    // Fires once the full 300ms window elapses.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(userApi.getUsers).toHaveBeenCalledTimes(1);
    expect(userApi.getUsers).toHaveBeenCalledWith(
      expect.objectContaining({
        search: "jane",
        role: "All",
        status: "All",
        page: 1,
        pageSize: 50,
      })
    );
  });

  // Relocated verbatim from Dashboard.search.test.jsx (ADR-4 / TC-07).
  it("TC-07: clearing the search input triggers an immediate (0ms) refetch", async () => {
    await renderUsers();

    const input = getSearchInput();
    await act(async () => {
      setInputValue(input, "jane");
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    userApi.getUsers.mockClear();

    await act(async () => {
      setInputValue(input, "");
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(userApi.getUsers).toHaveBeenCalledTimes(1);
    expect(userApi.getUsers).toHaveBeenCalledWith(
      expect.objectContaining({ search: "" })
    );
  });

  // Relocated verbatim from Dashboard.search.test.jsx (ADR-4).
  it('renders the search input with aria-label="Search users"', async () => {
    await renderUsers();
    const input = getSearchInput();
    expect(input).not.toBeNull();
    expect(input.getAttribute("aria-label")).toBe("Search users");
  });

  // New coverage (USR-01-TC-08): Role/Status filter changes reset to page 1.
  it("TC-08: changing the Role filter refetches immediately and resets page to 1", async () => {
    userApi.getUsers.mockResolvedValue({ items: [], total: 200 });
    await renderUsers();

    // Move to page 2 first.
    userApi.getUsers.mockClear();
    const nextBtn = container.querySelector('button[aria-label="Next page"]');
    await act(async () => {
      nextBtn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(userApi.getUsers).toHaveBeenCalledWith(expect.objectContaining({ page: 2 }));

    userApi.getUsers.mockClear();
    const roleSelect = container.querySelector('select[aria-label="Filter by role"]');
    await act(async () => {
      setSelectValue(roleSelect, "Admin");
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(userApi.getUsers).toHaveBeenCalledWith(
      expect.objectContaining({ role: "Admin", page: 1 })
    );
  });

  it("TC-08b: changing the Status filter refetches immediately and resets page to 1", async () => {
    await renderUsers();
    userApi.getUsers.mockClear();

    const statusSelect = container.querySelector('select[aria-label="Filter by status"]');
    await act(async () => {
      setSelectValue(statusSelect, "Inactive");
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(userApi.getUsers).toHaveBeenCalledWith(
      expect.objectContaining({ status: "Inactive", page: 1 })
    );
  });

  // New coverage (USR-01-TC-16): Previous/Next pagination + boundary disable state.
  it("TC-16: Previous/Next pagination fetches the correct page and disables at boundaries", async () => {
    userApi.getUsers.mockResolvedValue({ items: [], total: 120 });
    await renderUsers();

    const prevBtn = () => container.querySelector('button[aria-label="Previous page"]');
    const nextBtn = () => container.querySelector('button[aria-label="Next page"]');

    // Page 1: Previous disabled, Next enabled.
    expect(prevBtn().disabled).toBe(true);
    expect(nextBtn().disabled).toBe(false);

    userApi.getUsers.mockClear();
    await act(async () => {
      nextBtn().dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(userApi.getUsers).toHaveBeenCalledWith(expect.objectContaining({ page: 2 }));

    // Page 2 of 3 (120 total / 50 per page): both enabled.
    expect(prevBtn().disabled).toBe(false);
    expect(nextBtn().disabled).toBe(false);

    userApi.getUsers.mockClear();
    await act(async () => {
      nextBtn().dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(userApi.getUsers).toHaveBeenCalledWith(expect.objectContaining({ page: 3 }));

    // Page 3 (last page, 101-120 of 120): Next disabled.
    expect(nextBtn().disabled).toBe(true);
    expect(prevBtn().disabled).toBe(false);

    userApi.getUsers.mockClear();
    await act(async () => {
      prevBtn().dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(userApi.getUsers).toHaveBeenCalledWith(expect.objectContaining({ page: 2 }));
  });
});
