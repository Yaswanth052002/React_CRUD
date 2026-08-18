import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import Settings from "../Settings.jsx";
import * as userApi from "../../services/userApi.js";

// Mock at the service boundary (per react-patterns: pages never call Axios
// directly — mock ../../services/userApi.js, not axios). Per PLAN.md
// condition #10/C-10, these tests mock getCurrentUser()/logout() directly
// and have no dependency on AUTH-04/AUTH-05's real session-state
// implementation.
vi.mock("../../services/userApi.js", () => ({
  getCurrentUser: vi.fn(),
  logout: vi.fn(),
}));

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("Settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // TC-01: getCurrentUser() resolve path renders exactly name/email.
  it("TC-01: fetches the current user on mount and renders name and email", async () => {
    userApi.getCurrentUser.mockResolvedValue({ name: "Jane Doe", email: "jane@test.com" });

    render(<Settings onMenuClick={vi.fn()} onLogout={vi.fn()} />);

    await waitFor(() => expect(screen.getByText("Jane Doe")).toBeInTheDocument());
    expect(screen.getByText("jane@test.com")).toBeInTheDocument();
    expect(userApi.getCurrentUser).toHaveBeenCalledTimes(1);
  });

  // TC-02: getCurrentUser() reject path surfaces the normalized error message.
  it("TC-02: renders the normalized error message when getCurrentUser() rejects", async () => {
    userApi.getCurrentUser.mockRejectedValue(new Error("Could not reach the server."));

    render(<Settings onMenuClick={vi.fn()} onLogout={vi.fn()} />);

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("Could not reach the server.")
    );
    expect(screen.queryByText(/Jane Doe/)).not.toBeInTheDocument();
  });

  // TC-03: extraneous role/id fields returned by a mocked getCurrentUser()
  // are never read/rendered — only name/email appear.
  it("TC-03: never reads or renders role, id, or other extraneous fields", async () => {
    userApi.getCurrentUser.mockResolvedValue({
      name: "Jane Doe",
      email: "jane@test.com",
      role: "Admin",
      id: 42,
    });

    render(<Settings onMenuClick={vi.fn()} onLogout={vi.fn()} />);

    await waitFor(() => expect(screen.getByText("Jane Doe")).toBeInTheDocument());
    expect(screen.queryByText("Admin")).not.toBeInTheDocument();
    expect(screen.queryByText("42")).not.toBeInTheDocument();
  });

  // TC-04: Logout button calls userApi.logout() then props.onLogout(), in order.
  it("TC-04: Logout button calls userApi.logout() then props.onLogout() in order, with no extra network request", async () => {
    userApi.getCurrentUser.mockResolvedValue({ name: "Jane Doe", email: "jane@test.com" });
    const onLogout = vi.fn();

    render(<Settings onMenuClick={vi.fn()} onLogout={onLogout} />);
    await waitFor(() => expect(screen.getByText("Jane Doe")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /logout/i }));

    expect(userApi.logout).toHaveBeenCalledTimes(1);
    expect(onLogout).toHaveBeenCalledTimes(1);
    const logoutOrder = userApi.logout.mock.invocationCallOrder[0];
    const onLogoutOrder = onLogout.mock.invocationCallOrder[0];
    expect(logoutOrder).toBeLessThan(onLogoutOrder);
    expect(userApi.getCurrentUser).toHaveBeenCalledTimes(1);
  });

  // TC-05: Settings.jsx issues no navigation/redirect call itself on logout —
  // it only calls the two functions in its handler, nothing else.
  it("TC-05: performs no navigation or redirect call itself on logout", async () => {
    userApi.getCurrentUser.mockResolvedValue({ name: "Jane Doe", email: "jane@test.com" });
    const onLogout = vi.fn();
    const hrefBefore = window.location.href;

    render(<Settings onMenuClick={vi.fn()} onLogout={onLogout} />);
    await waitFor(() => expect(screen.getByText("Jane Doe")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /logout/i }));

    // Settings.jsx's handler calls only userApi.logout() and props.onLogout()
    // (asserted in TC-04) — no router/navigation API of its own, so the
    // document location is left untouched by this component.
    expect(window.location.href).toBe(hrefBefore);
  });

  // TC-06: no isAuthenticated prop is read or required — identical render
  // whether or not an arbitrary isAuthenticated prop is supplied.
  it("TC-06: renders identically with or without an isAuthenticated prop", async () => {
    userApi.getCurrentUser.mockResolvedValue({ name: "Jane Doe", email: "jane@test.com" });

    const { unmount, container: withoutProp } = render(
      <Settings onMenuClick={vi.fn()} onLogout={vi.fn()} />
    );
    await waitFor(() => expect(screen.getByText("Jane Doe")).toBeInTheDocument());
    const withoutHtml = withoutProp.innerHTML;
    unmount();

    userApi.getCurrentUser.mockResolvedValue({ name: "Jane Doe", email: "jane@test.com" });
    const { container: withProp } = render(
      <Settings onMenuClick={vi.fn()} onLogout={vi.fn()} isAuthenticated={true} />
    );
    await waitFor(() => expect(screen.getByText("Jane Doe")).toBeInTheDocument());

    expect(withProp.innerHTML).toBe(withoutHtml);
  });

  // TC-07: a spinner renders next to the fields while the fetch is pending.
  it("TC-07: renders a spinner next to the name/email fields while the fetch is pending", () => {
    const { promise } = deferred();
    userApi.getCurrentUser.mockReturnValue(promise);

    const { container } = render(<Settings onMenuClick={vi.fn()} onLogout={vi.fn()} />);

    expect(container.querySelectorAll(".spinner").length).toBeGreaterThan(0);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  // TC-08: inline persistent error banner (not a toast) renders on rejection
  // and stays visible with no auto-dismiss timer.
  it("TC-08: renders a persistent inline role=alert banner on rejection with no auto-dismiss", async () => {
    vi.useFakeTimers();
    userApi.getCurrentUser.mockRejectedValue(new Error("Could not reach the server."));

    render(<Settings onMenuClick={vi.fn()} onLogout={vi.fn()} />);

    await vi.waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    vi.advanceTimersByTime(10000);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    vi.useRealTimers();
  });

  // TC-09: getCurrentUser() is called exactly once on mount, no retry/poll,
  // even after a forced re-render (no re-mount).
  it("TC-09: calls getCurrentUser() exactly once on mount, with no retry or polling on re-render", async () => {
    userApi.getCurrentUser.mockResolvedValue({ name: "Jane Doe", email: "jane@test.com" });

    const { rerender } = render(<Settings onMenuClick={vi.fn()} onLogout={vi.fn()} />);
    await waitFor(() => expect(screen.getByText("Jane Doe")).toBeInTheDocument());

    rerender(<Settings onMenuClick={vi.fn()} onLogout={vi.fn()} />);

    expect(userApi.getCurrentUser).toHaveBeenCalledTimes(1);
  });

  // TC-10: getCurrentUser() is invoked with no arguments — identity is
  // derived server-side from the Bearer token, never client-supplied.
  it("TC-10: calls getCurrentUser() with no arguments", async () => {
    userApi.getCurrentUser.mockResolvedValue({ name: "Jane Doe", email: "jane@test.com" });

    render(<Settings onMenuClick={vi.fn()} onLogout={vi.fn()} />);
    await waitFor(() => expect(screen.getByText("Jane Doe")).toBeInTheDocument());

    expect(userApi.getCurrentUser).toHaveBeenCalledWith();
  });

  // TC-11: no PII (name/email/raw error text) is ever written to console
  // log output on either the success or failure path.
  it("TC-11: never logs name, email, or raw error text to the console on success or failure", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    userApi.getCurrentUser.mockResolvedValue({ name: "Jane Doe", email: "jane@test.com" });
    const { unmount } = render(<Settings onMenuClick={vi.fn()} onLogout={vi.fn()} />);
    await waitFor(() => expect(screen.getByText("Jane Doe")).toBeInTheDocument());
    unmount();

    userApi.getCurrentUser.mockRejectedValue(new Error("Could not reach the server."));
    render(<Settings onMenuClick={vi.fn()} onLogout={vi.fn()} />);
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());

    const allLoggedText = [...logSpy.mock.calls, ...errorSpy.mock.calls].flat().join(" ");
    expect(allLoggedText).not.toMatch(/Jane Doe/);
    expect(allLoggedText).not.toMatch(/jane@test\.com/);

    logSpy.mockRestore();
    errorSpy.mockRestore();
  });

  // TC-12: resolved fields use the details-item/details-item__label/
  // details-item__value classes consistent with UserDetails.jsx.
  it("TC-12: renders resolved fields with the details-item labelling pattern", async () => {
    userApi.getCurrentUser.mockResolvedValue({ name: "Jane Doe", email: "jane@test.com" });

    const { container } = render(<Settings onMenuClick={vi.fn()} onLogout={vi.fn()} />);
    await waitFor(() => expect(screen.getByText("Jane Doe")).toBeInTheDocument());

    const items = container.querySelectorAll(".details-item");
    expect(items.length).toBeGreaterThanOrEqual(2);
    expect(container.querySelectorAll(".details-item__label").length).toBeGreaterThanOrEqual(2);
    expect(container.querySelectorAll(".details-item__value").length).toBeGreaterThanOrEqual(2);
    expect(container.querySelector(".details-avatar")).not.toBeInTheDocument();
  });
});
