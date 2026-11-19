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

/* Staff sessions are separate from member sessions: own token, own cookie. */
let adminToken = null;
export const setAdminToken = (t) => { adminToken = t; };
export const getAdminToken = () => adminToken;

async function request(path, { method = "GET", body, retry = true, raw = false } = {}) {
  const isAdmin = path.startsWith("/admin") && !path.startsWith("/admin/auth/login");
  const token = isAdmin ? adminToken : accessToken;
  const isForm = typeof FormData !== "undefined" && body instanceof FormData;
  const headers = isForm ? {} : { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(`${BASE}${path}`, {
      method,
      headers,
      credentials: "include",
      body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
    });
  } catch {
    throw new ApiError("Cannot reach the server. Check your connection.", { status: 0 });
  }

  /* An expired access token is ordinary, not an error: get a new one with
     the cookie and send the request again, once. */
  if (response.status === 401 && retry && !path.startsWith("/auth/refresh") && !path.startsWith("/admin/auth/")) {
    try {
      if (isAdmin) {
        const r = await fetch(`${BASE}/admin/auth/refresh`, { method: "POST", credentials: "include" });
        if (!r.ok) throw new Error("not signed in");
        adminToken = (await r.json()).accessToken;
      } else {
        await refreshOnce();
      }
      return request(path, { method, body, retry: false, raw });
    } catch {
      if (isAdmin) adminToken = null;
      else {
        accessToken = null;
        onSignedOut?.();
      }
    }
  }

  if (raw && response.ok) return response.text();
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

  sendMobileOtp: () => request("/auth/mobile/send", { method: "POST" }),
  verifyMobile: (code) => request("/auth/mobile/verify", { method: "POST", body: { code } }),
  sendLoginOtp: (mobile) => request("/auth/login-otp/send", { method: "POST", body: { mobile } }),
  loginWithOtp: (body) => request("/auth/login-otp/verify", { method: "POST", body }),
  googleLogin: (token) => request("/auth/google", { method: "POST", body: token }),

  // ---- profiles ----
  catalog: () => request("/profiles/catalog"),
  myProfile: () => request("/profiles/me"),
  updateProfile: (body) => request("/profiles/me", { method: "PUT", body }),
  setAvailability: (slots) => request("/profiles/me/availability", { method: "PUT", body: { slots } }),
  uploadPhoto: (file) => request("/profiles/me/photos", { method: "POST", body: form({ photo: file }) }),
  deletePhoto: (id) => request(`/profiles/me/photos/${id}`, { method: "DELETE" }),
  primaryPhoto: (id) => request(`/profiles/me/photos/${id}/primary`, { method: "POST" }),
  submitKyc: (docType, number, file) => request("/profiles/me/kyc", { method: "POST", body: form({ docType, number, document: file }) }),
  submitSelfie: (file) => request("/profiles/me/selfie", { method: "POST", body: form({ selfie: file }) }),
  submitForApproval: () => request("/profiles/me/submit", { method: "POST" }),
  savePayoutAccount: (body) => request("/profiles/me/payout-account", { method: "PUT", body }),
  companion: (id) => request(`/profiles/${id}`),

  // ---- discover ----
  discover: (params) => request(`/discover?${new URLSearchParams(clean(params))}`),
  areas: () => request("/discover/areas"),

  // ---- bookings ----
  bookings: (tab) => request(`/bookings?tab=${tab}`),
  booking: (id) => request(`/bookings/${id}`),
  slots: (companionId, date) => request(`/bookings/slots/${companionId}?date=${date}`),
  requestBooking: (body) => request("/bookings", { method: "POST", body }),
  bookingAction: (id, action, body = {}) => request(`/bookings/${id}/${action}`, { method: "POST", body }),

  // ---- payments ----
  plans: () => request("/payments/plans"),
  startMembership: (planId) => request("/payments/membership", { method: "POST", body: { planId } }),
  verifyPayment: (body) => request("/payments/verify", { method: "POST", body }),
  myPayments: () => request("/payments"),
  invoice: (id) => request(`/payments/${id}/invoice`, { raw: true }),
  earnings: () => request("/earnings"),

  // ---- chat ----
  conversations: () => request("/chat"),
  messages: (id, before) => request(`/chat/${id}/messages${before ? `?before=${before}` : ""}`),
  sendMessage: (id, body) => request(`/chat/${id}/messages`, { method: "POST", body: { body } }),
  markRead: (id) => request(`/chat/${id}/read`, { method: "POST" }),

  // ---- safety ----
  report: (body) => request("/safety/reports", { method: "POST", body }),
  blocks: () => request("/safety/blocks"),
  block: (userId, reason) => request("/safety/blocks", { method: "POST", body: { userId, reason } }),
  unblock: (userId) => request(`/safety/blocks/${userId}`, { method: "DELETE" }),
  emergencyContact: () => request("/safety/emergency-contact"),
  saveEmergencyContact: (body) => request("/safety/emergency-contact", { method: "PUT", body }),
  sos: (body) => request("/safety/sos", { method: "POST", body }),
  activeSos: () => request("/safety/sos/active"),
  sosLocation: (id, body) => request(`/safety/sos/${id}/location`, { method: "POST", body }),
  resolveSos: (id) => request(`/safety/sos/${id}/resolve`, { method: "POST" }),
  sosShare: (token) => request(`/safety/sos-share/${token}`),

  // ---- notifications & account ----
  notifications: () => request("/notifications"),
  readAllNotifications: () => request("/notifications/read-all", { method: "POST" }),
  readNotification: (id) => request(`/notifications/${id}/read`, { method: "POST" }),
  preferences: () => request("/account/preferences"),
  savePreferences: (body) => request("/account/preferences", { method: "PUT", body }),
  deleteAccount: (password) => request("/account", { method: "DELETE", body: { password } }),

  /** Trades the refresh cookie for a session on page load. */
  restore: async () => {
    const { user, accessToken: token } = await refreshOnce();
    accessToken = token;
    return user;
  },
};

/** The staff API. Every path is under /admin. */
export const adminApi = {
  login: async (body) => {
    const d = await request("/admin/auth/login", { method: "POST", body });
    adminToken = d.accessToken;
    return d.admin;
  },
  restore: async () => {
    const r = await fetch(`${BASE}/admin/auth/refresh`, { method: "POST", credentials: "include" });
    if (!r.ok) throw new Error("not signed in");
    const d = await r.json();
    adminToken = d.accessToken;
    return d.admin;
  },
  logout: async () => {
    await fetch(`${BASE}/admin/auth/logout`, { method: "POST", credentials: "include" }).catch(() => {});
    adminToken = null;
  },
  get: (path) => request(`/admin${path}`),
  post: (path, body = {}) => request(`/admin${path}`, { method: "POST", body }),
  put: (path, body = {}) => request(`/admin${path}`, { method: "PUT", body }),
  html: (path) => request(`/admin${path}`, { raw: true }),
  /** A private file (KYC, selfie) as an object URL — it needs the staff token. */
  fileUrl: async (path) => {
    const r = await fetch(`${BASE}/admin${path}`, { headers: { Authorization: `Bearer ${adminToken}` } });
    if (!r.ok) throw new ApiError("Could not load the file.", { status: r.status });
    return URL.createObjectURL(await r.blob());
  },
};

function form(fields) {
  const f = new FormData();
  Object.entries(fields).forEach(([k, v]) => v !== undefined && v !== null && f.append(k, v));
  return f;
}

function clean(params = {}) {
  return Object.fromEntries(Object.entries(params).filter(([, v]) => v !== "" && v !== null && v !== undefined));
}

export { request };
