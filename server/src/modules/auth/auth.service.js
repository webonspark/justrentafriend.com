const bcrypt = require("bcryptjs");
const env = require("../../config/env");
const { sequelize, User, Profile, Preference, CompanionRate } = require("../../models");
const { issueOtp, verifyOtp } = require("../../lib/otp");
const { sendVerifyEmail, sendResetEmail } = require("../../lib/mailer");
const { checkDateOfBirth } = require("../../lib/age");
const {
  signAccessToken,
  issueRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
  revokeAllForUser,
} = require("../../lib/tokens");
const { badRequest, unauthorized, forbidden, conflict } = require("../../lib/errors");

/**
 * Everything sign-up and sign-in actually does.
 *
 * The controller above this file only reads the request and writes the
 * response; the rules live here, where they can be tested on their own.
 */

const tidyEmail = (value) => String(value || "").trim().toLowerCase();

/** Mobile numbers are stored as digits with a country code and nothing else. */
function tidyMobile(value) {
  const digits = String(value || "").replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits;
  if (digits.length === 10) return `+91${digits}`; // India is the launch market
  return `+${digits}`;
}

/**
 * Registers an account.
 *
 * The 18+ check runs here, on the server, from the date of birth — never
 * from an age the browser worked out. Consent to the Terms and Privacy
 * policy is recorded with a timestamp, because the DPDP Act expects proof
 * of it rather than an assumption.
 *
 * The account starts at status "pending" and cannot do anything until the
 * email is confirmed.
 */
async function register(payload, meta = {}) {
  const email = tidyEmail(payload.email);
  const mobile = tidyMobile(payload.mobile);

  if (!["customer", "companion"].includes(payload.role)) {
    throw badRequest("Choose whether you are joining to connect or to be listed.");
  }

  const ageProblem = checkDateOfBirth(payload.dateOfBirth);
  if (ageProblem) throw badRequest(ageProblem);

  if (!payload.acceptedTerms) {
    throw badRequest("Accept the Terms and the Privacy policy to continue.");
  }

  const clash = await User.findOne({
    where: sequelize.or({ email }, { mobile }),
    attributes: ["id", "email", "mobile"],
  });
  if (clash) {
    throw conflict(
      clash.email === email
        ? "An account already uses that email address."
        : "An account already uses that mobile number."
    );
  }

  // One transaction: an account without its profile row is a broken account.
  const user = await sequelize.transaction(async (t) => {
    const created = await User.create(
      {
        role: payload.role,
        fullName: String(payload.fullName).trim(),
        email,
        mobile,
        passwordHash: await bcrypt.hash(payload.password, env.auth.bcryptRounds),
        dateOfBirth: payload.dateOfBirth,
        status: "pending",
        consentAcceptedAt: new Date(),
        consentVersion: payload.consentVersion || "1.0",
      },
      { transaction: t }
    );

    await Profile.create(
      {
        userId: created.id,
        city: payload.city || env.brand.city,
        // Companions wait for admin approval; Customers need none.
        approvalStatus: created.role === "companion" ? "draft" : "approved",
      },
      { transaction: t }
    );
    await Preference.create({ userId: created.id }, { transaction: t });

    /* A Companion needs a price before they can be listed. It starts at the
       admin minimum and they set their own during onboarding. */
    if (created.role === "companion") {
      await CompanionRate.create(
        { companionId: created.id, pricePerHourPaise: env.money.minPricePerHour, isCurrent: true },
        { transaction: t }
      );
    }

    return created;
  });

  const { code } = await issueOtp({
    userId: user.id,
    destination: email,
    purpose: "verify_email",
  });
  await sendVerifyEmail(email, user.fullName, code);

  return {
    user: user.toSafeJSON(),
    // Handy in development, where email goes to the console.
    devCode: env.isProd ? undefined : code,
  };
}

/** Confirms an email address and opens the account. */
async function verifyEmail({ email, code }, meta = {}) {
  const address = tidyEmail(email);

  const user = await User.findOne({ where: { email: address } });
  if (!user) throw badRequest("That code has expired. Ask for a new one.");

  if (user.emailVerified) {
    throw badRequest("That email address is already confirmed. Sign in instead.");
  }

  await verifyOtp({ destination: address, purpose: "verify_email", code });

  await user.update({
    emailVerified: true,
    // "pending" only ever means "waiting on the email".
    status: user.status === "pending" ? "active" : user.status,
  });

  return startSession(user, meta);
}

/** Sends another verification code. */
async function resendVerification({ email }) {
  const address = tidyEmail(email);
  const user = await User.findOne({ where: { email: address } });

  // Nothing here says whether the address exists, so this cannot be used to
  // find out who has an account.
  if (!user || user.emailVerified) return { sent: true };

  const { code } = await issueOtp({
    userId: user.id,
    destination: address,
    purpose: "verify_email",
  });
  await sendVerifyEmail(address, user.fullName, code);

  return { sent: true, devCode: env.isProd ? undefined : code };
}

/**
 * Signs in with an email address or a mobile number.
 *
 * A wrong password and an unknown account give exactly the same answer, so
 * the form cannot be used to discover who is registered.
 */
async function login({ identifier, password }, meta = {}) {
  const raw = String(identifier || "").trim();
  const looksLikeEmail = raw.includes("@");

  const user = await User.findOne({
    where: looksLikeEmail ? { email: tidyEmail(raw) } : { mobile: tidyMobile(raw) },
  });

  const refuse = () => unauthorized("That email or password is not right.");

  if (!user) {
    // Spend about as long as a real check would, so timing gives nothing away.
    await bcrypt.compare(password, "$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinv");
    throw refuse();
  }

  const ok = await bcrypt.compare(String(password), user.passwordHash);
  if (!ok) throw refuse();

  if (user.status === "banned") throw forbidden("This account has been closed.");
  if (user.status === "suspended") {
    throw forbidden("This account is suspended. Contact support.");
  }
  if (user.status === "deleted") {
    // Signing in during the 30-day grace period cancels the deletion.
    const grace = user.deletionRequestedAt && Date.now() - new Date(user.deletionRequestedAt) < 30 * 864e5;
    if (!grace) throw refuse();
    await user.update({ status: "active", deletionRequestedAt: null });
  }

  if (!user.emailVerified) {
    const { code } = await issueOtp({
      userId: user.id,
      destination: user.email,
      purpose: "verify_email",
    });
    await sendVerifyEmail(user.email, user.fullName, code);

    const err = badRequest("Confirm your email address to finish signing in.");
    err.code = "email_unverified";
    err.details = { email: user.email, devCode: env.isProd ? undefined : code };
    throw err;
  }

  return startSession(user, meta);
}

/** Issues the token pair and records the sign-in. */
async function startSession(user, meta = {}) {
  await user.update({ lastLoginAt: new Date(), lastLoginIp: meta.ip || null });

  const refreshToken = await issueRefreshToken(user, {
    kind: "user",
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  return {
    user: user.toSafeJSON(),
    accessToken: signAccessToken(user, "user"),
    refreshToken,
  };
}

/**
 * Starts a password reset.
 *
 * Always answers the same way, whether or not the address is registered.
 * Telling someone "no such account" hands them a list of who is a member.
 */
async function forgotPassword({ email }) {
  const address = tidyEmail(email);
  const user = await User.findOne({ where: { email: address } });

  if (!user || ["banned", "deleted"].includes(user.status)) {
    return { sent: true };
  }

  const { code } = await issueOtp({
    userId: user.id,
    destination: address,
    purpose: "reset_password",
  });
  await sendResetEmail(address, user.fullName, code);

  return { sent: true, devCode: env.isProd ? undefined : code };
}

/**
 * Finishes a password reset.
 *
 * Every other session is signed out afterwards: whoever was using the old
 * password should not stay signed in on another device.
 */
async function resetPassword({ email, code, password }) {
  const address = tidyEmail(email);

  const user = await User.findOne({ where: { email: address } });
  if (!user) throw badRequest("That code has expired. Ask for a new one.");

  await verifyOtp({ destination: address, purpose: "reset_password", code });

  const sameAsBefore = await bcrypt.compare(String(password), user.passwordHash);
  if (sameAsBefore) throw badRequest("Choose a password you have not used here before.");

  await user.update({
    passwordHash: await bcrypt.hash(password, env.auth.bcryptRounds),
    // Resetting the password proves the address works.
    emailVerified: true,
    status: user.status === "pending" ? "active" : user.status,
  });

  await revokeAllForUser(user.id);

  return { reset: true };
}

/** Changes a password from inside the app, which needs the current one. */
async function changePassword(user, { currentPassword, password }) {
  const ok = await bcrypt.compare(String(currentPassword), user.passwordHash);
  if (!ok) throw badRequest("That is not your current password.");

  const sameAsBefore = await bcrypt.compare(String(password), user.passwordHash);
  if (sameAsBefore) throw badRequest("The new password is the same as the old one.");

  await user.update({
    passwordHash: await bcrypt.hash(password, env.auth.bcryptRounds),
  });
  await revokeAllForUser(user.id);

  return { changed: true };
}

/** Spends a refresh token for a new pair. */
async function refresh(token, meta = {}) {
  if (!token) throw unauthorized("Sign in to continue.");

  try {
    const result = await rotateRefreshToken(token, meta);
    return {
      user: result.account.toSafeJSON ? result.account.toSafeJSON() : result.account,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    };
  } catch (err) {
    throw unauthorized(err.message);
  }
}

async function logout(token) {
  if (token) await revokeRefreshToken(token);
  return { signedOut: true };
}

/**
 * Google sign-in, for an account that already exists with that email.
 * A new person is sent to sign-up with the email filled in, because a
 * role, date of birth (18+) and mobile number are still needed.
 * Needs GOOGLE_CLIENT_ID; without it the button is hidden.
 */
async function googleLogin({ credential, accessToken }, meta = {}) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) throw badRequest("Google sign-in is not set up on this server.");
  // An ID token (Google button / One Tap) or an access token (popup), both
  // checked with Google, and both must have been issued to our client ID.
  const query = accessToken
    ? `access_token=${encodeURIComponent(String(accessToken))}`
    : `id_token=${encodeURIComponent(String(credential || ""))}`;
  const r = await fetch(`https://oauth2.googleapis.com/tokeninfo?${query}`);
  const info = await r.json().catch(() => ({}));
  const verified = info.email_verified === "true" || info.email_verified === true;
  const issuedToUs = info.aud === clientId || info.azp === clientId;
  if (!r.ok || !issuedToUs || !verified || !info.email) {
    throw unauthorized("Google could not confirm who you are. Try again.");
  }
  const user = await User.findOne({ where: { email: tidyEmail(info.email) } });
  if (!user) return { needsSignup: true, email: info.email, name: info.name || "" };
  if (["banned", "suspended"].includes(user.status)) throw forbidden("This account cannot sign in. Contact support.");
  if (user.status === "deleted") await user.update({ status: "active", deletionRequestedAt: null });
  if (!user.emailVerified) await user.update({ emailVerified: true, status: user.status === "pending" ? "active" : user.status });
  return startSession(user, meta);
}

/* ------------------------------ mobile OTP ------------------------------ */

const { sendSms } = require("../../lib/messaging");

/** Sends a code to the signed-in member's mobile to verify it. */
async function sendMobileOtp(user) {
  if (user.mobileVerified) return { sent: false, alreadyVerified: true };
  const { code } = await issueOtp({ userId: user.id, destination: user.mobile, purpose: "verify_mobile" });
  await sendSms(user.mobile, `${code} is your ${env.brand.name} mobile verification code. It expires in ${env.otp.ttlMinutes} minutes.`);
  return { sent: true, devCode: env.isProd ? undefined : code };
}

async function verifyMobile(user, code) {
  await verifyOtp({ destination: user.mobile, purpose: "verify_mobile", code });
  await user.update({ mobileVerified: true });
  return { user: user.toSafeJSON() };
}

/**
 * Login with a code sent to the mobile instead of a password. Answers the
 * same way whether or not the number is registered.
 */
async function sendLoginOtp({ mobile }) {
  const number = tidyMobile(mobile);
  const user = await User.findOne({ where: { mobile: number } });
  if (!user || !["active", "warned"].includes(user.status)) return { sent: true };
  const { code } = await issueOtp({ userId: user.id, destination: number, purpose: "login_mobile" });
  await sendSms(number, `${code} is your ${env.brand.name} login code. Never share it with anyone.`);
  return { sent: true, devCode: env.isProd ? undefined : code };
}

async function loginWithOtp({ mobile, code }, meta = {}) {
  const number = tidyMobile(mobile);
  await verifyOtp({ destination: number, purpose: "login_mobile", code });
  const user = await User.findOne({ where: { mobile: number } });
  if (!user) throw unauthorized("That code is not right.");
  // Receiving the code proves the number.
  if (!user.mobileVerified) await user.update({ mobileVerified: true });
  return startSession(user, meta);
}

module.exports = {
  tidyEmail,
  tidyMobile,
  sendMobileOtp,
  verifyMobile,
  sendLoginOtp,
  loginWithOtp,
  googleLogin,
  register,
  verifyEmail,
  resendVerification,
  login,
  forgotPassword,
  resetPassword,
  changePassword,
  refresh,
  logout,
  tidyEmail,
  tidyMobile,
};
