const winston = require("winston");
const env = require("../config/env");

/**
 * Logs to the console in development and to files in production. Free, with
 * nothing to sign up for.
 *
 * Never log a password, a token, an OTP or a full KYC number. `scrub` below
 * is the one place that is enforced; use it on anything coming from a request
 * body before it goes near a log line.
 */

const logger = winston.createLogger({
  level: env.isProd ? "info" : "debug",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    env.isProd ? winston.format.json() : winston.format.simple()
  ),
  transports: env.isProd
    ? [
        new winston.transports.File({ filename: "logs/error.log", level: "error" }),
        new winston.transports.File({ filename: "logs/combined.log" }),
      ]
    : [new winston.transports.Console()],
});

const SECRET_KEYS = new Set([
  "password",
  "passwordHash",
  "confirmPassword",
  "newPassword",
  "token",
  "accessToken",
  "refreshToken",
  "otp",
  "code",
  "codeHash",
  "authorization",
  "signature",
  "documentNumber",
]);

/** A copy of an object with every sensitive value replaced. */
function scrub(input) {
  if (!input || typeof input !== "object") return input;
  if (Array.isArray(input)) return input.map(scrub);

  return Object.fromEntries(
    Object.entries(input).map(([key, value]) => [
      key,
      SECRET_KEYS.has(key) ? "[redacted]" : scrub(value),
    ])
  );
}

module.exports = { logger, scrub };
