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

// Tells React 18 this jsdom environment supports `act(...)`, silencing the
// spurious "environment not configured" warning (no behavior change).
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("Dashboard search debounce (SRF-01-FR-1)", () => {
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

  async function renderDashboard() {
    root = createRoot(container);
    await act(async () => {
      root.render(<Dashboard />);
    });
    // Flush the initial mount's debounce effect (search === "" => 0ms delay).
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
  }

  function getSearchInput() {
    return container.querySelector('input[aria-label="Search users"]');
  }

  it("TC-01: delays the getUsers call by 300ms while typing a non-empty search value", async () => {
    await renderDashboard();
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

  it("TC-02: clearing the search input triggers an immediate (0ms) refetch", async () => {
    await renderDashboard();

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

  it("TC-09: the rendered search input carries aria-label=\"Search users\"", async () => {
    await renderDashboard();
    const input = getSearchInput();
    expect(input).not.toBeNull();
    expect(input.getAttribute("aria-label")).toBe("Search users");
  });
});
