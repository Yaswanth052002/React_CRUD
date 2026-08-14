import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

const client = axios.create({
  baseURL: API_URL,
  timeout: 10000,
});

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

export async function getDashboardStats() {
  try {
    const res = await client.get("/api/dashboard/stats");
    return res.data;
  } catch (err) {
    throw normalizeError(err);
  }
}
