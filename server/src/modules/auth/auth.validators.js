const { body } = require("express-validator");
const { MINIMUM_AGE } = require("../../lib/age");

/**
 * What a request has to contain before the service sees it.
 *
 * These are a first pass, not the rule itself. The 18+ check and the
 * duplicate-account check are repeated in the service, because a validator
 * can be reordered or skipped and a business rule must not depend on one.
 */

const password = () =>
  body("password")
    .isLength({ min: 8, max: 128 })
    .withMessage("Use at least 8 characters.")
    .matches(/[a-z]/)
    .withMessage("Include a lower-case letter.")
    .matches(/[A-Z]/)
    .withMessage("Include a capital letter.")
    .matches(/\d/)
    .withMessage("Include a number.");

const registerRules = [
  body("role").isIn(["user", "customer"]).withMessage("Choose how you are joining."),
  body("fullName").trim().isLength({ min: 2, max: 120 }).withMessage("Enter your full name."),
  body("email").trim().isEmail().withMessage("Enter a valid email address.").normalizeEmail(),
  body("mobile")
    .trim()
    .matches(/^(\+?\d{1,3})?[\s-]?\d{10}$/)
    .withMessage("Enter a 10-digit mobile number."),
  body("dateOfBirth").isISO8601().withMessage(`Enter your date of birth. You must be ${MINIMUM_AGE} or over.`),
  password(),
  body("acceptedTerms")
    .equals("true")
    .customSanitizer((v) => v === true || v === "true")
    .withMessage("Accept the Terms and the Privacy policy to continue."),
];

const loginRules = [
  body("identifier").trim().notEmpty().withMessage("Enter your email or mobile number."),
  body("password").notEmpty().withMessage("Enter your password."),
];

const otpRules = [
  body("email").trim().isEmail().withMessage("Enter a valid email address.").normalizeEmail(),
  body("code").trim().isLength({ min: 4, max: 8 }).withMessage("Enter the code from your email."),
];

const emailOnlyRules = [
  body("email").trim().isEmail().withMessage("Enter a valid email address.").normalizeEmail(),
];

const resetRules = [...otpRules, password()];

const changePasswordRules = [
  body("currentPassword").notEmpty().withMessage("Enter your current password."),
  password(),
];

module.exports = {
  registerRules,
  loginRules,
  otpRules,
  emailOnlyRules,
  resetRules,
  changePasswordRules,
};
