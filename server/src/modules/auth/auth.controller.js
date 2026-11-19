const service = require("./auth.service");
const env = require("../../config/env");

/**
 * Reads the request, calls the service, writes the response. No rules here.
 *
 * The refresh token travels in an httpOnly cookie rather than in the JSON
 * body, so a cross-site script cannot read it. The short-lived access token
 * does go to the client, which keeps it in memory.
 */

const REFRESH_COOKIE = "kindred_refresh";

const cookieOptions = () => ({
  httpOnly: true,
  secure: env.isProd,
  sameSite: env.isProd ? "strict" : "lax",
  path: "/api/auth",
  maxAge: env.auth.refreshDays * 24 * 60 * 60 * 1000,
});

const meta = (req) => ({ ip: req.ip, userAgent: String(req.get("user-agent") || "").slice(0, 300) });

/** Sends the token pair, with the refresh half going into the cookie. */
function sendSession(res, result) {
  if (result.refreshToken) {
    res.cookie(REFRESH_COOKIE, result.refreshToken, cookieOptions());
  }
  return res.json({ user: result.user, accessToken: result.accessToken });
}

exports.register = async (req, res, next) => {
  try {
    const result = await service.register(req.body, meta(req));
    return res.status(201).json({
      message: "Check your email for the code we just sent.",
      user: result.user,
      devCode: result.devCode,
    });
  } catch (err) {
    return next(err);
  }
};

exports.verifyOtp = async (req, res, next) => {
  try {
    const result = await service.verifyEmail(req.body, meta(req));
    return sendSession(res, result);
  } catch (err) {
    return next(err);
  }
};

exports.resendOtp = async (req, res, next) => {
  try {
    const result = await service.resendVerification(req.body);
    return res.json({ message: "If that address has an account, a new code is on its way.", ...result });
  } catch (err) {
    return next(err);
  }
};

exports.login = async (req, res, next) => {
  try {
    const result = await service.login(req.body, meta(req));
    return sendSession(res, result);
  } catch (err) {
    return next(err);
  }
};

exports.google = async (req, res, next) => {
  try {
    const result = await service.googleLogin(req.body, meta(req));
    if (result.needsSignup) return res.json(result);
    return sendSession(res, result);
  } catch (err) {
    return next(err);
  }
};

exports.sendMobileOtp = async (req, res, next) => {
  try {
    return res.json(await service.sendMobileOtp(req.user));
  } catch (err) {
    return next(err);
  }
};

exports.verifyMobile = async (req, res, next) => {
  try {
    return res.json(await service.verifyMobile(req.user, req.body.code));
  } catch (err) {
    return next(err);
  }
};

exports.sendLoginOtp = async (req, res, next) => {
  try {
    return res.json(await service.sendLoginOtp(req.body));
  } catch (err) {
    return next(err);
  }
};

exports.loginWithOtp = async (req, res, next) => {
  try {
    return sendSession(res, await service.loginWithOtp(req.body, meta(req)));
  } catch (err) {
    return next(err);
  }
};

exports.forgotPassword = async (req, res, next) => {
  try {
    const result = await service.forgotPassword(req.body);
    return res.json({
      message: "If that address has an account, a reset code is on its way.",
      ...result,
    });
  } catch (err) {
    return next(err);
  }
};

exports.resetPassword = async (req, res, next) => {
  try {
    await service.resetPassword(req.body);
    return res.json({ message: "Your password is set. Sign in with it now." });
  } catch (err) {
    return next(err);
  }
};

exports.changePassword = async (req, res, next) => {
  try {
    await service.changePassword(req.user, req.body);
    res.clearCookie(REFRESH_COOKIE, { path: "/api/auth" });
    return res.json({ message: "Your password is changed. Sign in again." });
  } catch (err) {
    return next(err);
  }
};

exports.refresh = async (req, res, next) => {
  try {
    const token = req.cookies?.[REFRESH_COOKIE] || req.body?.refreshToken;
    const result = await service.refresh(token, meta(req));
    return sendSession(res, result);
  } catch (err) {
    res.clearCookie(REFRESH_COOKIE, { path: "/api/auth" });
    return next(err);
  }
};

exports.logout = async (req, res, next) => {
  try {
    await service.logout(req.cookies?.[REFRESH_COOKIE]);
    res.clearCookie(REFRESH_COOKIE, { path: "/api/auth" });
    return res.json({ message: "Signed out." });
  } catch (err) {
    return next(err);
  }
};

/** Who am I — used on page load to restore a session. */
exports.me = async (req, res) => res.json({ user: req.user.toSafeJSON() });

exports.REFRESH_COOKIE = REFRESH_COOKIE;
