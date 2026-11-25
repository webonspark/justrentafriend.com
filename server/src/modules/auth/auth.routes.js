const express = require("express");
const ctrl = require("./auth.controller");
const rules = require("./auth.validators");
const { validate } = require("../../middleware/validate");
const { requireAuth } = require("../../middleware/auth");
const {
  loginLimiter,
  otpLimiter,
  registerLimiter,
} = require("../../middleware/rateLimit");

const router = express.Router();

/* Anything that can be guessed at — a password, a code — is rate limited. */

router.post("/register", registerLimiter, rules.registerRules, validate, ctrl.register);
router.post("/verify-otp", otpLimiter, rules.otpRules, validate, ctrl.verifyOtp);
router.post("/resend-otp", otpLimiter, rules.emailOnlyRules, validate, ctrl.resendOtp);

router.post("/login", loginLimiter, rules.loginRules, validate, ctrl.login);
router.post("/refresh", ctrl.refresh);
router.post("/logout", ctrl.logout);

router.post("/forgot-password", otpLimiter, rules.emailOnlyRules, validate, ctrl.forgotPassword);
router.post("/reset-password", otpLimiter, rules.resetRules, validate, ctrl.resetPassword);

router.post("/google", loginLimiter, ctrl.google);
router.post("/login-otp/send", otpLimiter, ctrl.sendLoginOtp);
router.post("/login-otp/verify", loginLimiter, ctrl.loginWithOtp);
router.post("/mobile/send", requireAuth, otpLimiter, ctrl.sendMobileOtp);
router.post("/mobile/verify", requireAuth, otpLimiter, ctrl.verifyMobile);
router.get("/me", requireAuth, ctrl.me);

/* My devices: where I am signed in, and signing them out. */
router.get("/sessions", requireAuth, ctrl.listSessions);
router.delete("/sessions/:id([a-f0-9]{32})", requireAuth, ctrl.endSession);
router.post("/sessions/sign-out-others", requireAuth, ctrl.endOtherSessions);
router.post(
  "/change-password",
  requireAuth,
  rules.changePasswordRules,
  validate,
  ctrl.changePassword
);

module.exports = router;
