// MOCK implementation for AUTH-01 — AUTH-02 owns replacing this with a real
// backend call. This module never logs credentials (per security-baseline).

/**
 * Simulates an authentication request. Resolves with a fake token payload
 * for non-empty email/password after a short delay, otherwise rejects with
 * a generic Error (the caller is responsible for showing a non-leaking
 * message — this module never distinguishes invalid-email from
 * invalid-password).
 */
export async function login(email, password) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (email && password) {
        resolve({ token: `mock-token-${Date.now()}` });
      } else {
        reject(new Error("Invalid credentials"));
      }
    }, 300);
  });
}
