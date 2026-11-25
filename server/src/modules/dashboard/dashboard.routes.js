const express = require("express");
const { Op } = require("sequelize");
const {
  Booking, Payment, Payout, PayoutAccount, Profile, Photo, Conversation, Message, Notification, Block, Favorite,
} = require("../../models");
const { wrap } = require("../../lib/handler");
const { requireAuth } = require("../../middleware/auth");
const bookings = require("../bookings/booking.service");

/**
 * The member's own dashboard: one call, everything at a glance.
 *
 *   GET /dashboard
 *
 * Read-only on purpose — unlike GET /earnings it never releases held
 * payouts, so it is safe in a staff support view too.
 *
 * Every transaction is a row in one list, newest first:
 *   payment  money the member paid (membership or a booking), GST included
 *   refund   money given back to the member
 *   payout   money sent (or waiting to be sent) to a Companion
 */
const router = express.Router();
router.use(requireAuth);

const n = (v) => Number(v || 0);
const sum = (rows, f) => rows.reduce((t, r) => t + n(r[f]), 0);
const sameMonth = (d, now = new Date()) => d && new Date(d).getMonth() === now.getMonth() && new Date(d).getFullYear() === now.getFullYear();

/**
 * Everyone the member has completed a meet with, most recent first: how
 * many meets, the last one, and the money between them. People either side
 * has blocked are left out.
 */
async function peopleMet(me) {
  const asCustomer = me.role !== "companion";
  const otherSide = asCustomer ? "companion" : "customer";
  const done = await Booking.findAll({
    where: { [asCustomer ? "customerId" : "companionId"]: me.id, status: "completed" },
    attributes: ["id", "customerId", "companionId", "startAt", "completedAt", "amountPaise", "payoutPaise"],
    include: [bookings.PARTY_INCLUDE(otherSide)],
    order: [["startAt", "DESC"]],
    limit: 500,
  });
  const blocks = await Block.findAll({ where: { [Op.or]: [{ blockerId: me.id }, { blockedId: me.id }] }, attributes: ["blockerId", "blockedId"] });
  const blocked = new Set(blocks.map((b) => (b.blockerId === me.id ? b.blockedId : b.blockerId)));
  const favs = asCustomer ? new Set((await Favorite.findAll({ where: { userId: me.id }, attributes: ["companionId"] })).map((f) => f.companionId)) : new Set();

  const byPerson = new Map();
  for (const b of done) {
    const other = b[otherSide];
    if (!other || blocked.has(other.id)) continue;
    const row = byPerson.get(other.id) || { ...bookings.partyJson(other), meets: 0, totalPaise: 0, lastMetAt: null, lastBookingId: null, favorite: favs.has(other.id) };
    row.meets += 1;
    row.totalPaise += n(asCustomer ? b.amountPaise : b.payoutPaise);
    if (!row.lastMetAt) { row.lastMetAt = b.startAt; row.lastBookingId = b.id; }
    byPerson.set(other.id, row);
  }
  return [...byPerson.values()];
}

router.get(
  "/people",
  wrap(async (req, res) => res.json({ people: await peopleMet(req.user) }))
);

router.get(
  "/",
  wrap(async (req, res) => {
    const me = req.user;
    const isCompanion = me.role === "companion";
    const mine = { [Op.or]: [{ customerId: me.id }, { companionId: me.id }] };

    const [payments, payouts, allBookings, upcoming, requests, profile, photos, account, convIds, unreadNotifications] = await Promise.all([
      Payment.findAll({ where: { userId: me.id, status: { [Op.in]: ["paid", "refunded"] } }, order: [["paidAt", "DESC"]] }),
      isCompanion
        ? Payout.findAll({ where: { companionId: me.id }, include: [{ model: Booking, as: "booking", attributes: ["id", "amountPaise", "commissionPaise"] }], order: [["createdAt", "DESC"]] })
        : [],
      Booking.findAll({ where: mine, attributes: ["id", "status", "customerId", "companionId", "amountPaise", "payoutPaise"] }),
      bookings.list(me, { tab: "upcoming" }),
      bookings.list(me, { tab: "requests" }),
      Profile.findOne({ where: { userId: me.id }, attributes: ["approvalStatus", "completedMeets", "ratingAvg", "ratingCount", "bio"] }),
      Photo.findAll({ where: { userId: me.id }, attributes: ["moderationStatus"] }),
      isCompanion ? PayoutAccount.findOne({ where: { companionId: me.id } }) : null,
      Conversation.findAll({ where: mine, attributes: ["id"] }).then((rows) => rows.map((r) => r.id)),
      Notification.count({ where: { userId: me.id, readAt: null } }),
    ]);
    const unreadMessages = convIds.length
      ? await Message.count({ where: { conversationId: { [Op.in]: convIds }, senderId: { [Op.ne]: me.id }, readAt: null } })
      : 0;

    /* ---------- one list of every transaction ---------- */
    const transactions = [];
    for (const p of payments) {
      transactions.push({
        id: `pay-${p.id}`,
        kind: "payment",
        direction: "out",
        at: p.paidAt || p.createdAt,
        title: p.purpose === "membership" ? "Membership" : `Booking #${p.bookingId}`,
        bookingId: p.bookingId,
        amountPaise: n(p.totalPaise) + n(p.walletPaise),
        walletPaise: n(p.walletPaise),
        discountPaise: n(p.discountPaise),
        basePaise: n(p.amountPaise),
        gstPaise: n(p.gstPaise),
        status: "paid",
        paymentId: p.id,
        invoiceNo: p.invoiceNo,
      });
      if (n(p.refundedPaise) > 0) {
        transactions.push({
          id: `ref-${p.id}`,
          kind: "refund",
          direction: "in",
          at: p.updatedAt,
          title: p.purpose === "membership" ? "Membership refund" : `Refund · Booking #${p.bookingId}`,
          bookingId: p.bookingId,
          amountPaise: n(p.refundedPaise),
          invoiceNo: p.invoiceNo,
          status: "refunded",
        });
      }
    }
    for (const p of payouts) {
      transactions.push({
        id: `out-${p.id}`,
        kind: "payout",
        direction: "in",
        at: p.paidAt || p.createdAt,
        title: `Payout · Booking #${p.bookingId}`,
        bookingId: p.bookingId,
        amountPaise: n(p.amountPaise),
        bookingAmountPaise: p.booking ? n(p.booking.amountPaise) : null,
        feePaise: p.booking ? n(p.booking.commissionPaise) : null,
        status: p.status,
        note: p.note,
        reference: p.bankReference,
      });
    }
    transactions.sort((a, b) => new Date(b.at) - new Date(a.at));

    /* ---------- totals ---------- */
    const paidPayments = payments;
    const asCustomer = allBookings.filter((b) => b.customerId === me.id);
    const spending = {
      totalPaidPaise: sum(paidPayments, "totalPaise") + sum(paidPayments, "walletPaise"),
      refundedPaise: sum(paidPayments, "refundedPaise"),
      thisMonthPaise: sum(paidPayments.filter((p) => sameMonth(p.paidAt)), "totalPaise") + sum(paidPayments.filter((p) => sameMonth(p.paidAt)), "walletPaise"),
      // Paid for, but the meet is not over yet — the platform is holding it.
      heldPaise: sum(asCustomer.filter((b) => ["confirmed", "in_progress", "disputed"].includes(b.status)), "amountPaise"),
    };
    spending.netPaise = spending.totalPaidPaise - spending.refundedPaise;

    let earnings = null;
    if (isCompanion) {
      const asCompanion = allBookings.filter((b) => b.companionId === me.id);
      earnings = {
        paidPaise: sum(payouts.filter((p) => p.status === "paid"), "amountPaise"),
        thisMonthPaise: sum(payouts.filter((p) => p.status === "paid" && sameMonth(p.paidAt)), "amountPaise"),
        // Meet booked and paid, not finished yet.
        upcomingPaise: sum(asCompanion.filter((b) => ["confirmed", "in_progress"].includes(b.status)), "payoutPaise"),
        // Meet done; in the complaint window or waiting for release.
        waitingPaise: sum(payouts.filter((p) => ["pending", "approved"].includes(p.status)), "amountPaise"),
        onHoldPaise: sum(payouts.filter((p) => ["on_hold", "failed"].includes(p.status)), "amountPaise"),
      };
    }

    /* ---------- bookings ---------- */
    const count = (statuses) => allBookings.filter((b) => statuses.includes(b.status)).length;
    const bookingCounts = {
      requests: count(["pending", "accepted"]),
      upcoming: count(["confirmed", "in_progress"]),
      completed: count(["completed"]),
      disputed: count(["disputed"]),
      cancelled: count(["cancelled", "rejected", "expired"]),
      total: allBookings.length,
    };

    /* ---------- things to do ---------- */
    const todo = [];
    const approvedPhotos = photos.filter((p) => p.moderationStatus === "approved").length;
    const pendingPhotos = photos.filter((p) => p.moderationStatus === "pending").length;
    if (!me.mobileVerified) todo.push({ key: "mobile", text: "Verify your mobile number", to: "/verify-mobile" });
    if (!photos.length) todo.push({ key: "photo", text: "Add a profile photo — profiles with a photo get far more responses", to: "/profile" });
    else if (!approvedPhotos && pendingPhotos) todo.push({ key: "photo_wait", text: "Your photo is waiting for approval", to: "/profile", info: true });
    if (isCompanion) {
      if (!profile?.bio) todo.push({ key: "bio", text: "Write a short bio", to: "/profile" });
      if (me.kycStatus === "none" || me.kycStatus === "rejected") todo.push({ key: "kyc", text: me.kycStatus === "rejected" ? "Your ID check was rejected — submit it again" : "Complete your ID check", to: "/profile" });
      if (!account) todo.push({ key: "payout", text: "Add a UPI ID or bank account so you can be paid", to: "/profile" });
      if (profile?.approvalStatus === "draft") todo.push({ key: "submit", text: "Submit your profile for approval", to: "/profile" });
      if (profile?.approvalStatus === "pending") todo.push({ key: "review", text: "Your profile is being reviewed", to: "/profile", info: true });
    }
    for (const b of requests) {
      if (isCompanion && b.side === "companion" && b.status === "pending") todo.push({ key: `answer-${b.id}`, text: `Answer the booking request from ${b.customer?.name || "a customer"} (#${b.id})`, to: `/bookings/${b.id}` });
      if (b.side === "customer" && b.status === "accepted") todo.push({ key: `pay-${b.id}`, text: `Pay for booking #${b.id} with ${b.companion?.name} to confirm it`, to: `/bookings/${b.id}` });
    }
    const prefs = await require("../../models").Preference.findOne({ where: { userId: me.id }, attributes: ["whatsappReminders"] });
    if (me.mobileVerified && !prefs?.whatsappReminders && bookingCounts.upcoming) {
      todo.push({ key: "whatsapp", text: "Get your meet reminders on WhatsApp", to: "/settings", info: true });
    }
    if (!isCompanion && (me.kycStatus === "none" || me.kycStatus === "rejected")) {
      todo.push({ key: "idbadge", text: "Verify your ID to get the \"ID verified\" badge — Companions accept verified members faster", to: "/profile", info: true });
    }
    if (unreadMessages) todo.push({ key: "messages", text: `${unreadMessages} unread message${unreadMessages === 1 ? "" : "s"}`, to: "/messages" });

    res.json({
      me: {
        name: me.fullName,
        role: me.role,
        memberSince: me.createdAt,
        membershipStatus: me.membershipStatus,
        membershipExpiresAt: me.membershipExpiresAt,
        kycStatus: me.kycStatus,
        approvalStatus: profile?.approvalStatus || null,
        completedMeets: profile?.completedMeets || 0,
        rating: n(profile?.ratingAvg),
        ratingCount: profile?.ratingCount || 0,
        strikeCount: me.strikeCount || 0,
        walletPaise: n(me.walletPaise),
      },
      spending,
      earnings,
      payoutAccount: account ? { method: account.method, upiId: account.upiId, accountLast4: account.accountLast4 } : null,
      bookings: bookingCounts,
      nextMeets: upcoming.slice(0, 3),
      requests: requests.slice(0, 5),
      unread: { messages: unreadMessages, notifications: unreadNotifications },
      todo,
      transactions,
      peopleMet: (await peopleMet(me)).slice(0, 8),
    });
  })
);

module.exports = router;
