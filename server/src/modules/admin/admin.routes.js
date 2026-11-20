const express = require("express");
const fs = require("fs");
const bcrypt = require("bcryptjs");
const { Op } = require("sequelize");
const {
  sequelize,
  User,
  Profile,
  Photo,
  KycDocument,
  Booking,
  Payment,
  Payout,
  PayoutAccount,
  Report,
  Message,
  Conversation,
  SosAlert,
  Setting,
  ServiceCategory,
  Plan,
  Review,
  AuditLog,
  AdminUser,
  Subscription,
} = require("../../models");
const env = require("../../config/env");
const settings = require("../../lib/settings");
const { wrap, paging } = require("../../lib/handler");
const { requireAdmin, requireAdminRole } = require("../../middleware/auth");
const { record, recordView } = require("../../lib/audit");
const { publicUrl, absolute } = require("../../lib/uploads");
const { notify } = require("../../lib/notify");
const { revokeAllForUser } = require("../../lib/tokens");
const { badRequest, notFound, conflict } = require("../../lib/errors");
const bookingService = require("../bookings/booking.service");
const paymentService = require("../payments/payment.service");

/**
 * The admin panel API. Every route needs a staff session; each section is
 * narrowed to the staff roles that own it (super_admin is always allowed):
 *
 *   moderator  approvals, photos, KYC, reports, chat review, user status, reviews, SOS
 *   finance    payments, refunds, payouts, disputes, money settings, plans
 *   support    read-only views of members and bookings
 *
 * Every change, and every look at something sensitive (KYC files, a private
 * chat), is written to the audit log.
 */
const router = express.Router();
router.use(requireAdmin);

const MOD = requireAdminRole("moderator");
const FIN = requireAdminRole("finance");
const ANY = requireAdminRole("moderator", "finance", "support");
const SUPER = requireAdminRole(); // super_admin only

const money = (v) => Number(v || 0);
const sumOf = (rows, f) => rows.reduce((n, r) => n + money(r[f]), 0);

/* ------------------------------ dashboard & analytics ------------------------------ */

router.get(
  "/dashboard",
  ANY,
  wrap(async (req, res) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [customers, companions, liveCompanions, pendingApprovals, kycQueue, photoQueue, openReports, activeSos, disputes, bookingsToday, heldPayouts] =
      await Promise.all([
        User.count({ where: { role: "customer", status: { [Op.ne]: "deleted" } } }),
        User.count({ where: { role: "companion", status: { [Op.ne]: "deleted" } } }),
        Profile.count({ where: { approvalStatus: "approved" }, include: [{ model: User, as: "user", where: { role: "companion", status: "active" } }] }),
        Profile.count({ where: { approvalStatus: "pending" } }),
        KycDocument.count({ where: { status: "submitted" } }),
        Photo.count({ where: { moderationStatus: "pending" } }),
        Report.count({ where: { status: { [Op.in]: ["open", "reviewing"] } } }),
        SosAlert.count({ where: { status: "active" } }),
        Booking.count({ where: { status: "disputed" } }),
        Booking.count({ where: { createdAt: { [Op.gte]: today } } }),
        Payout.count({ where: { status: { [Op.in]: ["on_hold", "failed", "pending"] } } }),
      ]);
    const paid = await Payment.findAll({ where: { status: { [Op.in]: ["paid", "refunded"] } }, attributes: ["purpose", "totalPaise", "refundedPaise"] });
    const completed = await Booking.findAll({ where: { status: "completed" }, attributes: ["amountPaise", "commissionPaise"] });
    res.json({
      counts: { customers, companions, liveCompanions, pendingApprovals, kycQueue, photoQueue, openReports, activeSos, disputes, bookingsToday, heldPayouts },
      money: {
        collectedPaise: sumOf(paid, "totalPaise") - sumOf(paid, "refundedPaise"),
        membershipPaise: sumOf(paid.filter((p) => p.purpose === "membership"), "totalPaise"),
        gmvPaise: sumOf(completed, "amountPaise"),
        commissionPaise: sumOf(completed, "commissionPaise"),
      },
    });
  })
);

router.get(
  "/analytics",
  ANY,
  wrap(async (req, res) => {
    const days = Math.min(Math.max(Number(req.query.days) || 30, 7), 365);
    const since = new Date(Date.now() - days * 864e5);
    const [users, bookings, payments] = await Promise.all([
      User.findAll({ where: { createdAt: { [Op.gte]: since } }, attributes: ["role", "createdAt"] }),
      Booking.findAll({
        where: { createdAt: { [Op.gte]: since } },
        attributes: ["status", "amountPaise", "commissionPaise", "createdAt"],
        include: [{ model: User, as: "companion", attributes: ["id"], include: [{ model: Profile, as: "profile", attributes: ["city"] }] }],
      }),
      Payment.findAll({ where: { paidAt: { [Op.gte]: since }, status: { [Op.in]: ["paid", "refunded"] } }, attributes: ["purpose", "totalPaise", "refundedPaise", "paidAt"] }),
    ]);
    const dayKey = (d) => new Date(d).toISOString().slice(0, 10);
    const series = {};
    for (let i = days - 1; i >= 0; i -= 1) {
      series[dayKey(Date.now() - i * 864e5)] = { date: dayKey(Date.now() - i * 864e5), customers: 0, companions: 0, bookings: 0, completed: 0, revenuePaise: 0 };
    }
    users.forEach((u) => { const s = series[dayKey(u.createdAt)]; if (s) s[u.role === "customer" ? "customers" : "companions"] += 1; });
    bookings.forEach((b) => { const s = series[dayKey(b.createdAt)]; if (s) { s.bookings += 1; if (b.status === "completed") { s.completed += 1; s.revenuePaise += money(b.commissionPaise); } } });
    payments.filter((p) => p.purpose === "membership").forEach((p) => { const s = series[dayKey(p.paidAt)]; if (s) s.revenuePaise += money(p.totalPaise) - money(p.refundedPaise); });

    const byCity = {};
    bookings.forEach((b) => {
      const city = b.companion?.profile?.city || "Unknown";
      byCity[city] = byCity[city] || { city, bookings: 0, completed: 0, gmvPaise: 0, commissionPaise: 0 };
      byCity[city].bookings += 1;
      if (b.status === "completed") {
        byCity[city].completed += 1;
        byCity[city].gmvPaise += money(b.amountPaise);
        byCity[city].commissionPaise += money(b.commissionPaise);
      }
    });
    const statusMix = {};
    bookings.forEach((b) => { statusMix[b.status] = (statusMix[b.status] || 0) + 1; });
    res.json({ days, series: Object.values(series), byCity: Object.values(byCity), statusMix });
  })
);

/* ------------------------------ members ------------------------------ */

const memberRow = (u) => ({
  id: u.id,
  role: u.role,
  name: u.fullName,
  email: u.email,
  mobile: u.mobile,
  age: u.age(),
  status: u.status,
  membershipStatus: u.membershipStatus,
  membershipExpiresAt: u.membershipExpiresAt,
  kycStatus: u.kycStatus,
  approvalStatus: u.profile?.approvalStatus,
  verified: Boolean(u.profile?.isVerified),
  city: u.profile?.city,
  area: u.profile?.area,
  createdAt: u.createdAt,
  lastLoginAt: u.lastLoginAt,
});

router.get(
  "/users",
  ANY,
  wrap(async (req, res) => {
    const { limit, offset, page } = paging(req.query);
    const where = {};
    if (req.query.role) where.role = req.query.role;
    if (req.query.status) where.status = req.query.status;
    if (req.query.q) {
      const q = `%${String(req.query.q).trim()}%`;
      where[Op.or] = [{ fullName: { [Op.like]: q } }, { email: { [Op.like]: q } }, { mobile: { [Op.like]: q } }];
    }
    const { rows, count } = await User.findAndCountAll({
      where,
      include: [{ model: Profile, as: "profile" }],
      order: [["createdAt", "DESC"]],
      limit,
      offset,
    });
    res.json({ total: count, page, users: rows.map(memberRow) });
  })
);

router.get(
  "/users/:id(\\d+)",
  ANY,
  wrap(async (req, res) => {
    const u = await User.findByPk(req.params.id, { include: [{ model: Profile, as: "profile" }, { model: Photo, as: "photos" }] });
    if (!u) throw notFound();
    const [kyc, bookings, reportsAgainst, reportsBy, payments, payoutAccount, subs] = await Promise.all([
      KycDocument.findAll({ where: { userId: u.id }, order: [["createdAt", "DESC"]] }),
      Booking.findAll({ where: { [Op.or]: [{ customerId: u.id }, { companionId: u.id }] }, order: [["createdAt", "DESC"]], limit: 50 }),
      Report.findAll({ where: { reportedId: u.id }, order: [["createdAt", "DESC"]] }),
      Report.count({ where: { reporterId: u.id } }),
      Payment.findAll({ where: { userId: u.id }, order: [["createdAt", "DESC"]], limit: 50 }),
      PayoutAccount.findOne({ where: { companionId: u.id } }),
      Subscription.findAll({ where: { userId: u.id }, order: [["createdAt", "DESC"]] }),
    ]);
    await recordView(req, { action: "user.view", entityType: "user", entityId: u.id });
    res.json({
      member: memberRow(u),
      profile: u.profile && {
        gender: u.profile.gender,
        bio: u.profile.bio,
        languages: u.profile.languages,
        occupation: u.profile.occupation,
        rating: Number(u.profile.ratingAvg),
        ratingCount: u.profile.ratingCount,
        completedMeets: u.profile.completedMeets,
        selfieStatus: u.profile.selfieStatus,
        selfieMatchScore: u.profile.selfieMatchScore === null ? null : Number(u.profile.selfieMatchScore),
        approvalNote: u.profile.approvalNote,
        emergencyContactName: u.profile.emergencyContactName,
      },
      photos: u.photos.map((p) => ({ id: p.id, url: publicUrl(p.path), thumbUrl: publicUrl(p.thumbPath), status: p.moderationStatus, isPrimary: p.isPrimary })),
      kyc: kyc.map((d) => ({ id: d.id, docType: d.docType, numberMasked: d.numberMasked, status: d.status, rejectionReason: d.rejectionReason, createdAt: d.createdAt })),
      bookings: bookings.map((b) => ({ id: b.id, status: b.status, startAt: b.startAt, amountPaise: money(b.amountPaise), side: b.customerId === u.id ? "customer" : "companion" })),
      reportsAgainst: reportsAgainst.map((r) => ({ id: r.id, reason: r.reason, status: r.status, createdAt: r.createdAt })),
      reportsFiled: reportsBy,
      payments: payments.map(paymentService.summary),
      subscriptions: subs.map((s) => ({ id: s.id, status: s.status, startsAt: s.startsAt, endsAt: s.endsAt, totalPaise: money(s.totalPaise) })),
      payoutAccount: payoutAccount && { method: payoutAccount.method, upiId: payoutAccount.upiId, accountLast4: payoutAccount.accountLast4, ifsc: payoutAccount.ifsc },
    });
  })
);

router.post(
  "/users/:id(\\d+)/status",
  MOD,
  wrap(async (req, res) => {
    const u = await User.findByPk(req.params.id);
    if (!u) throw notFound();
    const status = req.body.status;
    if (!["active", "warned", "suspended", "banned"].includes(status)) throw badRequest("Choose a status.");
    await u.update({ status });
    if (["suspended", "banned"].includes(status)) await revokeAllForUser(u.id);
    await record(req, { action: `user.${status}`, entityType: "user", entityId: u.id, detail: req.body.note || null });
    if (status === "warned") {
      await notify(u.id, { type: "warning", title: "A warning from our safety team", body: req.body.note || "Please review our community guidelines.", link: "/community-guidelines" });
    }
    res.json({ ok: true, status });
  })
);

/* ------------------------------ companion approval ------------------------------ */

router.get(
  "/approvals",
  MOD,
  wrap(async (req, res) => {
    const rows = await Profile.findAll({
      where: { approvalStatus: req.query.status || "pending" },
      include: [{ model: User, as: "user", where: { role: "companion" }, include: [{ model: Photo, as: "photos" }] }],
      order: [["updatedAt", "ASC"]],
    });
    res.json({
      queue: rows.map((p) => ({
        userId: p.userId,
        name: p.user.fullName,
        email: p.user.email,
        age: p.user.age(),
        area: p.area,
        bio: p.bio,
        kycStatus: p.user.kycStatus,
        selfieStatus: p.selfieStatus,
        selfieMatchScore: p.selfieMatchScore === null ? null : Number(p.selfieMatchScore),
        photos: p.user.photos.map((x) => ({ id: x.id, url: publicUrl(x.thumbPath), status: x.moderationStatus })),
        submittedAt: p.updatedAt,
      })),
    });
  })
);

router.post(
  "/approvals/:userId(\\d+)",
  MOD,
  wrap(async (req, res) => {
    const p = await Profile.findOne({ where: { userId: req.params.userId } });
    if (!p) throw notFound();
    const approve = req.body.decision === "approve";
    if (approve) {
      const u = await User.findByPk(p.userId);
      if (u.kycStatus !== "approved") throw conflict("Approve the KYC document first.");
      if (p.selfieStatus !== "approved") throw conflict("Approve the selfie check first.");
      const okPhoto = await Photo.count({ where: { userId: p.userId, moderationStatus: "approved" } });
      if (!okPhoto) throw conflict("Approve at least one photo first.");
    }
    await p.update({
      approvalStatus: approve ? "approved" : "rejected",
      approvalNote: req.body.note || null,
      approvedAt: approve ? new Date() : null,
    });
    await record(req, { action: approve ? "companion.approve" : "companion.reject", entityType: "user", entityId: p.userId, detail: req.body.note || null });
    await notify(p.userId, approve
      ? { type: "profile_approved", title: "You're live!", body: "Your profile is approved and now appears in search.", link: "/profile" }
      : { type: "profile_rejected", title: "Your profile needs changes", body: req.body.note || "See your profile for details.", link: "/profile" });
    res.json({ ok: true });
  })
);

/* ------------------------------ photos ------------------------------ */

router.get(
  "/photos",
  MOD,
  wrap(async (req, res) => {
    const rows = await Photo.findAll({
      where: { moderationStatus: req.query.status || "pending" },
      include: [{ model: User, as: "owner", attributes: ["id", "fullName", "role"] }],
      order: [["createdAt", "ASC"]],
      limit: 100,
    });
    res.json({ photos: rows.map((p) => ({ id: p.id, url: publicUrl(p.path), thumbUrl: publicUrl(p.thumbPath), status: p.moderationStatus, owner: p.owner && { id: p.owner.id, name: p.owner.fullName, role: p.owner.role }, createdAt: p.createdAt })) });
  })
);

/**
 * Photo moderation, one person at a time.
 *
 *   GET /photos/people?status=pending   people with photos in that state
 *   GET /photos/people/:userId          one person's photos (every state)
 */
router.get(
  "/photos/people",
  MOD,
  wrap(async (req, res) => {
    const status = ["pending", "approved", "rejected"].includes(req.query.status) ? req.query.status : "pending";
    const rows = await Photo.findAll({
      where: { moderationStatus: status },
      include: [{ model: User, as: "owner", attributes: ["id", "fullName", "role"], include: [{ model: Profile, as: "profile", attributes: ["area", "city", "approvalStatus"] }] }],
      order: [["createdAt", "ASC"]],
      limit: 1000,
    });
    const people = new Map();
    for (const p of rows) {
      if (!p.owner) continue;
      const entry = people.get(p.owner.id) || {
        userId: p.owner.id,
        name: p.owner.fullName,
        role: p.owner.role,
        area: [p.owner.profile?.area, p.owner.profile?.city].filter(Boolean).join(", "),
        profileStatus: p.owner.profile?.approvalStatus || null,
        count: 0,
        firstAt: p.createdAt,
        cover: publicUrl(p.thumbPath),
      };
      entry.count += 1;
      people.set(p.owner.id, entry);
    }
    // Longest-waiting first.
    res.json({ status, people: [...people.values()].sort((a, b) => new Date(a.firstAt) - new Date(b.firstAt)) });
  })
);

router.get(
  "/photos/people/:userId(\\d+)",
  MOD,
  wrap(async (req, res) => {
    const u = await User.findByPk(req.params.userId, {
      attributes: ["id", "fullName", "role", "dateOfBirth", "kycStatus"],
      include: [
        { model: Profile, as: "profile", attributes: ["area", "city", "bio", "approvalStatus", "selfieStatus"] },
        { model: Photo, as: "photos" },
      ],
    });
    if (!u) throw notFound();
    const order = { pending: 0, rejected: 1, approved: 2 };
    res.json({
      person: {
        userId: u.id,
        name: u.fullName,
        role: u.role,
        age: u.age(),
        area: [u.profile?.area, u.profile?.city].filter(Boolean).join(", "),
        bio: u.profile?.bio || "",
        profileStatus: u.profile?.approvalStatus || null,
        kycStatus: u.kycStatus,
        selfieStatus: u.profile?.selfieStatus || null,
      },
      photos: u.photos
        .sort((a, b) => order[a.moderationStatus] - order[b.moderationStatus] || a.position - b.position)
        .map((p) => ({
          id: p.id,
          url: publicUrl(p.path),
          thumbUrl: publicUrl(p.thumbPath),
          status: p.moderationStatus,
          isPrimary: p.isPrimary,
          rejectionReason: p.rejectionReason,
          createdAt: p.createdAt,
        })),
    });
  })
);

router.post(
  "/photos/:id(\\d+)",
  MOD,
  wrap(async (req, res) => {
    const p = await Photo.findByPk(req.params.id);
    if (!p) throw notFound();
    const approve = req.body.decision === "approve";
    await p.update({ moderationStatus: approve ? "approved" : "rejected", moderatedById: req.admin.id, moderatedAt: new Date(), rejectionReason: approve ? null : req.body.reason || "Does not meet our photo guidelines" });
    await record(req, { action: approve ? "photo.approve" : "photo.reject", entityType: "photo", entityId: p.id });
    if (!approve) await notify(p.userId, { type: "photo_rejected", title: "A photo was not approved", body: p.rejectionReason, link: "/profile" });
    res.json({ ok: true });
  })
);

/* ------------------------------ KYC & selfie ------------------------------ */

router.get(
  "/kyc",
  MOD,
  wrap(async (req, res) => {
    const docs = await KycDocument.findAll({
      where: { status: req.query.status || "submitted" },
      include: [{ model: User, as: "owner", attributes: ["id", "fullName", "dateOfBirth"], include: [{ model: Profile, as: "profile", attributes: ["selfieStatus", "selfieMatchScore"] }] }],
      order: [["createdAt", "ASC"]],
    });
    const selfies = await Profile.findAll({
      where: { selfieStatus: "submitted" },
      include: [{ model: User, as: "user", attributes: ["id", "fullName"], include: [{ model: Photo, as: "photos", where: { isPrimary: true }, required: false }] }],
    });
    res.json({
      documents: docs.map((d) => ({ id: d.id, userId: d.userId, name: d.owner?.fullName, docType: d.docType, numberMasked: d.numberMasked, status: d.status, createdAt: d.createdAt, age: d.owner ? d.owner.age() : null })),
      selfies: selfies.map((p) => ({ userId: p.userId, name: p.user?.fullName, matchScore: p.selfieMatchScore === null ? null : Number(p.selfieMatchScore), photoUrl: p.user?.photos?.[0] ? publicUrl(p.user.photos[0].thumbPath) : null })),
    });
  })
);

/** Streams a private file to staff. Each view is audited. */
function streamPrivate(res, rel) {
  if (!rel || !rel.startsWith("private/")) throw notFound();
  const file = absolute(rel);
  if (!fs.existsSync(file)) throw notFound("The file is missing.");
  res.set("Cache-Control", "no-store");
  res.type("jpeg");
  fs.createReadStream(file).pipe(res);
}

router.get(
  "/kyc/:id(\\d+)/file",
  MOD,
  wrap(async (req, res) => {
    const d = await KycDocument.findByPk(req.params.id);
    if (!d) throw notFound();
    await recordView(req, { action: "kyc.view_file", entityType: "kyc_document", entityId: d.id });
    streamPrivate(res, d.filePath);
  })
);

router.get(
  "/selfie/:userId(\\d+)/file",
  MOD,
  wrap(async (req, res) => {
    const p = await Profile.findOne({ where: { userId: req.params.userId } });
    if (!p) throw notFound();
    await recordView(req, { action: "selfie.view_file", entityType: "user", entityId: p.userId });
    streamPrivate(res, p.selfiePath);
  })
);

/** Sets the Verified badge once both KYC and selfie are approved. */
async function refreshVerified(userId) {
  const u = await User.findByPk(userId, { include: [{ model: Profile, as: "profile" }] });
  const verified = u.kycStatus === "approved" && u.profile.selfieStatus === "approved";
  if (u.profile.isVerified !== verified) await u.profile.update({ isVerified: verified });
  return verified;
}

router.post(
  "/kyc/:id(\\d+)",
  MOD,
  wrap(async (req, res) => {
    const d = await KycDocument.findByPk(req.params.id);
    if (!d) throw notFound();
    const approve = req.body.decision === "approve";
    await d.update({ status: approve ? "approved" : "rejected", reviewedById: req.admin.id, reviewedAt: new Date(), rejectionReason: approve ? null : req.body.reason || "Document could not be verified" });
    await User.update({ kycStatus: approve ? "approved" : "rejected" }, { where: { id: d.userId } });
    await refreshVerified(d.userId);
    await record(req, { action: approve ? "kyc.approve" : "kyc.reject", entityType: "kyc_document", entityId: d.id });
    await notify(d.userId, approve
      ? { type: "kyc_approved", title: "Your ID is verified", link: "/profile" }
      : { type: "kyc_rejected", title: "Your ID could not be verified", body: d.rejectionReason, link: "/profile" });
    res.json({ ok: true });
  })
);

router.post(
  "/selfie/:userId(\\d+)",
  MOD,
  wrap(async (req, res) => {
    const p = await Profile.findOne({ where: { userId: req.params.userId } });
    if (!p) throw notFound();
    const approve = req.body.decision === "approve";
    await p.update({ selfieStatus: approve ? "approved" : "rejected" });
    const verified = await refreshVerified(p.userId);
    await record(req, { action: approve ? "selfie.approve" : "selfie.reject", entityType: "user", entityId: p.userId });
    await notify(p.userId, approve
      ? { type: "selfie_approved", title: verified ? "You now have the Verified badge" : "Your selfie check passed", link: "/profile" }
      : { type: "selfie_rejected", title: "Your selfie did not match your photo", body: "Retake it in good light, facing the camera.", link: "/profile" });
    res.json({ ok: true, verified });
  })
);

/* ------------------------------ bookings & disputes ------------------------------ */

router.get(
  "/bookings",
  ANY,
  wrap(async (req, res) => {
    const { limit, offset, page } = paging(req.query);
    const where = {};
    if (req.query.status) where.status = req.query.status;
    const { rows, count } = await Booking.findAndCountAll({
      where,
      include: [
        { model: User, as: "customer", attributes: ["id", "fullName"] },
        { model: User, as: "companion", attributes: ["id", "fullName"] },
      ],
      order: [["createdAt", "DESC"]],
      limit,
      offset,
    });
    res.json({
      total: count,
      page,
      bookings: rows.map((b) => ({
        id: b.id,
        status: b.status,
        customer: b.customer && { id: b.customer.id, name: b.customer.fullName },
        companion: b.companion && { id: b.companion.id, name: b.companion.fullName },
        startAt: b.startAt,
        hours: Number(b.hours),
        amountPaise: money(b.amountPaise),
        commissionPaise: money(b.commissionPaise),
        meetingPlaceName: b.meetingPlaceName,
        disputeReason: b.disputeReason,
        createdAt: b.createdAt,
      })),
    });
  })
);

router.get(
  "/bookings/:id(\\d+)",
  ANY,
  wrap(async (req, res) => {
    const b = await Booking.findByPk(req.params.id, {
      include: [
        { model: User, as: "customer", attributes: ["id", "fullName", "email", "mobile"] },
        { model: User, as: "companion", attributes: ["id", "fullName", "email", "mobile"] },
        { model: ServiceCategory, as: "service" },
        { model: Conversation, as: "conversation" },
        { model: Review, as: "reviews" },
      ],
    });
    if (!b) throw notFound();
    const [payments, payout, reports] = await Promise.all([
      Payment.findAll({ where: { bookingId: b.id } }),
      Payout.findOne({ where: { bookingId: b.id } }),
      Report.findAll({ where: { bookingId: b.id } }),
    ]);
    res.json({
      booking: { ...bookingService.bookingJson(b, b.customerId), customerContact: { email: b.customer.email, mobile: b.customer.mobile }, companionContact: { email: b.companion.email, mobile: b.companion.mobile } },
      payments: payments.map(paymentService.summary),
      payout: payout && { id: payout.id, status: payout.status, amountPaise: money(payout.amountPaise), reference: payout.bankReference, note: payout.note, paidAt: payout.paidAt },
      reports: reports.map((r) => ({ id: r.id, reason: r.reason, status: r.status })),
      conversationId: b.conversation?.id || null,
      canReadChat: reports.length > 0 || b.status === "disputed",
    });
  })
);

/**
 * Settles a dispute:
 *   release       the meet happened → pay the Companion now
 *   refund_full   → refund the Customer in full, no payout
 *   refund_partial (refundPct) → split: refund part, pay the Companion the rest
 *                                 (less the platform's commission)
 */
router.post(
  "/bookings/:id(\\d+)/resolve",
  FIN,
  wrap(async (req, res) => {
    const b = await Booking.findByPk(req.params.id);
    if (!b) throw notFound();
    const settleable = ["disputed", "confirmed", "in_progress"].includes(b.status) || (b.status === "completed" && !b.payoutReleasedAt);
    if (!settleable) throw conflict("This booking has already been settled.");
    const outcome = req.body.outcome;
    const note = String(req.body.note || "").slice(0, 500);
    const payment = await Payment.findOne({ where: { bookingId: b.id, status: { [Op.in]: ["paid", "refunded"] } } });

    if (outcome === "release") {
      await b.update({ disputeResolution: note || "Released to the Companion" });
      await Payout.update({ status: "pending", note: null }, { where: { bookingId: b.id, status: "on_hold" } });
      await bookingService.finish(b, "admin released");
      await bookingService.releasePayout(b.id);
    } else if (outcome === "refund_full" || outcome === "refund_partial") {
      const pct = outcome === "refund_full" ? 100 : Math.min(Math.max(Number(req.body.refundPct) || 0, 1), 99);
      const refunded = payment ? await bookingService.refundPayment(payment, Math.round((money(payment.totalPaise) * pct) / 100)) : 0;
      await b.update({ status: pct === 100 ? "cancelled" : "completed", completedAt: pct === 100 ? null : new Date(), cancelledAt: pct === 100 ? new Date() : null, refundPaise: refunded, disputeResolution: note || `Refunded ${pct}%` });
      if (pct < 100) {
        const kept = Math.round((money(b.amountPaise) * (100 - pct)) / 100);
        const share = Math.round((kept * (100 - Number(b.commissionPct))) / 100);
        const [p] = await Payout.findOrCreate({ where: { bookingId: b.id }, defaults: { companionId: b.companionId, bookingId: b.id, amountPaise: share, status: "pending" } });
        await p.update({ amountPaise: share, status: "pending", note: "Partial, after dispute" });
        await bookingService.releasePayout(b.id);
      } else {
        await Payout.update({ status: "on_hold", note: "Refunded to Customer after dispute", amountPaise: 0 }, { where: { bookingId: b.id, status: { [Op.ne]: "paid" } } });
      }
    } else {
      throw badRequest("Choose an outcome.");
    }
    await Conversation.update({ isClosed: true }, { where: { bookingId: b.id } });
    await record(req, { action: `booking.resolve.${outcome}`, entityType: "booking", entityId: b.id, detail: note });
    for (const uid of [b.customerId, b.companionId]) {
      await notify(uid, { type: "dispute_resolved", title: `Booking #${b.id}: our decision`, body: note || outcome.replace("_", " "), link: `/bookings/${b.id}` });
    }
    res.json({ ok: true });
  })
);

/** Admin cancellation with a full refund (safety, no-shows). */
router.post(
  "/bookings/:id(\\d+)/cancel",
  FIN,
  wrap(async (req, res) => {
    const b = await Booking.findByPk(req.params.id);
    if (!b) throw notFound();
    if (!["pending", "accepted", "confirmed", "in_progress", "disputed"].includes(b.status)) throw conflict("This booking cannot be cancelled.");
    const payment = await Payment.findOne({ where: { bookingId: b.id, status: "paid" } });
    const refunded = payment ? await bookingService.refundPayment(payment, money(payment.totalPaise)) : 0;
    await b.update({ status: "cancelled", cancelledAt: new Date(), cancelReason: req.body.reason || "Cancelled by the platform", refundPaise: refunded });
    await Conversation.update({ isClosed: true }, { where: { bookingId: b.id } });
    await record(req, { action: "booking.admin_cancel", entityType: "booking", entityId: b.id, detail: req.body.reason || null });
    for (const uid of [b.customerId, b.companionId]) {
      await notify(uid, { type: "booking_cancelled", title: `Booking #${b.id} was cancelled by our team`, body: refunded ? "The Customer has been refunded in full." : "", link: `/bookings/${b.id}`, urgent: true });
    }
    res.json({ ok: true, refundedPaise: refunded });
  })
);

/* ------------------------------ payments, refunds, payouts ------------------------------ */

router.get(
  "/payments",
  FIN,
  wrap(async (req, res) => {
    const { limit, offset, page } = paging(req.query);
    const where = {};
    if (req.query.status) where.status = req.query.status;
    if (req.query.purpose) where.purpose = req.query.purpose;
    const { rows, count } = await Payment.findAndCountAll({ where, include: [{ model: User, as: "payer", attributes: ["id", "fullName"] }], order: [["createdAt", "DESC"]], limit, offset });
    res.json({ total: count, page, payments: rows.map((p) => ({ ...paymentService.summary(p), payer: p.payer && { id: p.payer.id, name: p.payer.fullName }, gateway: p.gateway, gatewayPaymentId: p.gatewayPaymentId })) });
  })
);

router.get(
  "/payments/:id(\\d+)/invoice",
  FIN,
  wrap(async (req, res) => res.type("html").send(await paymentService.invoiceHtml(null, req.params.id, { asAdmin: true })))
);

router.post(
  "/payments/:id(\\d+)/refund",
  FIN,
  wrap(async (req, res) => {
    const p = await Payment.findByPk(req.params.id);
    if (!p || !["paid", "refunded"].includes(p.status)) throw notFound("Only a completed payment can be refunded.");
    const amount = Math.round(Number(req.body.amountPaise) || 0);
    if (amount <= 0) throw badRequest("Enter an amount to refund.");
    const refunded = await bookingService.refundPayment(p, amount);
    if (p.bookingId) await Booking.update({ refundPaise: money(p.refundedPaise) }, { where: { id: p.bookingId } });
    await record(req, { action: "payment.refund", entityType: "payment", entityId: p.id, detail: `${refunded} paise. ${req.body.reason || ""}` });
    await notify(p.userId, { type: "refund", title: `Refund of ₹${refunded / 100} issued`, body: req.body.reason || "", link: "/payments-history" });
    res.json({ ok: true, refundedPaise: refunded });
  })
);

router.get(
  "/payouts",
  FIN,
  wrap(async (req, res) => {
    const where = {};
    if (req.query.status) where.status = req.query.status;
    const rows = await Payout.findAll({ where, include: [{ model: User, as: "companion", attributes: ["id", "fullName", "kycStatus"] }], order: [["createdAt", "DESC"]], limit: 200 });
    res.json({ payouts: rows.map((p) => ({ id: p.id, bookingId: p.bookingId, companion: p.companion && { id: p.companion.id, name: p.companion.fullName, kycStatus: p.companion.kycStatus }, amountPaise: money(p.amountPaise), status: p.status, note: p.note, reference: p.bankReference, paidAt: p.paidAt, createdAt: p.createdAt })) });
  })
);

router.post(
  "/payouts/:id(\\d+)/release",
  FIN,
  wrap(async (req, res) => {
    const p = await Payout.findByPk(req.params.id);
    if (!p) throw notFound();
    if (p.status === "paid") throw conflict("Already paid.");
    await p.update({ status: "pending", note: null });
    await bookingService.releasePayout(p.bookingId);
    await p.reload();
    await record(req, { action: "payout.release", entityType: "payout", entityId: p.id });
    res.json({ ok: true, status: p.status, note: p.note });
  })
);

/** Paid outside the provider (manual bank transfer): record the reference. */
router.post(
  "/payouts/:id(\\d+)/mark-paid",
  FIN,
  wrap(async (req, res) => {
    const p = await Payout.findByPk(req.params.id);
    if (!p) throw notFound();
    if (!req.body.reference) throw badRequest("Enter the bank reference.");
    await p.update({ status: "paid", bankReference: String(req.body.reference).slice(0, 80), paidAt: new Date(), processedById: req.admin.id, note: null });
    await Booking.update({ payoutReleasedAt: new Date() }, { where: { id: p.bookingId } });
    await record(req, { action: "payout.mark_paid", entityType: "payout", entityId: p.id, detail: p.bankReference });
    res.json({ ok: true });
  })
);

/* ------------------------------ reports, chat review, SOS ------------------------------ */

router.get(
  "/reports",
  MOD,
  wrap(async (req, res) => {
    const where = {};
    if (req.query.status) where.status = req.query.status;
    else where.status = { [Op.in]: ["open", "reviewing"] };
    const rows = await Report.findAll({
      where,
      include: [
        { model: User, as: "reporter", attributes: ["id", "fullName"] },
        { model: User, as: "reported", attributes: ["id", "fullName", "status"] },
      ],
      order: [["priority", "DESC"], ["createdAt", "ASC"]],
      limit: 200,
    });
    res.json({ reports: rows.map((r) => ({ id: r.id, reason: r.reason, priority: r.priority, status: r.status, details: r.details, bookingId: r.bookingId, messageId: r.messageId, reporter: r.reporter && { id: r.reporter.id, name: r.reporter.fullName }, reported: r.reported && { id: r.reported.id, name: r.reported.fullName, status: r.reported.status }, outcome: r.outcome, createdAt: r.createdAt })) });
  })
);

router.post(
  "/reports/:id(\\d+)",
  MOD,
  wrap(async (req, res) => {
    const r = await Report.findByPk(req.params.id);
    if (!r) throw notFound();
    const status = req.body.status;
    if (!["reviewing", "actioned", "dismissed"].includes(status)) throw badRequest("Choose a status.");
    const action = req.body.action || "none";
    if (["warned", "suspended", "banned"].includes(action)) {
      await User.update({ status: action }, { where: { id: r.reportedId } });
      if (action !== "warned") await revokeAllForUser(r.reportedId);
      else await notify(r.reportedId, { type: "warning", title: "A warning from our safety team", body: req.body.outcome || "Please review our community guidelines.", link: "/community-guidelines" });
    }
    await r.update({ status, outcome: req.body.outcome || null, handledById: req.admin.id, handledAt: new Date() });
    await record(req, { action: `report.${status}`, entityType: "report", entityId: r.id, detail: `${action}. ${req.body.outcome || ""}` });
    if (status !== "reviewing") await notify(r.reporterId, { type: "report_closed", title: "We reviewed your report", body: "Thank you for helping keep the community safe." });
    res.json({ ok: true });
  })
);

router.get(
  "/messages/flagged",
  MOD,
  wrap(async (req, res) => {
    const rows = await Message.findAll({
      where: { flagged: true },
      include: [{ model: User, as: "sender", attributes: ["id", "fullName"] }],
      order: [["createdAt", "DESC"]],
      limit: 200,
    });
    res.json({ messages: rows.map((m) => ({ id: m.id, conversationId: m.conversationId, sender: m.sender && { id: m.sender.id, name: m.sender.fullName }, body: m.body, flagReason: m.flagReason, createdAt: m.createdAt })) });
  })
);

router.post(
  "/messages/:id(\\d+)/clear",
  MOD,
  wrap(async (req, res) => {
    await Message.update({ flagged: false }, { where: { id: req.params.id } });
    await record(req, { action: "message.clear_flag", entityType: "message", entityId: Number(req.params.id) });
    res.json({ ok: true });
  })
);

/**
 * Reads a private chat. Allowed only where there is a reason — a report on
 * the booking or either person, a flagged message, or a dispute — and every
 * read is written to the audit log.
 */
router.get(
  "/conversations/:id(\\d+)",
  MOD,
  wrap(async (req, res) => {
    const c = await Conversation.findByPk(req.params.id, { include: [{ model: Booking, as: "booking" }] });
    if (!c) throw notFound();
    const reason =
      c.booking?.status === "disputed" ||
      (await Report.count({ where: { [Op.or]: [{ bookingId: c.bookingId }, { reportedId: { [Op.in]: [c.customerId, c.companionId] } }] } })) > 0 ||
      (await Message.count({ where: { conversationId: c.id, flagged: true } })) > 0;
    if (!reason) throw conflict("A chat can be read only when it is reported, flagged or disputed.");
    await recordView(req, { action: "chat.read", entityType: "conversation", entityId: c.id });
    const msgs = await Message.findAll({ where: { conversationId: c.id }, include: [{ model: User, as: "sender", attributes: ["id", "fullName"] }], order: [["id", "ASC"]] });
    res.json({ conversationId: c.id, bookingId: c.bookingId, messages: msgs.map((m) => ({ id: m.id, sender: m.sender?.fullName, senderId: m.senderId, body: m.body, filtered: m.bodyFiltered, flagged: m.flagged, flagReason: m.flagReason, createdAt: m.createdAt })) });
  })
);

router.get(
  "/sos",
  MOD,
  wrap(async (req, res) => {
    const rows = await SosAlert.findAll({
      where: { status: req.query.status || "active" },
      include: [{ model: User, as: "user", attributes: ["id", "fullName", "mobile"], include: [{ model: Profile, as: "profile", attributes: ["emergencyContactName", "emergencyContactPhone"] }] }, { model: Booking, as: "booking" }],
      order: [["createdAt", "DESC"]],
      limit: 100,
    });
    res.json({ alerts: rows.map((a) => ({ id: a.id, status: a.status, user: a.user && { id: a.user.id, name: a.user.fullName, mobile: a.user.mobile, emergencyContact: a.user.profile?.emergencyContactName ? `${a.user.profile.emergencyContactName} · ${a.user.profile.emergencyContactPhone}` : null }, bookingId: a.bookingId, meetingPlace: a.booking?.meetingPlaceName, latitude: a.latitude === null ? null : Number(a.latitude), longitude: a.longitude === null ? null : Number(a.longitude), locationAt: a.locationAt, createdAt: a.createdAt, resolvedNote: a.resolvedNote })) });
  })
);

router.post(
  "/sos/:id(\\d+)/resolve",
  MOD,
  wrap(async (req, res) => {
    const a = await SosAlert.findByPk(req.params.id);
    if (!a) throw notFound();
    await a.update({ status: "resolved", resolvedAt: new Date(), resolvedNote: req.body.note || "Resolved by the safety team" });
    await record(req, { action: "sos.resolve", entityType: "sos", entityId: a.id, detail: req.body.note || null });
    res.json({ ok: true });
  })
);

/* ------------------------------ reviews ------------------------------ */

router.get(
  "/reviews",
  MOD,
  wrap(async (req, res) => {
    const rows = await Review.findAll({ include: [{ model: User, as: "author", attributes: ["id", "fullName"] }, { model: User, as: "subject", attributes: ["id", "fullName"] }], order: [["createdAt", "DESC"]], limit: 200 });
    res.json({ reviews: rows.map((r) => ({ id: r.id, bookingId: r.bookingId, rating: r.rating, comment: r.comment, isHidden: r.isHidden, author: r.author?.fullName, subject: r.subject?.fullName, subjectId: r.subjectId, createdAt: r.createdAt })) });
  })
);

router.post(
  "/reviews/:id(\\d+)/visibility",
  MOD,
  wrap(async (req, res) => {
    const r = await Review.findByPk(req.params.id);
    if (!r) throw notFound();
    await r.update({ isHidden: Boolean(req.body.hidden) });
    const stats = await Review.findAll({ where: { subjectId: r.subjectId, isHidden: false }, attributes: [[sequelize.fn("AVG", sequelize.col("rating")), "avg"], [sequelize.fn("COUNT", sequelize.col("id")), "count"]], raw: true });
    await Profile.update({ ratingAvg: Number(stats[0].avg || 0).toFixed(2), ratingCount: Number(stats[0].count || 0) }, { where: { userId: r.subjectId } });
    await record(req, { action: r.isHidden ? "review.hide" : "review.show", entityType: "review", entityId: r.id });
    res.json({ ok: true });
  })
);

/* ------------------------------ settings, categories, plans ------------------------------ */

router.get(
  "/settings",
  ANY,
  wrap(async (req, res) => {
    const rows = await Setting.findAll({ order: [["group", "ASC"], ["key", "ASC"]] });
    res.json({ settings: rows.map((s) => ({ key: s.key, value: s.value, label: s.label, group: s.group })) });
  })
);

router.put(
  "/settings",
  FIN,
  wrap(async (req, res) => {
    const changes = req.body.settings || {};
    for (const [key, value] of Object.entries(changes)) {
      const row = await Setting.findOne({ where: { key } });
      if (!row) continue;
      if (key === "commission_pct" && (Number(value) < 0 || Number(value) > 50)) throw badRequest("Commission must be between 0 and 50%.");
      await row.update({ value, updatedById: req.admin.id });
      await record(req, { action: "setting.update", entityType: "setting", entityId: row.id, detail: `${key} = ${JSON.stringify(value)}` });
    }
    settings.clear();
    res.json({ ok: true });
  })
);

router.get(
  "/categories",
  ANY,
  wrap(async (req, res) => {
    const rows = await ServiceCategory.findAll({ order: [["sortOrder", "ASC"], ["name", "ASC"]] });
    res.json({ categories: rows });
  })
);

const slugify = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

router.post(
  "/categories",
  MOD,
  wrap(async (req, res) => {
    const name = String(req.body.name || "").trim();
    if (name.length < 2) throw badRequest("Name the category.");
    const row = await ServiceCategory.create({ name, slug: slugify(name), description: req.body.description || null, sortOrder: Number(req.body.sortOrder) || 0 });
    await record(req, { action: "category.create", entityType: "category", entityId: row.id, detail: name });
    res.status(201).json(row);
  })
);

router.put(
  "/categories/:id(\\d+)",
  MOD,
  wrap(async (req, res) => {
    const row = await ServiceCategory.findByPk(req.params.id);
    if (!row) throw notFound();
    const patch = {};
    if (req.body.name) { patch.name = String(req.body.name).trim(); patch.slug = slugify(patch.name); }
    if (req.body.description !== undefined) patch.description = req.body.description || null;
    if (req.body.isActive !== undefined) patch.isActive = Boolean(req.body.isActive);
    if (req.body.sortOrder !== undefined) patch.sortOrder = Number(req.body.sortOrder) || 0;
    await row.update(patch);
    await record(req, { action: "category.update", entityType: "category", entityId: row.id });
    res.json(row);
  })
);

router.get("/plans", ANY, wrap(async (req, res) => res.json({ plans: await Plan.findAll({ order: [["sortOrder", "ASC"]] }) })));

router.put(
  "/plans/:id(\\d+)",
  FIN,
  wrap(async (req, res) => {
    const row = await Plan.findByPk(req.params.id);
    if (!row) throw notFound();
    const patch = {};
    for (const k of ["name", "blurb"]) if (req.body[k] !== undefined) patch[k] = req.body[k];
    for (const k of ["days", "pricePaise", "gstPct", "sortOrder"]) if (req.body[k] !== undefined) patch[k] = Number(req.body[k]);
    if (req.body.isActive !== undefined) patch.isActive = Boolean(req.body.isActive);
    await row.update(patch);
    await record(req, { action: "plan.update", entityType: "plan", entityId: row.id });
    res.json(row);
  })
);

/* ------------------------------ audit & staff ------------------------------ */

router.get(
  "/audit",
  SUPER,
  wrap(async (req, res) => {
    const { limit, offset, page } = paging(req.query, { max: 200, def: 100 });
    const { rows, count } = await AuditLog.findAndCountAll({ order: [["id", "DESC"]], limit, offset });
    res.json({ total: count, page, entries: rows });
  })
);

router.get(
  "/staff",
  SUPER,
  wrap(async (req, res) => {
    const rows = await AdminUser.findAll({ order: [["id", "ASC"]] });
    res.json({ staff: rows.map((a) => ({ id: a.id, name: a.name, email: a.email, role: a.role, isActive: a.isActive, lastLoginAt: a.lastLoginAt })) });
  })
);

router.post(
  "/staff",
  SUPER,
  wrap(async (req, res) => {
    const { name, email, password, role } = req.body;
    if (!name || !email || String(password || "").length < 10) throw badRequest("Name, email and a password of at least 10 characters are needed.");
    if (!["super_admin", "finance", "moderator", "support"].includes(role)) throw badRequest("Choose a role.");
    const row = await AdminUser.create({ name, email: String(email).toLowerCase().trim(), role, passwordHash: await bcrypt.hash(password, env.auth.bcryptRounds) });
    await record(req, { action: "staff.create", entityType: "admin", entityId: row.id, detail: `${row.email} as ${role}` });
    res.status(201).json({ id: row.id });
  })
);

router.put(
  "/staff/:id(\\d+)",
  SUPER,
  wrap(async (req, res) => {
    const row = await AdminUser.findByPk(req.params.id);
    if (!row) throw notFound();
    if (row.id === req.admin.id && req.body.isActive === false) throw badRequest("You cannot deactivate yourself.");
    if (row.id === req.admin.id && req.body.role && req.body.role !== row.role) throw badRequest("You cannot change your own role.");
    if (req.body.role && !["super_admin", "finance", "moderator", "support"].includes(req.body.role)) throw badRequest("Choose a role.");
    const patch = {};
    if (req.body.role) patch.role = req.body.role;
    if (req.body.isActive !== undefined) patch.isActive = Boolean(req.body.isActive);
    await row.update(patch);
    await record(req, { action: "staff.update", entityType: "admin", entityId: row.id, detail: JSON.stringify(patch) });
    res.json({ ok: true });
  })
);

module.exports = router;
