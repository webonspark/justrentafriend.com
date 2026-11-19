const { User, AdminUser } = require("../models");
const { verifyAccessToken } = require("../lib/tokens");
const { unauthorized, forbidden, membershipRequired } = require("../lib/errors");

/**
 * Who is making this request, and are they allowed to?
 *
 * Every guard here runs on the server for every request. Nothing in this
 * file may ever be replaced by a check in the browser: hiding a button is a
 * courtesy, refusing the request is the rule.
 */

function readToken(req) {
  const header = req.get("authorization") || "";
  if (header.startsWith("Bearer ")) return header.slice(7).trim();
  return null;
}

/** Requires a signed-in member. Puts the account on req.user. */
async function requireAuth(req, res, next) {
  try {
    const token = readToken(req);
    if (!token) throw unauthorized();

    let claims;
    try {
      claims = verifyAccessToken(token);
    } catch {
      throw unauthorized("Your session has expired. Sign in again.");
    }

    if (claims.kind !== "user") throw unauthorized();

    const user = await User.findByPk(claims.sub);
    if (!user) throw unauthorized();

    if (user.status === "banned") throw forbidden("This account has been closed.");
    if (user.status === "suspended") {
      throw forbidden("This account is suspended. Contact support.");
    }
    if (user.status === "deleted") throw unauthorized();

    req.user = user;
    return next();
  } catch (err) {
    return next(err);
  }
}

/** Requires a signed-in staff account. Puts it on req.admin. */
async function requireAdmin(req, res, next) {
  try {
    const token = readToken(req);
    if (!token) throw unauthorized();

    let claims;
    try {
      claims = verifyAccessToken(token);
    } catch {
      throw unauthorized("Your session has expired. Sign in again.");
    }

    if (claims.kind !== "admin") throw forbidden();

    const admin = await AdminUser.findByPk(claims.sub);
    if (!admin || !admin.isActive) throw forbidden();

    req.admin = admin;
    return next();
  } catch (err) {
    return next(err);
  }
}

/** Narrows an admin route to particular staff roles. */
const requireAdminRole =
  (...roles) =>
  (req, res, next) => {
    if (!req.admin) return next(unauthorized());
    if (req.admin.role === "super_admin") return next(); // always allowed
    if (!roles.includes(req.admin.role)) {
      return next(forbidden("Your role does not cover this."));
    }
    return next();
  };

/** Narrows a route to Customers or to Companions. */
const requireRole =
  (...roles) =>
  (req, res, next) => {
    if (!req.user) return next(unauthorized());
    if (!roles.includes(req.user.role)) {
      return next(forbidden("This is not available for your account type."));
    }
    return next();
  };

/**
 * The membership gate.
 *
 * Without an active membership a profile is hidden and chat and booking are
 * locked. 402 rather than 403, so the client knows to send them to the
 * membership page rather than show a flat refusal.
 */
function requireActiveMembership(req, res, next) {
  if (!req.user) return next(unauthorized());

  if (!req.user.emailVerified) {
    return next(forbidden("Confirm your email address first."));
  }
  if (!req.user.mobileVerified) {
    const err = forbidden("Verify your mobile number first.");
    err.code = "mobile_unverified";
    return next(err);
  }
  if (!req.user.isMemberActive()) {
    return next(
      membershipRequired(
        req.user.membershipStatus === "expired"
          ? "Your membership has expired. Renew it to carry on."
          : "A membership is needed for this."
      )
    );
  }
  return next();
}

/** Reads the signed-in user when there is one, without demanding it. */
async function optionalAuth(req, res, next) {
  const token = readToken(req);
  if (!token) return next();

  try {
    const claims = verifyAccessToken(token);
    if (claims.kind === "user") {
      const user = await User.findByPk(claims.sub);
      if (user && !["banned", "deleted"].includes(user.status)) req.user = user;
    }
  } catch {
    // A bad token on an optional route is simply a visitor.
  }
  return next();
}

module.exports = {
  requireAuth,
  requireAdmin,
  requireAdminRole,
  requireRole,
  requireActiveMembership,
  optionalAuth,
};
