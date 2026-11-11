/**
 * The one way the app talks to the server.
 *
 * The access token lives in memory only — not in localStorage, where any
 * script on the page could read it. The refresh token is an httpOnly cookie
 * the browser sends on its own and JavaScript cannot touch.
 *
 * That means a page reload has no access token. `restore()` asks /refresh
 * for a new one using the cookie, which is how a session survives F5.
 */

const BASE = import.meta.env.VITE_API_URL || "/api";

let accessToken = null;
let onSignedOut = null;

export const setAccessToken = (t) => { accessToken = t; };
export const getAccessToken = () => accessToken;
export const onUnauthorized = (fn) => { onSignedOut = fn; };

/** An error that carries what the server said, not just a string. */
export class ApiError extends Error {
  constructor(message, { status, code, details } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }

  /** { field: message } for marking up a form. */
  get fieldErrors() {
    if (!Array.isArray(this.details)) return {};
    return Object.fromEntries(this.details.map((d) => [d.field, d.message]));
  }
}

let refreshing = null;

/** One refresh at a time, however many requests hit a 401 together. */
function refreshOnce() {
  if (!refreshing) {
    refreshing = fetch(`${BASE}/auth/refresh`, {
      method: "POST",
      credentials: "include",
    })
      .then(async (r) => {
        if (!r.ok) throw new Error("not signed in");
        const data = await r.json();
        accessToken = data.accessToken;
        return data;
      })
      .finally(() => { refreshing = null; });
  }
  return refreshing;
}

async function request(path, { method = "GET", body, retry = true } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  let response;
  try {
    response = await fetch(`${BASE}${path}`, {
      method,
      headers,
      credentials: "include",
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError("Cannot reach the server. Check your connection.", { status: 0 });
  }

  /* An expired access token is ordinary, not an error: get a new one with
     the cookie and send the request again, once. */
  if (response.status === 401 && retry && path !== "/auth/refresh") {
    try {
      await refreshOnce();
      return request(path, { method, body, retry: false });
    } catch {
      accessToken = null;
      onSignedOut?.();
    }
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const e = data.error || {};
    throw new ApiError(e.message || "Something went wrong. Try again.", {
      status: response.status,
      code: e.code,
      details: e.details,
    });
  }

  return data;
}

export const api = {
  config: () => request("/config"),
  health: () => request("/health"),

  // ---- auth ----
  register: (body) => request("/auth/register", { method: "POST", body }),
  verifyOtp: (body) => request("/auth/verify-otp", { method: "POST", body }),
  resendOtp: (email) => request("/auth/resend-otp", { method: "POST", body: { email } }),
  login: (body) => request("/auth/login", { method: "POST", body }),
  logout: () => request("/auth/logout", { method: "POST" }),
  me: () => request("/auth/me"),
  forgotPassword: (email) => request("/auth/forgot-password", { method: "POST", body: { email } }),
  resetPassword: (body) => request("/auth/reset-password", { method: "POST", body }),
  changePassword: (body) => request("/auth/change-password", { method: "POST", body }),

  /** Trades the refresh cookie for a session on page load. */
  restore: async () => {
    const { user, accessToken: token } = await refreshOnce();
    accessToken = token;
    return user;
  },
};

export { request };
