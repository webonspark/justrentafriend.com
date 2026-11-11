/**
 * One shape of error for the whole API.
 *
 * Anything thrown with `expose: true` has wording meant for the person who
 * made the request. Everything else is reported as a generic failure and the
 * real reason stays in the log, so an internal message can never leak out
 * through an error response.
 */

class AppError extends Error {
  constructor(message, status = 400, code = "bad_request", details = null) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.details = details;
    this.expose = true;
  }
}

const badRequest = (m, details) => new AppError(m, 400, "bad_request", details);
const unauthorized = (m = "Sign in to continue.") => new AppError(m, 401, "unauthorized");
const forbidden = (m = "You do not have access to this.") => new AppError(m, 403, "forbidden");
const notFound = (m = "Not found.") => new AppError(m, 404, "not_found");
const conflict = (m, details) => new AppError(m, 409, "conflict", details);
const tooMany = (m = "Too many attempts. Try again shortly.") =>
  new AppError(m, 429, "too_many_requests");

/** Membership is compulsory, so this one comes up all over the app. */
const membershipRequired = (m = "Your membership is not active.") =>
  new AppError(m, 402, "membership_required");

module.exports = {
  AppError,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  conflict,
  tooMany,
  membershipRequired,
};
