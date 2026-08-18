import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

const client = axios.create({
  baseURL: API_URL,
  timeout: 10000,
});

const TOKEN_KEY = "auth_token";

let unauthorizedHandler = null;

/**
 * Returns the stored bearer token, or null if absent or if reading from
 * localStorage throws (e.g. storage disabled) — never propagates the throw.
 */
export function getStoredToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

/**
 * Persists the bearer token to localStorage. If localStorage.setItem throws
 * (e.g. quota exceeded or storage disabled), the error is caught and
 * re-thrown as a readable Error rather than an uncaught exception/raw
 * stack trace.
 */
export function setAuthToken(token) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    throw new Error("Could not save your session. Please check your browser storage settings.");
  }
}

/** Removes the stored bearer token. */
export function clearAuthToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Nothing further to do — if removal fails, getStoredToken will still
    // be consulted on the next call and follows the same fail-safe path.
  }
}

/**
 * Registers the callback the response interceptor invokes when a 401 is
 * observed. Intended to be called once, on App.jsx mount.
 */
export function registerUnauthorizedHandler(callback) {
  unauthorizedHandler = callback;
}

// Request interceptor: attaches Authorization: Bearer <token> when a token
// is present; attaches nothing when absent (no empty header).
client.interceptors.request.use((config) => {
  const token = getStoredToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor: on 401, clears the token and notifies the app via
// the registered handler — but only if a token was still present at the
// moment the 401 arrived. This dedup guard prevents a second in-flight
// request's 401 from double-firing the handler after the first 401 already
// cleared the token (condition C-1 / FR-4).
client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const hadToken = Boolean(getStoredToken());
      clearAuthToken();
      if (hadToken && unauthorizedHandler) {
        console.log("auth_session_expired");
        unauthorizedHandler();
      }
    }
    return Promise.reject(error);
  }
);

/**
 * Normalizes any axios/network error into a plain Error with a
 * user-friendly message, so components never need to know about
 * axios or HTTP status codes.
 */
function normalizeError(error) {
  if (error.code === "ECONNABORTED") {
    return new Error("The request timed out. Please try again.");
  }
  if (!error.response) {
    return new Error(
      "Could not reach the server. Check that the backend is running at " + API_URL + "."
    );
  }
  const detail = error.response.data?.detail;
  if (typeof detail === "string" && detail.length > 0) {
    return new Error(detail);
  }
  if (error.response.status === 404) {
    return new Error("The requested resource was not found.");
  }
  if (error.response.status >= 500) {
    return new Error("Something went wrong on the server. Please try again.");
  }
  return new Error("Something went wrong. Please try again.");
}

export async function getUsers({ search, role, status, page, pageSize } = {}) {
  try {
    const params = {};
    if (search) params.search = search;
    if (role && role !== "All") params.role = role;
    if (status && status !== "All") params.status = status;
    if (page) params.page = page;
    if (pageSize) params.page_size = pageSize;
    const res = await client.get("/api/users", { params });
    return res.data;
  } catch (err) {
    throw normalizeError(err);
  }
}

export async function getUser(id) {
  try {
    const res = await client.get(`/api/users/${id}`);
    return res.data;
  } catch (err) {
    throw normalizeError(err);
  }
}

export async function createUser(user) {
  try {
    const res = await client.post("/api/users", user);
    return res.data;
  } catch (err) {
    throw normalizeError(err);
  }
}

export async function updateUser(id, user) {
  try {
    const res = await client.put(`/api/users/${id}`, user);
    return res.data;
  } catch (err) {
    throw normalizeError(err);
  }
}

export async function deleteUser(id) {
  try {
    await client.delete(`/api/users/${id}`);
  } catch (err) {
    throw normalizeError(err);
  }
}

export async function login(email, password) {
  try {
    const res = await client.post("/api/auth/login", { email, password });
    return res.data;
  } catch (err) {
    throw normalizeError(err);
  }
}

export async function getDashboardStats() {
  try {
    const res = await client.get("/api/dashboard/stats");
    return res.data;
  } catch (err) {
    throw normalizeError(err);
  }
}
