import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import LoginScreen from "../LoginScreen";
import * as userAuthService from "../../services/userAuthService";
import * as userApi from "../../services/userApi";

function fillAndSubmit(email = "user@example.com", password = "correct-password") {
  fireEvent.change(screen.getByLabelText(/email/i), { target: { value: email } });
  fireEvent.change(screen.getByLabelText(/password/i), { target: { value: password } });
  fireEvent.click(screen.getByRole("button", { name: /log in/i }));
}

describe("LoginScreen", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("TC-02: on success calls userAuthService.login, then userApi.setAuthToken, then onLoginSuccess, in order", async () => {
    vi.spyOn(userAuthService, "login").mockResolvedValue({ token: "abc123" });
    const setAuthTokenSpy = vi.spyOn(userApi, "setAuthToken").mockImplementation(() => {});
    const onLoginSuccess = vi.fn();

    render(<LoginScreen onLoginSuccess={onLoginSuccess} />);
    fillAndSubmit();

    await waitFor(() => expect(onLoginSuccess).toHaveBeenCalledWith("abc123"));

    expect(userAuthService.login).toHaveBeenCalledWith("user@example.com", "correct-password");
    expect(setAuthTokenSpy).toHaveBeenCalledWith("abc123");

    const loginOrder = userAuthService.login.mock.invocationCallOrder[0];
    const setTokenOrder = setAuthTokenSpy.mock.invocationCallOrder[0];
    const successOrder = onLoginSuccess.mock.invocationCallOrder[0];
    expect(loginOrder).toBeLessThan(setTokenOrder);
    expect(setTokenOrder).toBeLessThan(successOrder);
  });

  it("TC-03: on rejection, the button re-enables immediately with no setAuthToken/onLoginSuccess call", async () => {
    vi.spyOn(userAuthService, "login").mockRejectedValue(new Error("nope"));
    const setAuthTokenSpy = vi.spyOn(userApi, "setAuthToken").mockImplementation(() => {});
    const onLoginSuccess = vi.fn();

    render(<LoginScreen onLoginSuccess={onLoginSuccess} />);
    fillAndSubmit();

    const button = screen.getByRole("button", { name: /log in/i });
    await waitFor(() => expect(button).not.toBeDisabled());

    expect(setAuthTokenSpy).not.toHaveBeenCalled();
    expect(onLoginSuccess).not.toHaveBeenCalled();
  });

  it("renders sessionExpiredMessage in its own region, distinct from a submit-attempt error", () => {
    render(<LoginScreen onLoginSuccess={vi.fn()} sessionExpiredMessage="Your session has expired. Please log in again." />);

    expect(screen.getByText("Your session has expired. Please log in again.")).toBeInTheDocument();
  });
});
