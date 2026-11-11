const { ValidationError, UniqueConstraintError } = require("sequelize");
const env = require("../config/env");
const { logger, scrub } = require("../lib/logger");

/**
 * The last stop for anything thrown anywhere in the API.
 *
 * Every failure leaves here in the same shape, so the client has one thing
 * to read:
 *
 *   { "error": { "code": "...", "message": "...", "details": [...] } }
 *
 * Only messages deliberately marked for the person are passed through. An
 * unexpected error is logged in full and reported as a generic failure, so
 * a stack trace or a SQL string can never reach a browser.
 */

function notFound(req, res, next) {
  res.status(404).json({
    error: { code: "not_found", message: `No route for ${req.method} ${req.originalUrl}.` },
  });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  /* A duplicate email or mobile is a conflict the person can act on, so it
     is named rather than reported as "something went wrong". */
  if (err instanceof UniqueConstraintError) {
    const field = err.errors?.[0]?.path || "";
    const said = field.includes("email")
      ? "An account already uses that email address."
      : field.includes("mobile")
      ? "An account already uses that mobile number."
      : "That value is already taken.";
    return res.status(409).json({ error: { code: "conflict", message: said } });
  }

  if (err instanceof ValidationError) {
    return res.status(400).json({
      error: {
        code: "validation_failed",
        message: err.errors?.[0]?.message || "Check the details and try again.",
        details: err.errors?.map((e) => ({ field: e.path, message: e.message })),
      },
    });
  }

  const status = err.status || 500;

  if (status >= 500) {
    logger.error({
      message: err.message,
      stack: err.stack,
      method: req.method,
      url: req.originalUrl,
      body: scrub(req.body),
    });
  }

  const expose = err.expose && status < 500;

  return res.status(status).json({
    error: {
      code: err.code || (status >= 500 ? "server_error" : "bad_request"),
      message: expose ? err.message : "Something went wrong on our side. Try again.",
      ...(err.details ? { details: err.details } : {}),
      ...(env.isProd || status < 500 ? {} : { stack: err.stack }),
    },
  });
}

module.exports = { notFound, errorHandler };
