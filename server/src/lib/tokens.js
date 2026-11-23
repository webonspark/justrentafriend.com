const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const env = require("../config/env");
const { User, RefreshToken } = require("../models");

/**
 * Access and refresh tokens.
 *
 * The access token is short (15 minutes) and carries just enough to answer a
 * request without a database read. The refresh token is long (30 days), lives
 * only in the database as a hash, and rotates: spending one retires it and
 * issues a replacement.
 *
 * Rotation is what makes a stolen refresh token survivable. Every token
 * descended from one login shares a `familyId`. If a token that has already
 * been retired is presented again, two copies of it exist — so the whole
 * family is revoked and that person is signed out everywhere.
 */

const hash = (token) => crypto.createHash("sha256").update(token).digest("hex");

function signAccessToken(account, kind = "user") {
  return jwt.sign(
    { sub: account.id, kind, role: account.role },
    env.auth.accessSecret,
    { expiresIn: env.auth.accessTtl }
  );
}

/**
 * A read-only "view as member" token for staff. It is an ordinary member
 * token plus `imp` (the staff id): the auth middleware refuses every
 * request that would change anything, and it lasts 30 minutes with no
 * refresh token behind it.
 */
const IMPERSONATION_MINUTES = 30;
function signImpersonationToken(user, admin) {
  return jwt.sign(
    { sub: user.id, kind: "user", role: user.role, imp: admin.id },
    env.auth.accessSecret,
    { expiresIn: `${IMPERSONATION_MINUTES}m` }
  );
}

function verifyAccessToken(token) {
  return jwt.verify(token, env.auth.accessSecret);
}

function expiryDate() {
  const d = new Date();
  d.setDate(d.getDate() + env.auth.refreshDays);
  return d;
}

/** Starts a new session, and with it a new token family. */
async function issueRefreshToken(account, { kind = "user", ip, userAgent } = {}) {
  const token = crypto.randomBytes(48).toString("base64url");
  const familyId = crypto.randomBytes(16).toString("hex");

  await RefreshToken.create({
    [kind === "admin" ? "adminId" : "userId"]: account.id,
    tokenHash: hash(token),
    familyId,
    expiresAt: expiryDate(),
    ip,
    userAgent,
  });

  return token;
}

/**
 * Spends a refresh token and hands back a new pair.
 * Throws if the token is unknown, expired, or already spent.
 */
async function rotateRefreshToken(token, { ip, userAgent } = {}) {
  const row = await RefreshToken.findOne({ where: { tokenHash: hash(token) } });
  if (!row) throw new Error("That session is no longer valid.");

  if (row.revokedAt) {
    // A retired token came back: someone else has a copy. Burn the family.
    await RefreshToken.update(
      { revokedAt: new Date() },
      { where: { familyId: row.familyId, revokedAt: null } }
    );
    throw new Error("That session was ended for safety. Sign in again.");
  }

  if (new Date(row.expiresAt).getTime() < Date.now()) {
    throw new Error("That session has expired. Sign in again.");
  }

  const account = row.userId
    ? await User.findByPk(row.userId)
    : await require("../models").AdminUser.findByPk(row.adminId);

  if (!account) throw new Error("That account no longer exists.");
  if (row.userId && account.status === "banned") {
    throw new Error("This account is not available.");
  }

  const next = crypto.randomBytes(48).toString("base64url");
  const nextHash = hash(next);

  await RefreshToken.create({
    userId: row.userId,
    adminId: row.adminId,
    tokenHash: nextHash,
    familyId: row.familyId, // same login, one step further along
    expiresAt: expiryDate(),
    ip,
    userAgent,
  });

  await row.update({ revokedAt: new Date(), replacedByHash: nextHash });

  return {
    account,
    kind: row.userId ? "user" : "admin",
    refreshToken: next,
    accessToken: signAccessToken(account, row.userId ? "user" : "admin"),
  };
}

/** Signs one session out. */
async function revokeRefreshToken(token) {
  await RefreshToken.update(
    { revokedAt: new Date() },
    { where: { tokenHash: hash(token), revokedAt: null } }
  );
}

/** Signs every session out — used by "force logout" in the admin area. */
async function revokeAllForUser(userId) {
  await RefreshToken.update(
    { revokedAt: new Date() },
    { where: { userId, revokedAt: null } }
  );
}

module.exports = {
  IMPERSONATION_MINUTES,
  signImpersonationToken,
  signAccessToken,
  verifyAccessToken,
  issueRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
  revokeAllForUser,
};
