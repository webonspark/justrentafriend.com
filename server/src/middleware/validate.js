const { validationResult } = require("express-validator");
const { AppError } = require("../lib/errors");

/**
 * Turns express-validator's findings into the API's one error shape.
 *
 * Put it last in a route's middleware list, after the rules. The first
 * problem becomes the message, and the rest travel in `details` so a form
 * can mark every bad field at once.
 */
function validate(req, res, next) {
  const result = validationResult(req);
  if (result.isEmpty()) return next();

  const problems = result.array();
  return next(
    new AppError(
      problems[0].msg,
      400,
      "validation_failed",
      problems.map((p) => ({ field: p.path, message: p.msg }))
    )
  );
}

module.exports = { validate };
