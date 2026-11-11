const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const { Op } = require("sequelize");
const env = require("../config/env");
const { OtpCode } = require("../models");
const { tooMany, badRequest } = require("./errors");

/**
 * One-time codes, by email.
 *
 * The code is never stored — only a bcrypt hash of it — so a copy of the
 * database is no use for walking into accounts. Issuing a new code retires
 * any earlier one for the same address and purpose, so only the newest
 * email works.
 */

/** A numeric code, generated from a real random source. */
function generateCode(length = env.otp.length) {
  const max = 10 ** length;
  const n = crypto.randomInt(0, max);
  return String(n).padStart(length, "0");
}

async function issueOtp({ userId = null, destination, purpose }) {
  const code = generateCode();

  // Only the newest code for an address should work.
  await OtpCode.update(
    { consumedAt: new Date() },
    { where: { destination, purpose, consumedAt: null } }
  );

  const expiresAt = new Date(Date.now() + env.otp.ttlMinutes * 60 * 1000);

  await OtpCode.create({
    userId,
    destination,
    purpose,
    codeHash: await bcrypt.hash(code, 8), // short-lived, so 8 rounds is plenty
    expiresAt,
  });

  return { code, expiresAt };
}

/**
 * Checks a code and spends it.
 *
 * A wrong code counts against the attempt limit; running out of attempts
 * kills the code rather than the account, so somebody guessing cannot lock
 * the real owner out permanently.
 */
async function verifyOtp({ destination, purpose, code }) {
  const row = await OtpCode.findOne({
    where: { destination, purpose, consumedAt: null, expiresAt: { [Op.gt]: new Date() } },
    order: [["id", "DESC"]],
  });

  if (!row) throw badRequest("That code has expired. Ask for a new one.");

  if (row.attempts >= env.otp.maxAttempts) {
    await row.update({ consumedAt: new Date() });
    throw tooMany("Too many wrong codes. Ask for a new one.");
  }

  const ok = await bcrypt.compare(String(code), row.codeHash);

  if (!ok) {
    await row.update({ attempts: row.attempts + 1 });
    const left = env.otp.maxAttempts - row.attempts;
    throw badRequest(
      left > 0
        ? `That code is not right. ${left} ${left === 1 ? "try" : "tries"} left.`
        : "That code is not right. Ask for a new one."
    );
  }

  await row.update({ consumedAt: new Date() });
  return row;
}

/** Housekeeping, run on a schedule: throw away codes nobody can use. */
async function purgeExpiredOtps() {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return OtpCode.destroy({ where: { expiresAt: { [Op.lt]: cutoff } } });
}

module.exports = { generateCode, issueOtp, verifyOtp, purgeExpiredOtps };
