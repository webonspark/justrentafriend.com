const express = require("express");
const service = require("./booking.service");
const { wrap } = require("../../lib/handler");
const { requireAuth, requireActiveMembership } = require("../../middleware/auth");

/**
 *   GET  /bookings?tab=requests|upcoming|past
 *   POST /bookings                         request a booking (Customer)
 *   GET  /bookings/slots/:companionId?date= free start times on a date
 *   GET  /bookings/:id
 *   POST /bookings/:id/accept              Companion
 *   POST /bookings/:id/reject              Companion
 *   POST /bookings/:id/pay                 Customer → gateway order
 *   POST /bookings/:id/cancel              either side, refund by the rules
 *   POST /bookings/:id/check-in            either side, at the meet
 *   POST /bookings/:id/complete            check-out / it happened
 *   POST /bookings/:id/dispute             either side
 *   POST /bookings/:id/review              either side, after completion
 */
const router = express.Router();
router.use(requireAuth, requireActiveMembership);

router.get("/", wrap(async (req, res) => res.json({ bookings: await service.list(req.user, req.query) })));
router.post("/", wrap(async (req, res) => res.status(201).json(await service.create(req.user, req.body))));
router.get("/slots/:companionId(\\d+)", wrap(async (req, res) => res.json({ slots: await service.freeSlots(Number(req.params.companionId), req.query.date) })));
router.get("/:id(\\d+)", wrap(async (req, res) => res.json(await service.get(req.user, req.params.id))));
router.post("/:id(\\d+)/accept", wrap(async (req, res) => res.json(await service.accept(req.user, req.params.id))));
router.post("/:id(\\d+)/reject", wrap(async (req, res) => res.json(await service.reject(req.user, req.params.id, req.body.reason))));
router.post("/:id(\\d+)/pay", wrap(async (req, res) => res.json(await service.startPayment(req.user, req.params.id))));
router.post("/:id(\\d+)/cancel", wrap(async (req, res) => res.json(await service.cancel(req.user, req.params.id, req.body.reason))));
router.post("/:id(\\d+)/check-in", wrap(async (req, res) => res.json(await service.checkIn(req.user, req.params.id))));
router.post("/:id(\\d+)/complete", wrap(async (req, res) => res.json(await service.complete(req.user, req.params.id))));
router.post("/:id(\\d+)/dispute", wrap(async (req, res) => res.json(await service.dispute(req.user, req.params.id, req.body.reason))));
router.post("/:id(\\d+)/review", wrap(async (req, res) => res.json(await service.review(req.user, req.params.id, req.body))));

module.exports = router;
