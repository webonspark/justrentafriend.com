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

/**
 * `fam` (members only) names the login this token belongs to, so one device
 * can be signed out on its own: its socket joins the room fam:<id>.
 */
function signAccessToken(account, kind = "user", { fam } = {}) {
  return jwt.sign(
    { sub: account.id, kind, role: account.role, ...(fam ? { fam } : {}) },
    env.auth.accessSecret,
    { expiresIn: env.auth.accessTtl, algorithm: "HS256" }
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
    { expiresIn: `${IMPERSONATION_MINUTES}m`, algorithm: "HS256" }
  );
}

/* Only the algorithm we sign with is accepted, so a token can never pick
   its own (the "alg: none" and key-confusion families of attack). */
const ALGORITHM = "HS256";

function verifyAccessToken(token) {
  return jwt.verify(token, env.auth.accessSecret, { algorithms: [ALGORITHM] });
}

function expiryDate() {
  const d = new Date();
  d.setDate(d.getDate() + env.auth.refreshDays);
  return d;
}

/** Starts a new session, and with it a new token family. */
const newFamilyId = () => crypto.randomBytes(16).toString("hex");

async function issueRefreshToken(account, { kind = "user", ip, userAgent, familyId = newFamilyId() } = {}) {
  const token = crypto.randomBytes(48).toString("base64url");

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
    accessToken: row.userId ? signAccessToken(account, "user", { fam: row.familyId }) : signAccessToken(account, "admin"),
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

/* ---- "My devices": one row per login that is still signed in ---- */

function deviceName(ua = "") {
  const s = String(ua);
  const browser = /Edg\//.test(s) ? "Edge" : /OPR\/|Opera/.test(s) ? "Opera" : /SamsungBrowser/.test(s) ? "Samsung Internet"
    : /Firefox\//.test(s) ? "Firefox" : /Chrome\//.test(s) ? "Chrome" : /Safari\//.test(s) ? "Safari" : /curl|node|axios|undici/i.test(s) ? "App / script" : "Browser";
  const os = /iPhone/.test(s) ? "iPhone" : /iPad/.test(s) ? "iPad" : /Android/.test(s) ? "Android phone" : /Windows/.test(s) ? "Windows"
    : /Mac OS X|Macintosh/.test(s) ? "Mac" : /CrOS/.test(s) ? "Chromebook" : /Linux/.test(s) ? "Linux" : "Unknown device";
  return { browser, os, mobile: /iPhone|Android|Mobile/.test(s) };
}

async function listSessions(userId, currentToken) {
  const { Op, fn, col } = require("sequelize");
  const live = await RefreshToken.findAll({
    where: { userId, revokedAt: null, expiresAt: { [Op.gt]: new Date() } },
    order: [["createdAt", "DESC"]],
  });
  if (!live.length) return [];
  const firsts = await RefreshToken.findAll({
    attributes: ["familyId", [fn("MIN", col("created_at")), "first"]],
    where: { familyId: { [Op.in]: live.map((r) => r.familyId) } },
    group: ["familyId"],
    raw: true,
  });
  const since = Object.fromEntries(firsts.map((f) => [f.familyId, f.first]));
  const currentHash = currentToken ? hash(currentToken) : null;
  return live.map((r) => ({
    id: r.familyId,
    ...deviceName(r.userAgent),
    ip: r.ip,
    signedInAt: since[r.familyId] || r.createdAt,
    lastActiveAt: r.createdAt,
    current: r.tokenHash === currentHash,
  }));
}

/** Signs one login (device) out. Returns false if it was not this member's. */
async function revokeFamily(userId, familyId) {
  const [n] = await RefreshToken.update({ revokedAt: new Date() }, { where: { userId, familyId, revokedAt: null } });
  return n > 0;
}

/** Signs out every device except the one making the request. */
async function revokeOtherFamilies(userId, currentToken) {
  const { Op } = require("sequelize");
  const cur = currentToken ? await RefreshToken.findOne({ where: { tokenHash: hash(currentToken), userId } }) : null;
  const where = { userId, revokedAt: null, ...(cur ? { familyId: { [Op.ne]: cur.familyId } } : {}) };
  const ended = await RefreshToken.findAll({ where, attributes: ["familyId"], group: ["familyId"], raw: true });
  await RefreshToken.update({ revokedAt: new Date() }, { where });
  return ended.map((r) => r.familyId);
}

module.exports = {
  IMPERSONATION_MINUTES,
  newFamilyId,
  listSessions,
  revokeFamily,
  revokeOtherFamilies,
  signImpersonationToken,
  signAccessToken,
  verifyAccessToken,
  issueRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
  revokeAllForUser,
};
