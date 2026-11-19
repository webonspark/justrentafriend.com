const express = require("express");
const service = require("./payment.service");
const { wrap } = require("../../lib/handler");
const { requireAuth, optionalAuth } = require("../../middleware/auth");

/**
 *   GET  /payments/plans               membership plans (with GST)
 *   POST /payments/membership          start a membership checkout
 *   POST /payments/verify              confirm a payment (browser callback)
 *   POST /payments/webhook             gateway → server (Razorpay)
 *   GET  /payments                     my payment history
 *   GET  /payments/:id/invoice         GST invoice, printable HTML
 */
const router = express.Router();

router.get("/plans", optionalAuth, wrap(async (req, res) => res.json({ plans: await service.plans(req.user) })));
router.post("/membership", requireAuth, wrap(async (req, res) => res.status(201).json(await service.startMembership(req.user, req.body.planId))));
router.post("/verify", requireAuth, wrap(async (req, res) => res.json(await service.verifyAndApply(req.user, req.body))));
router.post(
  "/webhook",
  // app.js keeps the raw bytes on req.rawBody: the signature is over those.
  wrap(async (req, res) => res.json(await service.webhook(req.rawBody || Buffer.from(""), req.get("x-razorpay-signature"))))
);
router.get("/", requireAuth, wrap(async (req, res) => res.json({ payments: await service.listMine(req.user) })));
router.get("/:id(\\d+)/invoice", requireAuth, wrap(async (req, res) => res.type("html").send(await service.invoiceHtml(req.user, req.params.id))));

module.exports = router;
