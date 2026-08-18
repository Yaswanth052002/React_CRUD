import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import LoginForm from "../LoginForm";
import LoginScreen from "../LoginScreen";
import * as userApi from "../../services/userApi";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// AUTH-01-TC-01, TC-05, TC-06, TC-08: pure LoginForm rendering/validation/a11y checks.
describe("LoginForm", () => {
  it("TC-01: renders email input, password input, and a Log in button with existing form classes", () => {
    render(<LoginForm onSubmit={vi.fn()} isSubmitting={false} serverError={null} />);

    const email = screen.getByLabelText(/email/i);
    const password = screen.getByLabelText(/password/i);
    const button = screen.getByRole("button", { name: /log in/i });

    expect(email).toHaveAttribute("type", "email");
    expect(email).toHaveClass("form-input");
    expect(password).toHaveAttribute("type", "password");
    expect(password).toHaveClass("form-input");
    expect(button).toHaveClass("btn", "btn-primary");
  });

  it("TC-06: blocks submit on empty fields, shows field-level errors, and never calls onSubmit", () => {
    const onSubmit = vi.fn();
    render(<LoginForm onSubmit={onSubmit} isSubmitting={false} serverError={null} />);

    fireEvent.click(screen.getByRole("button", { name: /log in/i }));

    expect(screen.getByText("Email is required")).toHaveClass("form-error");
    expect(screen.getByText("Password is required")).toHaveClass("form-error");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("TC-08: inputs have linked labels + aria-required, and the server error region uses aria-live=assertive", () => {
    render(<LoginForm onSubmit={vi.fn()} isSubmitting={false} serverError="Invalid email or password. Please try again." />);

    const email = screen.getByLabelText(/email/i);
    const password = screen.getByLabelText(/password/i);
    expect(email).toHaveAttribute("id", "login-email");
    expect(email).toHaveAttribute("aria-required", "true");
    expect(password).toHaveAttribute("id", "login-password");
    expect(password).toHaveAttribute("aria-required", "true");

    const errorRegion = screen.getByRole("alert");
    expect(errorRegion).toHaveAttribute("aria-live", "assertive");
    expect(errorRegion).toHaveClass("form-server-error");

    const button = screen.getByRole("button", { name: /log in/i });
    const style = getComputedStyle(button);
    expect(parseInt(style.minHeight, 10)).toBeGreaterThanOrEqual(44);
    expect(parseInt(style.minWidth, 10)).toBeGreaterThanOrEqual(44);
  });

  // NOTE (AUTH-01 validation round 1): jsdom has no real layout engine, so
  // `scrollWidth`/`clientWidth` are always 0 for every element — a computed-layout
  // assertion here would pass unconditionally regardless of actual CSS. This test
  // instead verifies, structurally, that nothing the form renders can force
  // horizontal overflow at a 320px viewport: (1) no rendered element carries a
  // fixed pixel width in its own inline style wider than 320px, and (2) the shared
  // `.form-input`/`.form-select` CSS rule that every input in this form uses is
  // relative (`width: 100%`) with no fixed px width/min-width that would exceed
  // 320px. Full pixel-accurate reflow verification requires a real browser
  // (Playwright/Cypress), which this repo does not have configured — see
  // docs/features/AUTH-01/FLAGS.md for that disclosure.
  it("TC-05: form and its inputs use only flexible widths, with no fixed-px rule that would overflow at 320px", () => {
    const { container } = render(<LoginForm onSubmit={vi.fn()} isSubmitting={false} serverError={null} />);

    const elementsWithInlineStyle = container.querySelectorAll("[style]");
    elementsWithInlineStyle.forEach((el) => {
      const widthValue = el.style.width;
      if (widthValue && widthValue.endsWith("px")) {
        expect(parseInt(widthValue, 10)).toBeLessThanOrEqual(320);
      }
    });

    const cssPath = path.resolve(__dirname, "../../styles/index.css");
    const css = fs.readFileSync(cssPath, "utf-8");
    const formInputRuleMatch = css.match(/\.form-input,\s*\n\.form-select\s*{([^}]*)}/);
    expect(formInputRuleMatch).not.toBeNull();
    const rule = formInputRuleMatch[1];
    expect(rule).toMatch(/width:\s*100%/);
    expect(rule).not.toMatch(/(?:^|[^-])(?:min-)?width:\s*\d{3,}px/);
  });
});

// AUTH-01-TC-04, TC-07, TC-09: full submit-cycle behaviour via LoginScreen with a mocked
// userApi.login, exercising the loading/error states LoginForm renders.
describe("LoginForm submit cycle (via LoginScreen)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function fillAndSubmit() {
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "user@example.com" } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "wrong-password" } });
    fireEvent.click(screen.getByRole("button", { name: /log in/i }));
  }

  it("TC-04: rejected auth call shows exactly the generic non-leaking error message", async () => {
    vi.spyOn(userApi, "login").mockRejectedValue(new Error("nope"));
    render(<LoginScreen onLoginSuccess={vi.fn()} />);

    fillAndSubmit();

    const errorEl = await screen.findByRole("alert");
    expect(errorEl).toHaveTextContent("Invalid email or password. Please try again.");
    expect(errorEl).toHaveClass("form-server-error");
  });

  it("TC-07: password value never appears in the DOM or console after a rejected submit", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(userApi, "login").mockRejectedValue(new Error("nope"));
    render(<LoginScreen onLoginSuccess={vi.fn()} />);

    fillAndSubmit();
    await screen.findByRole("alert");

    expect(document.body.textContent).not.toContain("wrong-password");
    logSpy.mock.calls.forEach((call) => expect(call.join(" ")).not.toContain("wrong-password"));
    errorSpy.mock.calls.forEach((call) => expect(call.join(" ")).not.toContain("wrong-password"));
  });

  it("TC-09: disabled state and spinner appear synchronously on click, before the auth call resolves", async () => {
    let resolveLogin;
    vi.spyOn(userApi, "login").mockReturnValue(
      new Promise((resolve) => {
        resolveLogin = resolve;
      })
    );
    render(<LoginScreen onLoginSuccess={vi.fn()} />);

    fillAndSubmit();

    const button = screen.getByRole("button", { name: /log in/i });
    expect(button).toBeDisabled();
    expect(button.querySelector(".spinner")).not.toBeNull();

    resolveLogin({ token: "t" });
    await waitFor(() => expect(button).not.toBeDisabled());
  });
});
