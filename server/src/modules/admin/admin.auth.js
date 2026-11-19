const express = require("express");
const bcrypt = require("bcryptjs");
const { AdminUser } = require("../../models");
const env = require("../../config/env");
const { wrap } = require("../../lib/handler");
const { requireAdmin } = require("../../middleware/auth");
const { loginLimiter } = require("../../middleware/rateLimit");
const { signAccessToken, issueRefreshToken, rotateRefreshToken, revokeRefreshToken } = require("../../lib/tokens");
const { unauthorized } = require("../../lib/errors");
const { record } = require("../../lib/audit");

/**
 * Staff sign-in, separate from members: its own table, its own cookie on
 * its own path, so a member session and a staff session never mix.
 *
 *   POST /admin/auth/login    { email, password }
 *   POST /admin/auth/refresh  (cookie)
 *   POST /admin/auth/logout
 *   GET  /admin/auth/me
 */
const router = express.Router();
const COOKIE = "jraf_admin_refresh";
const cookieOptions = () => ({
  httpOnly: true,
  secure: env.isProd,
  sameSite: env.isProd ? "strict" : "lax",
  path: "/api/admin/auth",
  maxAge: 7 * 864e5,
});
const adminJson = (a) => ({ id: a.id, name: a.name, email: a.email, role: a.role });
const meta = (req) => ({ ip: req.ip, userAgent: String(req.get("user-agent") || "").slice(0, 300) });

router.post(
  "/login",
  loginLimiter,
  wrap(async (req, res) => {
    const email = String(req.body.email || "").trim().toLowerCase();
    const admin = await AdminUser.findOne({ where: { email } });
    const ok = admin && admin.isActive && (await bcrypt.compare(String(req.body.password || ""), admin.passwordHash));
    if (!ok) throw unauthorized("That email or password is not right.");
    await admin.update({ lastLoginAt: new Date(), lastLoginIp: req.ip });
    const refresh = await issueRefreshToken(admin, { kind: "admin", ...meta(req) });
    res.cookie(COOKIE, refresh, cookieOptions());
    req.admin = admin;
    await record(req, { action: "admin.login", entityType: "admin", entityId: admin.id });
    res.json({ admin: adminJson(admin), accessToken: signAccessToken(admin, "admin") });
  })
);

router.post(
  "/refresh",
  wrap(async (req, res) => {
    const token = req.cookies?.[COOKIE];
    if (!token) throw unauthorized();
    let result;
    try {
      result = await rotateRefreshToken(token, meta(req));
    } catch (e) {
      res.clearCookie(COOKIE, { path: "/api/admin/auth" });
      throw unauthorized(e.message);
    }
    if (result.kind !== "admin" || !result.account.isActive) throw unauthorized();
    res.cookie(COOKIE, result.refreshToken, cookieOptions());
    res.json({ admin: adminJson(result.account), accessToken: result.accessToken });
  })
);

router.post(
  "/logout",
  wrap(async (req, res) => {
    const token = req.cookies?.[COOKIE];
    if (token) await revokeRefreshToken(token);
    res.clearCookie(COOKIE, { path: "/api/admin/auth" });
    res.json({ ok: true });
  })
);

router.get("/me", requireAdmin, (req, res) => res.json({ admin: adminJson(req.admin) }));

module.exports = router;
