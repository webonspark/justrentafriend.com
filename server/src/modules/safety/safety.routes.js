const express = require("express");
const crypto = require("crypto");
const { Op } = require("sequelize");
const { Report, Block, SosAlert, Booking, Profile, User, Message, Conversation } = require("../../models");
const { wrap } = require("../../lib/handler");
const { requireAuth } = require("../../middleware/auth");
const { sendSms, sendWhatsApp } = require("../../lib/messaging");
const { notify } = require("../../lib/notify");
const env = require("../../config/env");
const { badRequest, notFound, conflict } = require("../../lib/errors");
const { logger } = require("../../lib/logger");

/**
 * Safety.
 *
 *   POST   /safety/reports                report a member (optionally a message or booking)
 *   GET    /safety/blocks                 who I have blocked
 *   POST   /safety/blocks                 block someone
 *   DELETE /safety/blocks/:userId         unblock
 *   PUT    /safety/emergency-contact      who gets the SOS link
 *   POST   /safety/sos                    raise an SOS (during a meet)
 *   POST   /safety/sos/:id/location       live location update
 *   POST   /safety/sos/:id/resolve        "I'm safe"
 *   GET    /safety/sos/active             my active alert, if any
 *   GET    /safety/sos-share/:token       PUBLIC: what the emergency contact sees
 */
const router = express.Router();

const REASONS = ["solicitation", "harassment", "fake_profile", "scam_or_money", "underage", "no_show", "offensive_photos", "other"];
const URGENT = ["solicitation", "underage", "harassment"];

router.post(
  "/reports",
  requireAuth,
  wrap(async (req, res) => {
    const { reportedId, reason, details, bookingId, messageId } = req.body;
    if (!REASONS.includes(reason)) throw badRequest("Choose a reason.");
    const reported = await User.findByPk(reportedId);
    if (!reported || reported.id === req.user.id) throw badRequest("Choose who you are reporting.");

    let msgId = null;
    if (messageId) {
      // A message can be attached only from a conversation the reporter is in.
      const m = await Message.findByPk(messageId, { include: [{ model: Conversation, as: "conversation" }] });
      const inIt = m && [m.conversation.customerId, m.conversation.companionId].includes(req.user.id);
      if (inIt && m.senderId === reported.id) {
        msgId = m.id;
        await m.update({ flagged: true, flagReason: m.flagReason || `reported:${reason}` });
      }
    }
    const report = await Report.create({
      reporterId: req.user.id,
      reportedId: reported.id,
      bookingId: bookingId || null,
      messageId: msgId,
      reason,
      details: details ? String(details).slice(0, 2000) : null,
      priority: URGENT.includes(reason) ? "urgent" : "normal",
    });
    if (req.body.block) {
      await Block.findOrCreate({ where: { blockerId: req.user.id, blockedId: reported.id }, defaults: { blockerId: req.user.id, blockedId: reported.id, reason } });
    }
    res.status(201).json({ id: report.id, message: "Thank you. Our safety team reviews every report, usually within 24 hours." });
  })
);

router.get(
  "/blocks",
  requireAuth,
  wrap(async (req, res) => {
    const rows = await Block.findAll({ where: { blockerId: req.user.id }, include: [{ model: User, as: "blocked", attributes: ["id", "fullName"] }] });
    res.json({ blocks: rows.map((b) => ({ userId: b.blockedId, name: b.blocked?.fullName, createdAt: b.createdAt })) });
  })
);

router.post(
  "/blocks",
  requireAuth,
  wrap(async (req, res) => {
    const id = Number(req.body.userId);
    if (!id || id === req.user.id) throw badRequest("Choose who to block.");
    await Block.findOrCreate({ where: { blockerId: req.user.id, blockedId: id }, defaults: { blockerId: req.user.id, blockedId: id, reason: req.body.reason || null } });
    // Blocking closes any open chat between them.
    await Conversation.update(
      { isClosed: true },
      { where: { [Op.or]: [{ customerId: req.user.id, companionId: id }, { customerId: id, companionId: req.user.id }] } }
    );
    res.status(201).json({ ok: true });
  })
);

router.delete(
  "/blocks/:userId(\\d+)",
  requireAuth,
  wrap(async (req, res) => {
    await Block.destroy({ where: { blockerId: req.user.id, blockedId: req.params.userId } });
    res.json({ ok: true });
  })
);

router.put(
  "/emergency-contact",
  requireAuth,
  wrap(async (req, res) => {
    const name = String(req.body.name || "").trim();
    const phone = String(req.body.phone || "").replace(/[\s-]/g, "");
    if (name.length < 2) throw badRequest("Enter your emergency contact's name.");
    if (!/^(\+91)?[6-9]\d{9}$/.test(phone)) throw badRequest("Enter a valid Indian mobile number.");
    await Profile.update({ emergencyContactName: name, emergencyContactPhone: phone }, { where: { userId: req.user.id } });
    res.json({ ok: true, name, phone });
  })
);

router.get(
  "/emergency-contact",
  requireAuth,
  wrap(async (req, res) => {
    const p = await Profile.findOne({ where: { userId: req.user.id } });
    res.json({ name: p?.emergencyContactName || null, phone: p?.emergencyContactPhone || null });
  })
);

const sosJson = (a) => ({
  id: a.id,
  status: a.status,
  bookingId: a.bookingId,
  shareUrl: `${env.clientUrl}/sos/${a.shareToken}`,
  latitude: a.latitude === null ? null : Number(a.latitude),
  longitude: a.longitude === null ? null : Number(a.longitude),
  locationAt: a.locationAt,
  createdAt: a.createdAt,
});

router.post(
  "/sos",
  requireAuth,
  wrap(async (req, res) => {
    const existing = await SosAlert.findOne({ where: { userId: req.user.id, status: "active" } });
    if (existing) return res.json(sosJson(existing));

    let booking = null;
    if (req.body.bookingId) {
      booking = await Booking.findByPk(req.body.bookingId);
      if (!booking || ![booking.customerId, booking.companionId].includes(req.user.id)) booking = null;
    }
    const profile = await Profile.findOne({ where: { userId: req.user.id } });
    const lat = Number(req.body.latitude);
    const lng = Number(req.body.longitude);
    const hasLoc = Number.isFinite(lat) && Number.isFinite(lng);

    const alert = await SosAlert.create({
      userId: req.user.id,
      bookingId: booking?.id || null,
      shareToken: crypto.randomBytes(24).toString("hex"),
      latitude: hasLoc ? lat : null,
      longitude: hasLoc ? lng : null,
      accuracyM: req.body.accuracy ? Math.round(req.body.accuracy) : null,
      locationAt: hasLoc ? new Date() : null,
    });

    const link = `${env.clientUrl}/sos/${alert.shareToken}`;
    const text = `SOS from ${req.user.fullName} on ${env.brand.name}. Live location: ${link}${booking ? ` — meeting at ${booking.meetingPlaceName}` : ""}. If you cannot reach them, call 112.`;
    if (profile?.emergencyContactPhone) {
      await Promise.allSettled([sendSms(profile.emergencyContactPhone, text), sendWhatsApp(profile.emergencyContactPhone, text)]);
    }
    logger.warn(`SOS #${alert.id} raised by user ${req.user.id}${booking ? ` (booking ${booking.id})` : ""}`);
    await notify(req.user.id, {
      type: "sos",
      title: "SOS sent",
      body: profile?.emergencyContactPhone ? `Your emergency contact ${profile.emergencyContactName} has your live location.` : "Our safety team has been alerted. Add an emergency contact in Settings.",
      link: "/safety",
    });
    res.status(201).json({ ...sosJson(alert), contactNotified: Boolean(profile?.emergencyContactPhone) });
  })
);

router.get(
  "/sos/active",
  requireAuth,
  wrap(async (req, res) => {
    const a = await SosAlert.findOne({ where: { userId: req.user.id, status: "active" } });
    res.json({ alert: a ? sosJson(a) : null });
  })
);

router.post(
  "/sos/:id(\\d+)/location",
  requireAuth,
  wrap(async (req, res) => {
    const a = await SosAlert.findOne({ where: { id: req.params.id, userId: req.user.id } });
    if (!a) throw notFound("That alert does not exist.");
    if (a.status !== "active") throw conflict("This alert has been resolved.");
    const lat = Number(req.body.latitude);
    const lng = Number(req.body.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw badRequest("No location.");
    await a.update({ latitude: lat, longitude: lng, accuracyM: req.body.accuracy ? Math.round(req.body.accuracy) : null, locationAt: new Date() });
    res.json(sosJson(a));
  })
);

router.post(
  "/sos/:id(\\d+)/resolve",
  requireAuth,
  wrap(async (req, res) => {
    const a = await SosAlert.findOne({ where: { id: req.params.id, userId: req.user.id } });
    if (!a) throw notFound("That alert does not exist.");
    await a.update({ status: "resolved", resolvedAt: new Date(), resolvedNote: "Marked safe by the member" });
    const profile = await Profile.findOne({ where: { userId: req.user.id } });
    if (profile?.emergencyContactPhone) {
      await sendSms(profile.emergencyContactPhone, `${req.user.fullName} has marked themselves safe on ${env.brand.name}.`);
    }
    res.json(sosJson(a));
  })
);

/** Public, by unguessable token: the emergency contact's live view. */
router.get(
  "/sos-share/:token",
  wrap(async (req, res) => {
    const a = await SosAlert.findOne({
      where: { shareToken: req.params.token },
      include: [
        { model: User, as: "user", attributes: ["fullName"] },
        { model: Booking, as: "booking", attributes: ["meetingPlaceName", "meetingPlaceAddress", "startAt", "endAt"] },
      ],
    });
    if (!a) throw notFound("This link is not valid.");
    res.json({
      name: a.user?.fullName,
      status: a.status,
      latitude: a.latitude === null ? null : Number(a.latitude),
      longitude: a.longitude === null ? null : Number(a.longitude),
      accuracyM: a.accuracyM,
      locationAt: a.locationAt,
      createdAt: a.createdAt,
      meetingPlace: a.booking ? { name: a.booking.meetingPlaceName, address: a.booking.meetingPlaceAddress } : null,
    });
  })
);

module.exports = router;
