const rateLimit = require("express-rate-limit");
const env = require("../config/env");

/**
 * Limits on the routes worth attacking.
 *
 * Guessing a password, guessing an OTP and flooding somebody with messages
 * are all cheap without these. The limits are generous enough that an
 * ordinary person never meets one, and they are relaxed in development so
 * testing a flow repeatedly is not a fight.
 */

const make = (windowMinutes, max, message) =>
  rateLimit({
    windowMs: windowMinutes * 60 * 1000,
    max: env.isProd ? max : max * 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: { code: "too_many_requests", message } },
  });

// Counts per email rather than per IP, so one office network sharing an
// address cannot lock everybody out at once.
const byEmail = (windowMinutes, max, message) =>
  rateLimit({
    windowMs: windowMinutes * 60 * 1000,
    max: env.isProd ? max : max * 20,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => String(req.body?.email || req.body?.mobile || req.user?.id || req.ip).toLowerCase(),
    message: { error: { code: "too_many_requests", message } },
  });

module.exports = {
  loginLimiter: byEmail(15, 8, "Too many sign-in attempts. Wait a few minutes."),
  otpLimiter: byEmail(10, 5, "Too many codes requested. Wait a few minutes."),
  registerLimiter: make(60, 10, "Too many accounts from this connection."),
  messageLimiter: make(1, 40, "Slow down a moment."),
  apiLimiter: make(15, 600, "Too many requests. Wait a moment."),
};
