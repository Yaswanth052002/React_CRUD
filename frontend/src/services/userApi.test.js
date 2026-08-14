import { describe, it, expect } from "vitest";

// A light smoke test that doesn't require a running backend: it verifies
// the service module exports the expected functions used throughout the app.
import * as userApi from "./userApi.js";

describe("userApi service", () => {
  it("exports all CRUD functions used by the dashboard", () => {
    expect(typeof userApi.getUsers).toBe("function");
    expect(typeof userApi.getUser).toBe("function");
    expect(typeof userApi.createUser).toBe("function");
    expect(typeof userApi.updateUser).toBe("function");
    expect(typeof userApi.deleteUser).toBe("function");
    expect(typeof userApi.getDashboardStats).toBe("function");
  });
});
