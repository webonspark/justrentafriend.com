const crypto = require("crypto");
const { Op } = require("sequelize");
const {
  sequelize,
  User,
  Profile,
  Photo,
  Booking,
  Payment,
  Payout,
  PayoutAccount,
  Conversation,
  ServiceCategory,
  CompanionRate,
  Availability,
  Review,
  CouponRedemption,
  SosAlert,
  PublicPlace,
  Report,
} = require("../../models");
const wallet = require("../../lib/wallet");
const referrals = require("../../lib/referrals");
const settings = require("../../lib/settings");
const gateway = require("../../lib/payments");
const payouts = require("../../lib/payouts");
const { splitCommission, bookingAmount, formatINR } = require("../../lib/money");
const { istParts, fromIst, toMinutes, fromMinutes, weekdayOf } = require("../../lib/time");
const { badRequest, notFound, forbidden, conflict } = require("../../lib/errors");
const { notify } = require("../../lib/notify");
const { publicUrl } = require("../../lib/uploads");
const { logger } = require("../../lib/logger");
const env = require("../../config/env");
const paymentService = require("../payments/payment.service");
const { isBlocked, MEETING_PLACE_TYPES } = require("../profiles/profile.service");

/**
 * Bookings, from request to payout.
 *
 *   Customer requests  → pending
 *   Companion accepts  → accepted      (or rejects → rejected)
 *   Customer pays      → confirmed     money held in escrow, chat opens,
 *                                      the Customer gets a 4-digit start code
 *   Companion enters the code at the meet
 *                      → in_progress   proof the meet really happened
 *   Either side ends the meet, or the booked time runs out
 *                      → completed     money still held: 24-hour complaint window
 *   Window passes with no complaint    payout ready; the owner releases it
 *                                      (or it goes automatically if the
 *                                      payout_auto_release setting is on)
 *   Either side may cancel before the meet (refund by the time rules) or
 *   raise a problem until the window closes; a paid meet whose code was
 *   never entered is sent to the admin as a possible no-show. In both cases
 *   the money stays held until an admin decides: refund, pay, or split.
 *
 * Every rule here runs on the server. The browser only asks.
 */

const PAYMENT_WINDOW_HOURS = 12;   // accepted → must pay within this
const RESPONSE_WINDOW_HOURS = 24;  // pending → companion must answer within this
const COMPLAINT_WINDOW_HOURS = Booking.COMPLAINT_WINDOW_HOURS; // after the meet ends
const NO_SHOW_GRACE_MINUTES = 60;  // code never entered this long after the end → admin
const MAX_CODE_ATTEMPTS = 5;
const MIN_LEAD_MINUTES = 120;      // book at least two hours ahead
const MAX_DAYS_AHEAD = 60;
const MAX_HOURS = 8;

/* Words that mean a private place. Public places only. */
const PRIVATE_PLACE =
  /\b(?:(?:my|your|his|her|our|their|friend'?s)\s+(?:home|house|place|flat|apartment|room|pg|hostel)|at\s+home|hotel\s+room|guest\s*house|lodge|bedroom|airbnb|oyo|service\s+apartment|room\s+no\.?|flat\s+no\.?)\b/i;

const PARTY_INCLUDE = (as) => ({
  model: User,
  as,
  attributes: ["id", "fullName", "role", "mobile", "kycStatus"],
  include: [
    { model: Profile, as: "profile", attributes: ["area", "city", "isVerified", "ratingAvg", "ratingCount"] },
    { model: Photo, as: "photos", where: { moderationStatus: "approved", isPrimary: true }, required: false },
  ],
});

/* ------------------------------ shapes ------------------------------ */

function partyJson(u) {
  if (!u) return null;
  const photo = u.photos?.[0];
  return {
    id: u.id,
    name: u.fullName,
    area: u.profile?.area,
    verified: Boolean(u.profile?.isVerified),
    // Customers: their ID check is approved — what the Companion sees on a request.
    idVerified: u.kycStatus === "approved",
    rating: Number(u.profile?.ratingAvg || 0),
    ratingCount: u.profile?.ratingCount || 0,
    photo: photo ? publicUrl(photo.thumbPath || photo.path) : null,
  };
}

function bookingJson(b, viewerId) {
  const side = b.customerId === viewerId ? "customer" : "companion";
  const myReview = (b.reviews || []).find((r) => r.authorId === viewerId);
  const theirReview = (b.reviews || []).find((r) => r.authorId !== viewerId);
  return {
    id: b.id,
    side,
    status: b.status,
    customer: partyJson(b.customer),
    companion: partyJson(b.companion),
    service: b.service ? { id: b.service.id, name: b.service.name } : null,
    startAt: b.startAt,
    endAt: b.endAt,
    hours: Number(b.hours),
    meetingPlace: {
      name: b.meetingPlaceName,
      type: b.meetingPlaceType,
      address: b.meetingPlaceAddress,
      latitude: b.place ? Number(b.place.latitude) : null,
      longitude: b.place ? Number(b.place.longitude) : null,
    },
    note: b.note,
    pricePerHourPaise: Number(b.pricePerHourPaise),
    amountPaise: Number(b.amountPaise),
    commissionPct: Number(b.commissionPct),
    commissionPaise: Number(b.commissionPaise),
    payoutPaise: Number(b.payoutPaise),
    refundPaise: b.refundPaise === null ? null : Number(b.refundPaise),
    respondedAt: b.respondedAt,
    rejectReason: b.rejectReason,
    paidAt: b.paidAt,
    // The start code is the Customer's to show; the Companion must never see it.
    startCode: side === "customer" && ["confirmed"].includes(b.status) ? b.startCode : null,
    startedAt: b.startedAt,
    safetyCheck: b.startedAt
      ? {
          askedAt: b.safetyCheckSentAt,
          mySafeAt: side === "customer" ? b.customerSafeAt : b.companionSafeAt,
          waiting: Boolean(b.safetyCheckSentAt) && !(side === "customer" ? b.customerSafeAt : b.companionSafeAt),
        }
      : null,
    discountPaise: Number(b.discountPaise || 0),
    placeId: b.placeId || null,
    complaintWindowEndsAt: b.completedAt ? new Date(new Date(b.completedAt).getTime() + COMPLAINT_WINDOW_HOURS * 3600e3) : null,
    canDispute:
      b.status === "in_progress" ||
      (b.status === "confirmed" && Date.now() >= new Date(b.startAt).getTime()) ||
      (typeof b.inComplaintWindow === "function" && b.inComplaintWindow() && !b.payoutReleasedAt),
    customerCheckInAt: b.customerCheckInAt,
    companionCheckInAt: b.companionCheckInAt,
    customerCompletedAt: b.customerCompletedAt,
    companionCompletedAt: b.companionCompletedAt,
    completedAt: b.completedAt,
    cancelledAt: b.cancelledAt,
    cancelledBy: b.cancelledById ? (b.cancelledById === b.customerId ? "customer" : b.cancelledById === b.companionId ? "companion" : "admin") : null,
    cancelReason: b.cancelReason,
    disputeReason: b.disputeReason,
    disputeResolution: b.disputeResolution,
    payoutReleasedAt: b.payoutReleasedAt,
    conversationId: b.conversation?.id || null,
    canReview: b.status === "completed" && !myReview,
    myReview: myReview ? { rating: myReview.rating, comment: myReview.comment } : null,
    theirReview: theirReview ? { rating: theirReview.rating, comment: theirReview.comment } : null,
    createdAt: b.createdAt,
  };
}

async function loadFor(user, id) {
  const b = await Booking.findByPk(id, {
    include: [
      PARTY_INCLUDE("customer"),
      PARTY_INCLUDE("companion"),
      { model: ServiceCategory, as: "service" },
      { model: Conversation, as: "conversation" },
      { model: Review, as: "reviews" },
      { model: PublicPlace, as: "place" },
    ],
  });
  if (!b || (b.customerId !== user.id && b.companionId !== user.id)) throw notFound("That booking does not exist.");
  return b;
}

/* ------------------------------ calendar ------------------------------ */

/**
 * Free time on one date: the Companion's windows for that weekday, minus
 * live bookings, minus anything too soon to book. Returned as start times on
 * the half hour, each with the longest booking that fits from there.
 */
async function freeSlots(companionId, dateStr) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateStr))) throw badRequest("Pick a date.");
  const windows = await Availability.findAll({ where: { companionId, weekday: weekdayOf(dateStr) } });
  const dayStart = fromIst(dateStr, "00:00");
  const dayEnd = new Date(dayStart.getTime() + 864e5);
  const taken = await Booking.findAll({
    where: {
      companionId,
      status: { [Op.in]: Booking.LIVE },
      startAt: { [Op.lt]: dayEnd },
      endAt: { [Op.gt]: dayStart },
    },
  });
  const busy = taken.map((b) => [
    Math.max(0, Math.round((new Date(b.startAt) - dayStart) / 60000)),
    Math.min(1440, Math.round((new Date(b.endAt) - dayStart) / 60000)),
  ]);
  const earliest = Math.ceil((Date.now() + MIN_LEAD_MINUTES * 60000 - dayStart.getTime()) / 60000);

  const slots = [];
  for (const w of windows) {
    const wEnd = toMinutes(w.endTime);
    for (let m = toMinutes(w.startTime); m + 30 <= wEnd; m += 30) {
      if (m < earliest) continue;
      if (busy.some(([s, e]) => m >= s && m < e)) continue;
      // How far this start can run before a window end or the next booking.
      const nextBusy = busy.filter(([s]) => s > m).map(([s]) => s);
      const limit = Math.min(wEnd, ...nextBusy, m + MAX_HOURS * 60);
      const maxHours = Math.floor((limit - m) / 30) / 2;
      if (maxHours >= 0.5) slots.push({ time: fromMinutes(m), maxHours });
    }
  }
  return slots.sort((a, b) => a.time.localeCompare(b.time));
}

/* ------------------------------ request ------------------------------ */

async function create(customer, body) {
  if (customer.role !== "customer") throw forbidden("Only Customers can book a Companion.");

  const companion = await User.findByPk(body.companionId, {
    include: [
      { model: Profile, as: "profile" },
      { model: ServiceCategory, as: "services", through: { attributes: [] } },
      { model: CompanionRate, as: "rates", where: { isCurrent: true }, required: false },
    ],
  });
  const live =
    companion &&
    companion.role === "companion" &&
    companion.canTransact() &&
    companion.profile?.approvalStatus === "approved";
  if (!live) throw notFound("That Companion is not available.");
  if (await isBlocked(customer.id, companion.id)) throw notFound("That Companion is not available.");
  if (companion.profile.verifiedCustomersOnly && customer.kycStatus !== "approved") {
    throw forbidden("This Companion only accepts ID-verified Customers. Verify your ID from My profile, then book.");
  }

  const serviceId = Number(body.serviceId);
  if (!companion.services.some((s) => s.id === serviceId)) throw badRequest("Pick a service this Companion offers.");

  /* The place: one from the checked public-places list. Typing a place in
     is allowed only when the list is switched off, or the city has none. */
  let place = null;
  if (body.placeId) {
    place = await PublicPlace.findOne({ where: { id: Number(body.placeId), isActive: true } });
    if (!place) throw badRequest("That meeting place is not on the list any more. Pick another.");
  } else {
    const listOnly = String(await settings.get("public_places_only", true)) === "true";
    const city = companion.profile?.city;
    if (listOnly && (await PublicPlace.count({ where: { isActive: true, ...(city ? { city } : {}) } }))) {
      throw badRequest("Pick a meeting place from the list of public places.");
    }
  }
  const placeType = MEETING_PLACE_TYPES.find((t) => t.id === (place ? place.type : body.meetingPlaceType)) || (place ? { id: place.type } : null);
  if (!placeType) throw badRequest("Pick the kind of public place you will meet at.");
  const placeName = place ? place.name : String(body.meetingPlaceName || "").trim();
  if (placeName.length < 3) throw badRequest("Name the place you will meet.");
  const address = place ? [place.address, place.area].filter(Boolean).join(", ") : String(body.meetingPlaceAddress || "").trim();
  if (!place && PRIVATE_PLACE.test(`${placeName} ${address}`)) {
    throw badRequest("Meetings must be in a public place — not a home, hotel room or other private space.");
  }

  const hours = Number(body.hours);
  if (!Number.isFinite(hours) || hours < 1 || hours > MAX_HOURS || hours * 2 !== Math.round(hours * 2)) {
    throw badRequest(`Book between 1 and ${MAX_HOURS} hours, in half-hour steps.`);
  }

  const startAt = fromIst(String(body.date), String(body.startTime));
  if (Number.isNaN(startAt.getTime())) throw badRequest("Pick a date and time.");
  if (startAt.getTime() < Date.now() + MIN_LEAD_MINUTES * 60000) throw badRequest("Book at least two hours ahead.");
  if (startAt.getTime() > Date.now() + MAX_DAYS_AHEAD * 864e5) throw badRequest(`Book up to ${MAX_DAYS_AHEAD} days ahead.`);
  const endAt = new Date(startAt.getTime() + hours * 3600e3);

  // Inside one availability window on that weekday.
  const { weekday, minutes } = istParts(startAt);
  const endMinutes = minutes + hours * 60;
  const windows = await Availability.findAll({ where: { companionId: companion.id, weekday } });
  if (!windows.some((w) => minutes >= toMinutes(w.startTime) && endMinutes <= toMinutes(w.endTime))) {
    throw badRequest("That time is outside the Companion's availability.");
  }

  const rate = companion.rates?.[0];
  if (!rate) throw badRequest("This Companion has not set a rate yet.");
  const pct = Number(await settings.get("commission_pct", env.money.commissionPct));
  const split = splitCommission(bookingAmount(rate.pricePerHourPaise, hours), pct);

  const booking = await sequelize.transaction(async (t) => {
    // No overlap with the Companion's other live bookings, or the Customer's.
    const clash = await Booking.findOne({
      where: {
        status: { [Op.in]: Booking.LIVE },
        [Op.or]: [{ companionId: companion.id }, { customerId: customer.id }],
        startAt: { [Op.lt]: endAt },
        endAt: { [Op.gt]: startAt },
      },
      transaction: t,
    });
    if (clash) throw conflict("That time overlaps another booking.");

    return Booking.create(
      {
        customerId: customer.id,
        companionId: companion.id,
        serviceId,
        hours,
        startAt,
        endAt,
        meetingPlaceName: placeName,
        meetingPlaceType: placeType.id,
        meetingPlaceAddress: address || null,
        placeId: place?.id || null,
        note: body.note ? String(body.note).slice(0, 500) : null,
        pricePerHourPaise: rate.pricePerHourPaise,
        amountPaise: split.amountPaise,
        commissionPct: pct,
        commissionPaise: split.commissionPaise,
        payoutPaise: split.payoutPaise,
        status: "pending",
      },
      { transaction: t }
    );
  });

  await notify(companion.id, {
    type: "booking_request",
    title: `New booking request from ${customer.fullName.split(" ")[0]}`,
    body: `${hours} h on ${startAt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })} at ${placeName}. Accept or reject within ${RESPONSE_WINDOW_HOURS} hours.`,
    link: `/bookings/${booking.id}`,
    urgent: true,
  });
  return bookingJson(await loadFor(customer, booking.id), customer.id);
}

/* ------------------------------ companion answers ------------------------------ */

async function accept(companion, id) {
  const b = await loadFor(companion, id);
  if (b.companionId !== companion.id) throw forbidden("Only the Companion can accept.");
  if (b.status !== "pending") throw conflict("This booking is no longer waiting for an answer.");
  if (new Date(b.startAt) <= new Date()) throw conflict("This booking's time has passed.");
  await b.update({ status: "accepted", respondedAt: new Date() });
  await notify(b.customerId, {
    type: "booking_accepted",
    title: `${companion.fullName.split(" ")[0]} accepted your booking`,
    body: `Pay ${formatINR(b.amountPaise)} within ${PAYMENT_WINDOW_HOURS} hours to confirm it.`,
    link: `/bookings/${b.id}`,
    urgent: true,
  });
  return bookingJson(await loadFor(companion, id), companion.id);
}

async function reject(companion, id, reason) {
  const b = await loadFor(companion, id);
  if (b.companionId !== companion.id) throw forbidden("Only the Companion can reject.");
  if (b.status !== "pending") throw conflict("This booking is no longer waiting for an answer.");
  await b.update({ status: "rejected", respondedAt: new Date(), rejectReason: reason ? String(reason).slice(0, 300) : null });
  await notify(b.customerId, {
    type: "booking_rejected",
    title: `${companion.fullName.split(" ")[0]} could not take this booking`,
    body: reason ? String(reason).slice(0, 200) : "Try another time or another Companion. You were not charged.",
    link: `/bookings/${b.id}`,
  });
  return bookingJson(await loadFor(companion, id), companion.id);
}

/* ------------------------------ payment & escrow ------------------------------ */

async function payable(customer, id) {
  const b = await loadFor(customer, id);
  if (b.customerId !== customer.id) throw forbidden("Only the Customer pays.");
  if (b.status !== "accepted") throw conflict("This booking is not waiting for payment.");
  if (new Date(b.startAt) <= new Date()) throw conflict("This booking's time has passed.");
  return b;
}

const payOptions = (body = {}) => ({
  couponCode: body.couponCode ? String(body.couponCode).slice(0, 30) : null,
  useWallet: body.useWallet === true || body.useWallet === "true",
});

/** The price breakdown before paying: coupon and wallet applied. */
async function quote(customer, id, body) {
  return paymentService.quoteBooking(customer, await payable(customer, id), payOptions(body));
}

async function startPayment(customer, id, body) {
  const b = await payable(customer, id);
  const r = await paymentService.startBooking(customer, b, payOptions(body));
  if (r.paid) return { ...r, booking: bookingJson(await loadFor(customer, id), customer.id) };
  return r;
}

/** Called by the payment service once a booking payment is verified. */
paymentService.bookingHooks.onPaid = async (payment) => {
  const b = await Booking.findByPk(payment.bookingId);
  if (!b) return;
  // Wallet money was put back because checkout looked abandoned — take it again.
  if (payment.failureReason === "wallet_released" && Number(payment.walletPaise)) {
    try {
      await wallet.debit(payment.userId, Number(payment.walletPaise), { kind: "payment", bookingId: b.id, paymentId: payment.id, note: `Booking #${b.id}` });
      await payment.update({ failureReason: null });
    } catch {
      logger.warn(`Booking ${b.id}: wallet part no longer available after a late payment; refunding the card part.`);
      await payment.update({ walletPaise: 0 });
      await refundPayment(payment, paidValue(payment));
      await notify(b.customerId, { type: "booking_refunded", title: "Payment refunded", body: "Your wallet no longer had the amount set aside for this checkout, so the card payment was refunded. Please pay again.", link: `/bookings/${b.id}` });
      return;
    }
  }
  if (b.status !== "accepted") {
    // Paid too late (expired or cancelled meanwhile): refund in full.
    logger.warn(`Booking ${b.id} paid while ${b.status}; refunding.`);
    await refundPayment(payment, paidValue(payment));
    await notify(b.customerId, { type: "booking_refunded", title: "Payment refunded", body: "The booking was no longer open, so your payment has been refunded in full.", link: `/bookings/${b.id}` });
    return;
  }
  await sequelize.transaction(async (t) => {
    await b.update(
      { status: "confirmed", paidAt: new Date(), startCode: newStartCode(), startCodeAttempts: 0, couponId: payment.couponId || null, discountPaise: Number(payment.discountPaise || 0) },
      { transaction: t }
    );
    if (payment.couponId && Number(payment.discountPaise)) {
      await CouponRedemption.findOrCreate({
        where: { bookingId: b.id },
        defaults: { couponId: payment.couponId, userId: b.customerId, bookingId: b.id, discountPaise: Number(payment.discountPaise), status: "used" },
        transaction: t,
      });
    }
    const existing = await Conversation.findOne({ where: { bookingId: b.id }, transaction: t });
    if (!existing) {
      await Conversation.create({ bookingId: b.id, customerId: b.customerId, companionId: b.companionId }, { transaction: t });
    }
  });
  const when = new Date(b.startAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });
  await notify(b.customerId, { type: "booking_confirmed", title: "Booking confirmed", body: `Paid. See you on ${when} at ${b.meetingPlaceName}. Chat is open. Show your start code to your Companion when you meet.`, link: `/bookings/${b.id}`, urgent: true });
  await notify(b.companionId, { type: "booking_confirmed", title: "Booking confirmed and paid", body: `${when} at ${b.meetingPlaceName}. Ask the Customer for their 4-digit start code when you meet.`, link: `/bookings/${b.id}`, urgent: true });
};

/** A 4-digit code, 1000–9999, from a secure source. */
function newStartCode() {
  return String(crypto.randomInt(1000, 10000));
}

const paidValue = paymentService.paidValue;

/**
 * Gives money back on a booking payment. Returns what was refunded.
 *
 * Whatever came out of the wallet goes back to the wallet first. The rest
 * goes back to the card/UPI through the gateway — or, with toWallet, into
 * the wallet instead, which is instant.
 */
async function refundPayment(payment, amountPaise, { toWallet = false } = {}) {
  await payment.reload();
  const value = paidValue(payment);
  const refundedBefore = Number(payment.refundedPaise || 0);
  const amount = Math.min(Math.round(Number(amountPaise)), value - refundedBefore);
  if (amount <= 0) return 0;

  const walletOrigin = Number(payment.walletPaise || 0);
  const toWalletBefore = Number(payment.refundedToWalletPaise || 0);
  const walletPart = Math.min(amount, Math.max(walletOrigin - Math.min(toWalletBefore, walletOrigin), 0));
  const cashPart = amount - walletPart;
  const creditWallet = walletPart + (toWallet || payment.gateway === "wallet" ? cashPart : 0);
  const viaGateway = amount - creditWallet;

  if (viaGateway > 0) await gateway.refund({ paymentId: payment.gatewayPaymentId, amountPaise: viaGateway });
  if (creditWallet > 0) {
    await wallet.credit(payment.userId, creditWallet, { kind: "refund", bookingId: payment.bookingId, paymentId: payment.id, note: payment.bookingId ? `Refund · Booking #${payment.bookingId}` : "Refund" });
  }
  const refunded = refundedBefore + amount;
  await payment.update({
    refundedPaise: refunded,
    refundedToWalletPaise: toWalletBefore + creditWallet,
    status: refunded >= value ? "refunded" : "paid",
  });
  return amount;
}

/** What a cancellation refunds, by who cancels and how close to the start. */
async function refundRule(b, byCompanion) {
  if (byCompanion) return { pct: 100, why: "The Companion cancelled, so you get a full refund." };
  const freeHours = Number(await settings.get("cancellation_free_hours", 24));
  const partialPct = Number(await settings.get("cancellation_partial_pct", 50));
  const hoursLeft = (new Date(b.startAt) - Date.now()) / 3600e3;
  if (hoursLeft >= freeHours) return { pct: 100, why: `Cancelled more than ${freeHours} hours ahead: full refund.` };
  if (hoursLeft > 0) return { pct: partialPct, why: `Cancelled within ${freeHours} hours of the start: ${partialPct}% refund.` };
  return { pct: 0, why: "Cancelled after the start time: no refund." };
}

async function cancel(user, id, reason, { refundTo = "original" } = {}) {
  const b = await loadFor(user, id);
  if (!["pending", "accepted", "confirmed"].includes(b.status)) throw conflict("This booking can no longer be cancelled.");
  const byCompanion = user.id === b.companionId;
  const wasCommitted = ["accepted", "confirmed"].includes(b.status);
  let refund = 0;
  let why = "Nothing had been paid.";

  if (b.status === "confirmed") {
    const rule = await refundRule(b, byCompanion);
    why = rule.why;
    const payment = await Payment.findOne({ where: { bookingId: b.id, status: "paid" } });
    if (payment) {
      // GST on the fee follows the same percentage as the time.
      refund = await refundPayment(payment, Math.round((paidValue(payment) * rule.pct) / 100), { toWallet: refundTo === "wallet" });
    }
    // Whatever the Customer does not get back goes to the Companion, less commission.
    if (!byCompanion && rule.pct < 100) {
      const kept = Math.round((Number(b.amountPaise) * (100 - rule.pct)) / 100);
      const split = splitCommission(kept, Number(b.commissionPct));
      await Payout.create({ companionId: b.companionId, bookingId: b.id, amountPaise: split.payoutPaise, status: "pending", note: "Late cancellation share" });
    }
  }

  await b.update({
    status: "cancelled",
    cancelledAt: new Date(),
    cancelledById: user.id,
    cancelReason: reason ? String(reason).slice(0, 300) : null,
    refundPaise: refund,
  });
  await Conversation.update({ isClosed: true }, { where: { bookingId: b.id } });
  await releasePayout(b.id); // the late-cancellation share, if any
  // A coupon on a booking that fell through with a full refund can be used again.
  if (byCompanion || (b.status === "cancelled" && refund && refund >= Number(b.amountPaise) - Number(b.discountPaise || 0))) {
    await CouponRedemption.update({ status: "released" }, { where: { bookingId: b.id } });
  }

  const other = byCompanion ? b.customerId : b.companionId;
  await notify(other, {
    type: "booking_cancelled",
    title: `Booking #${b.id} was cancelled`,
    body: `${user.fullName.split(" ")[0]} cancelled.${refund ? ` Refund: ${formatINR(refund)}.` : ""}`,
    link: `/bookings/${b.id}`,
    urgent: true,
  });
  if (byCompanion && wasCommitted) await addStrike(user.id, b.id);
  const out = bookingJson(await loadFor(user, id), user.id);
  return { ...out, refundNote: why };
}

/**
 * A Companion who cancels after accepting gets a strike. At STRIKE_LIMIT
 * the account is suspended and signed out; an admin can review it and
 * reset the count from the member page.
 */
const STRIKE_LIMIT = 3;
async function addStrike(companionId, bookingId) {
  const u = await User.findByPk(companionId);
  if (!u) return;
  const strikes = (u.strikeCount || 0) + 1;
  if (strikes >= STRIKE_LIMIT && u.status === "active") {
    await u.update({ strikeCount: strikes, status: "suspended" });
    await require("../../lib/tokens").revokeAllForUser(u.id);
    await notify(u.id, { type: "account_suspended", title: "Your account is suspended", body: `You cancelled ${strikes} accepted bookings. Contact support to have your account reviewed.`, link: "/" });
    logger.warn(`Companion ${u.id} suspended after ${strikes} strikes (booking ${bookingId}).`);
  } else {
    await u.update({ strikeCount: strikes });
    await notify(u.id, {
      type: "strike",
      title: `Strike ${strikes} of ${STRIKE_LIMIT}`,
      body: `Cancelling an accepted booking counts as a strike. At ${STRIKE_LIMIT} strikes your account is suspended.`,
      link: `/bookings/${bookingId}`,
    });
  }
}

/* ------------------------------ the meet ------------------------------ */

/** Safety record only: either side can mark that they have arrived. */
async function checkIn(user, id) {
  const b = await loadFor(user, id);
  if (b.status !== "confirmed") throw conflict("Check-in opens once the booking is confirmed.");
  const now = Date.now();
  if (now < new Date(b.startAt).getTime() - 30 * 60000) throw conflict("Check-in opens 30 minutes before the start.");
  if (now > new Date(b.endAt).getTime() + 60 * 60000) throw conflict("This meet has ended.");
  const field = user.id === b.customerId ? "customerCheckInAt" : "companionCheckInAt";
  if (!b[field]) await b.update({ [field]: new Date() });
  const other = user.id === b.customerId ? b.companionId : b.customerId;
  await notify(other, { type: "check_in", title: `${user.fullName.split(" ")[0]} has checked in`, body: `At ${b.meetingPlaceName}.`, link: `/bookings/${b.id}` });
  return bookingJson(await loadFor(user, id), user.id);
}

/**
 * The Companion enters the Customer's 4-digit code at the meet. A right
 * code is the proof both people were there: confirmed → in_progress.
 * Five wrong tries lock the code; the admin can then decide.
 */
async function startMeet(companion, id, code) {
  const b = await loadFor(companion, id);
  if (b.companionId !== companion.id) throw forbidden("Only the Companion enters the start code.");
  if (b.status !== "confirmed") throw conflict("This meet cannot be started now.");
  const now = Date.now();
  if (now < new Date(b.startAt).getTime() - 30 * 60000) throw conflict("You can start the meet from 30 minutes before the booked time.");
  if (now > new Date(b.endAt).getTime()) throw conflict("The booked time is over. Raise a problem if the meet did not happen.");
  if (b.startCodeAttempts >= MAX_CODE_ATTEMPTS) throw conflict("Too many wrong codes. Raise a problem and our team will help.");

  const given = String(code || "").replace(/\D/g, "");
  const ok = b.startCode && given.length === 4 &&
    crypto.timingSafeEqual(Buffer.from(given), Buffer.from(String(b.startCode)));
  if (!ok) {
    await b.update({ startCodeAttempts: b.startCodeAttempts + 1 });
    const left = MAX_CODE_ATTEMPTS - b.startCodeAttempts;
    throw badRequest(left > 0 ? `That code is not right. ${left} ${left === 1 ? "try" : "tries"} left.` : "That code is not right, and no tries are left.");
  }

  const nowDate = new Date();
  await b.update({ status: "in_progress", startedAt: nowDate, companionCheckInAt: b.companionCheckInAt || nowDate, customerCheckInAt: b.customerCheckInAt || nowDate });
  await notify(b.customerId, { type: "meet_started", title: "Your meet has started", body: `Enjoy your time. The SOS button is on the booking page if you need it.`, link: `/bookings/${b.id}` });
  return bookingJson(await loadFor(companion, id), companion.id);
}

/**
 * Ends the meet: in_progress → completed. Either side can tap it; the
 * clock does it automatically when the booked time runs out. The money
 * stays held for the complaint window.
 */
async function complete(user, id) {
  const b = await loadFor(user, id);
  if (b.status !== "in_progress") throw conflict("Only a meet in progress can be ended. The Companion starts it with your start code.");
  const field = user.id === b.customerId ? "customerCompletedAt" : "companionCompletedAt";
  await b.update({ [field]: b[field] || new Date() });
  await finish(b, `ended by the ${user.id === b.customerId ? "customer" : "companion"}`);
  return bookingJson(await loadFor(user, id), user.id);
}

/**
 * Marks the meet completed and records the Companion's payout as held.
 * Nothing is paid here: the payout is released after the complaint window
 * (see sweep), or straight away when an admin settles a dispute.
 */
async function finish(b, why) {
  const firstTime = !b.completedAt;
  await sequelize.transaction(async (t) => {
    await b.update({ status: "completed", completedAt: b.completedAt || new Date() }, { transaction: t });
    if (firstTime) await Profile.increment("completedMeets", { by: 1, where: { userId: b.companionId }, transaction: t });
    const exists = await Payout.findOne({ where: { bookingId: b.id }, transaction: t });
    if (!exists) {
      await Payout.create(
        { companionId: b.companionId, bookingId: b.id, amountPaise: b.payoutPaise, status: "pending", note: `Held for the ${COMPLAINT_WINDOW_HOURS}-hour complaint window` },
        { transaction: t }
      );
    }
  });
  logger.info(`Booking ${b.id} completed (${why}).`);
  if (firstTime) {
    for (const uid of [b.customerId, b.companionId]) {
      await notify(uid, {
        type: "booking_completed",
        title: "Meet completed — leave a review",
        body: `How did it go? If something was wrong, tell us within ${COMPLAINT_WINDOW_HOURS} hours.`,
        link: `/bookings/${b.id}`,
      });
    }
  }
}

/**
 * Sends a booking's payout. Held if the Companion has no payout account or
 * their KYC is not approved yet — released later from the admin payouts
 * screen or when they add an account.
 */
const PAYOUT_CHANGE_HOLD_HOURS = 24;
const PAYOUT_CHANGE_NOTE = "Payout account changed recently — held for 24 hours";

async function releasePayout(bookingId) {
  const payout = await Payout.findOne({ where: { bookingId } });
  if (!payout || payout.status === "paid") return payout;
  if (Number(payout.amountPaise) <= 0) return payout;
  const companion = await User.findByPk(payout.companionId);
  const account = await PayoutAccount.findOne({ where: { companionId: payout.companionId } });
  if (!account || companion.kycStatus !== "approved") {
    await payout.update({ status: "on_hold", note: !account ? "No payout account yet" : "KYC not approved yet" });
    return payout;
  }
  if (account.changedAt && Date.now() - new Date(account.changedAt).getTime() < PAYOUT_CHANGE_HOLD_HOURS * 3600e3) {
    await payout.update({ status: "on_hold", note: PAYOUT_CHANGE_NOTE });
    return payout;
  }
  try {
    const { reference } = await payouts.transfer({ account, amountPaise: payout.amountPaise, reference: `booking-${bookingId}` });
    await payout.update({ status: "paid", bankReference: reference, paidAt: new Date(), note: null });
    await Booking.update({ payoutReleasedAt: new Date() }, { where: { id: bookingId } });
    await notify(payout.companionId, { type: "payout_sent", title: `Payout of ${formatINR(payout.amountPaise)} sent`, body: `For booking #${bookingId}. Reference ${reference}.`, link: "/earnings" });
  } catch (err) {
    logger.error(`Payout for booking ${bookingId} failed: ${err.message}`);
    await payout.update({ status: "failed", note: err.message.slice(0, 300) });
  }
  return payout;
}

/**
 * Raises a problem. Allowed once the meet time has come (a no-show), during
 * the meet, and until the complaint window after it closes. The money stays
 * held until an admin decides.
 */
async function dispute(user, id, reason) {
  const b = await loadFor(user, id);
  const open =
    b.status === "in_progress" ||
    (b.status === "confirmed" && Date.now() >= new Date(b.startAt).getTime()) ||
    (b.inComplaintWindow() && !b.payoutReleasedAt);
  if (!open) {
    if (b.status === "confirmed") throw conflict("The meet has not started yet — cancel the booking instead.");
    throw conflict(`Problems can be raised until ${COMPLAINT_WINDOW_HOURS} hours after the meet ends.`);
  }
  if (!reason || String(reason).trim().length < 10) throw badRequest("Tell us what went wrong (at least a sentence).");
  await b.update({ status: "disputed", disputeReason: String(reason).slice(0, 500), disputedById: user.id });
  await Payout.update({ status: "on_hold", note: "Disputed" }, { where: { bookingId: b.id, status: { [Op.ne]: "paid" } } });
  const other = user.id === b.customerId ? b.companionId : b.customerId;
  await notify(other, { type: "booking_disputed", title: `A problem was raised on booking #${b.id}`, body: "Our team will review it and contact you. The payment is on hold meanwhile.", link: `/bookings/${b.id}` });
  return bookingJson(await loadFor(user, id), user.id);
}

/* ------------------------------ lists ------------------------------ */

async function list(user, { tab = "upcoming" } = {}) {
  const mine = { [Op.or]: [{ customerId: user.id }, { companionId: user.id }] };
  const tabs = {
    requests: { status: { [Op.in]: ["pending", "accepted"] } },
    upcoming: { status: { [Op.in]: ["confirmed", "in_progress"] } },
    past: { status: { [Op.in]: ["completed", "cancelled", "rejected", "expired", "disputed"] } },
  };
  const rows = await Booking.findAll({
    where: { ...mine, ...(tabs[tab] || {}) },
    include: [
      PARTY_INCLUDE("customer"),
      PARTY_INCLUDE("companion"),
      { model: ServiceCategory, as: "service" },
      { model: Conversation, as: "conversation" },
      { model: Review, as: "reviews" },
    ],
    order: [["startAt", tab === "past" ? "DESC" : "ASC"]],
    limit: 100,
  });
  return rows.map((b) => bookingJson(b, user.id));
}

async function get(user, id) {
  const b = await loadFor(user, id);
  // Bookings paid before start codes existed get one the first time the Customer looks.
  if (b.status === "confirmed" && !b.startCode && b.customerId === user.id) {
    await b.update({ startCode: newStartCode(), startCodeAttempts: 0 });
  }
  return bookingJson(b, user.id);
}

/* ------------------------------ reviews ------------------------------ */

async function review(user, id, { rating, comment }) {
  const b = await loadFor(user, id);
  if (b.status !== "completed") throw conflict("You can review once the booking is completed.");
  const r = Number(rating);
  if (!Number.isInteger(r) || r < 1 || r > 5) throw badRequest("Give a rating from 1 to 5 stars.");
  if (b.reviews.some((x) => x.authorId === user.id)) throw conflict("You have already reviewed this booking.");
  const subjectId = user.id === b.customerId ? b.companionId : b.customerId;

  await sequelize.transaction(async (t) => {
    await Review.create({ bookingId: b.id, authorId: user.id, subjectId, rating: r, comment: comment ? String(comment).slice(0, 1000) : null }, { transaction: t });
    const stats = await Review.findAll({
      where: { subjectId, isHidden: false },
      attributes: [[sequelize.fn("AVG", sequelize.col("rating")), "avg"], [sequelize.fn("COUNT", sequelize.col("id")), "count"]],
      raw: true,
      transaction: t,
    });
    await Profile.update(
      { ratingAvg: Number(stats[0].avg || 0).toFixed(2), ratingCount: Number(stats[0].count || 0) },
      { where: { userId: subjectId }, transaction: t }
    );
  });
  await notify(subjectId, { type: "review_received", title: `You received a ${r}-star review`, link: `/bookings/${b.id}` });
  await checkLowRating(subjectId);
  return bookingJson(await loadFor(user, id), user.id);
}

/**
 * Ratings go both ways. When someone's average drops below the bar (after
 * enough reviews to be fair), staff are asked to review them: a Companion
 * is taken out of search meanwhile; a Customer is warned. Staff clear it
 * from the member page.
 */
async function checkLowRating(userId) {
  const threshold = Number(await settings.get("low_rating_threshold", 3));
  const minReviews = Number(await settings.get("low_rating_min_reviews", 5));
  const profile = await Profile.findOne({ where: { userId } });
  const user = await User.findByPk(userId);
  if (!profile || !user || profile.ratingReviewAt) return false;
  if (Number(profile.ratingCount) < minReviews || Number(profile.ratingAvg) >= threshold) return false;

  await profile.update({ ratingReviewAt: new Date(), ...(user.role === "companion" && profile.approvalStatus === "approved" ? { approvalStatus: "pending", approvalNote: `Rating ${Number(profile.ratingAvg).toFixed(1)}★ from ${profile.ratingCount} reviews — under review` } : {}) });
  if (user.role === "customer" && user.status === "active") await user.update({ status: "warned" });
  await Report.create({
    reporterId: userId,
    reportedId: userId,
    reason: "other",
    details: `Automatic: average rating ${Number(profile.ratingAvg).toFixed(2)} from ${profile.ratingCount} reviews is below ${threshold}.`,
    status: "open",
  }).catch((e) => logger.error(`Low-rating report for ${userId} failed: ${e.message}`));
  await notify(userId, {
    type: "rating_review",
    title: "Your account is being reviewed",
    body: user.role === "companion"
      ? "Your recent ratings are low, so your profile is hidden from search while our team takes a look. We will be in touch."
      : "Your recent ratings from Companions are low. Our team will take a look — please keep every meet friendly and on time.",
    link: "/profile",
  });
  logger.warn(`User ${userId} sent for rating review (${profile.ratingAvg} from ${profile.ratingCount}).`);
  return true;
}

/* ------------------------------ reminders ------------------------------ */

const REMINDER_DAY_HOURS = 24;
const REMINDER_HOUR_MINUTES = 60;

/** "Wed, 26 Nov, 6:30 pm" in India time. */
const meetTime = (d) =>
  new Date(d).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

/** "today at 6:30 pm" / "tomorrow at 6:30 pm" relative to now, in India time. */
function whenText(startAt, now = new Date()) {
  const day = (d) => new Date(d).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const time = new Date(startAt).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit" });
  const tomorrow = new Date(now.getTime() + 24 * 3600e3);
  if (day(startAt) === day(now)) return `today at ${time}`;
  if (day(startAt) === day(tomorrow)) return `tomorrow at ${time}`;
  return `on ${meetTime(startAt)}`;
}

/**
 * Two reminders per confirmed meet, to both people:
 *   ~24 hours before   "your meet is tomorrow at …"
 *   ~1 hour before     "your meet starts in about an hour" + start code hint
 * In-app and email always (email unless switched off), SMS for the 1-hour
 * one, WhatsApp for both when the member opted in.
 *
 * The sweep runs every 5 minutes, so the 1-hour reminder lands 55–60 min
 * ahead. A meet booked less than 2 hours out skips the day-ahead one, and a
 * booking paid in the last 30 minutes is not reminded straight away — the
 * payment confirmation has only just told them.
 */
async function sendReminders(now = new Date()) {
  const recentPay = new Date(now.getTime() - 30 * 60000);

  const dayAhead = await Booking.findAll({
    where: {
      status: "confirmed",
      dayReminderSentAt: null,
      reminderSentAt: null,
      startAt: { [Op.between]: [new Date(now.getTime() + 2 * 3600e3), new Date(now.getTime() + REMINDER_DAY_HOURS * 3600e3)] },
      [Op.or]: [{ paidAt: null }, { paidAt: { [Op.lt]: recentPay } }],
    },
    include: [PARTY_INCLUDE("customer"), PARTY_INCLUDE("companion")],
  });
  for (const b of dayAhead) {
    await b.update({ dayReminderSentAt: now });
    await remind(b, "day", now);
  }

  const hourAhead = await Booking.findAll({
    where: { status: "confirmed", reminderSentAt: null, startAt: { [Op.between]: [now, new Date(now.getTime() + REMINDER_HOUR_MINUTES * 60000)] } },
    include: [PARTY_INCLUDE("customer"), PARTY_INCLUDE("companion")],
  });
  for (const b of hourAhead) {
    await b.update({ reminderSentAt: now, dayReminderSentAt: b.dayReminderSentAt || now });
    await remind(b, "hour", now);
  }
  return dayAhead.length + hourAhead.length;
}

async function remind(b, kind, now) {
  const when = kind === "day" ? whenText(b.startAt, now) : `in about an hour (${meetTime(b.startAt)})`;
  const link = `/bookings/${b.id}`;
  const url = `${env.clientUrl}${link}`;
  const people = [
    {
      id: b.customerId,
      other: b.companion?.fullName || "your Companion",
      tip: "Your start code is on the booking page — show it to your Companion when you meet.",
    },
    {
      id: b.companionId,
      other: b.customer?.fullName || "your Customer",
      tip: "Ask the Customer for their start code and enter it to begin the meet.",
    },
  ];
  for (const p of people) {
    await notify(p.id, {
      type: "booking_reminder",
      title: kind === "day" ? `Reminder: your meet with ${p.other} is ${when}` : `Your meet with ${p.other} starts in about an hour`,
      body: `At ${b.meetingPlaceName}${b.meetingPlaceAddress ? `, ${b.meetingPlaceAddress}` : ""} · ${meetTime(b.startAt)}. ${p.tip}`,
      link,
      urgent: kind === "hour",
      // Template meet_reminder: {{1}} name · {{2}} who · {{3}} when · {{4}} place · {{5}} link
      whatsapp: { template: "reminder", params: (user) => [user.fullName.split(" ")[0], p.other, when, b.meetingPlaceName, url] },
    });
  }
}

/* ------------------------------ safety check-in ------------------------------ */

const SAFETY_CHECK_MIN_MINUTES = 30;

/** When the "Are you OK?" goes out: halfway, but at least 30 minutes in. */
function safetyCheckDue(b) {
  if (!b.startedAt) return null;
  const started = new Date(b.startedAt).getTime();
  const half = (new Date(b.endAt).getTime() - started) / 2;
  return new Date(started + Math.max(half, SAFETY_CHECK_MIN_MINUTES * 60000));
}

/**
 * Halfway through a meet both people are asked "Are you OK?". Tapping
 * I'm safe is all it takes. Anyone who has not answered within the grace
 * time raises an alert in the admin safety queue (not to their emergency
 * contact — a missed tap is usually a phone in a pocket).
 */
async function safetyChecks(now = new Date()) {
  let asked = 0;
  let escalated = 0;
  const live = await Booking.findAll({ where: { status: "in_progress", safetyCheckSentAt: null } });
  for (const b of live) {
    const due = safetyCheckDue(b);
    if (!due || now < due || now >= new Date(b.endAt)) continue;
    await b.update({ safetyCheckSentAt: now });
    asked += 1;
    for (const uid of [b.customerId, b.companionId]) {
      await notify(uid, {
        type: "safety_check",
        title: "Are you OK? Tap I'm safe",
        body: "A quick check halfway through your meet. If anything is wrong, press SOS on the booking page.",
        link: `/bookings/${b.id}`,
        urgent: true,
      });
    }
  }

  const grace = Number(await settings.get("safety_check_grace_minutes", 15));
  const waiting = await Booking.findAll({
    where: {
      safetyCheckSentAt: { [Op.lt]: new Date(now - grace * 60000) },
      safetyEscalatedAt: null,
      [Op.or]: [{ customerSafeAt: null }, { companionSafeAt: null }],
      status: { [Op.in]: ["in_progress", "completed", "disputed"] },
    },
  });
  for (const b of waiting) {
    await b.update({ safetyEscalatedAt: now });
    const missing = [!b.customerSafeAt && b.customerId, !b.companionSafeAt && b.companionId].filter(Boolean);
    for (const uid of missing) {
      await SosAlert.create({ userId: uid, bookingId: b.id, kind: "missed_check_in", shareToken: crypto.randomBytes(24).toString("hex") });
      escalated += 1;
      logger.warn(`Safety: user ${uid} did not answer the check-in on booking ${b.id}.`);
      await notify(uid, { type: "safety_check", title: "We did not hear back — are you OK?", body: "Our safety team has been told and may call you. Tap I'm safe on the booking page if all is well.", link: `/bookings/${b.id}`, urgent: true });
    }
  }
  return { safetyAsked: asked, safetyEscalated: escalated };
}

/** "I'm safe": the answer to the check-in, any time during the meet. */
async function markSafe(user, id) {
  const b = await loadFor(user, id);
  if (!["in_progress", "completed", "disputed"].includes(b.status) || !b.startedAt) throw conflict("This is for during a meet.");
  const field = user.id === b.customerId ? "customerSafeAt" : "companionSafeAt";
  if (!b[field]) await b.update({ [field]: new Date() });
  // Answering after the alert closes it.
  await SosAlert.update(
    { status: "resolved", resolvedAt: new Date(), resolvedNote: "Member tapped I'm safe" },
    { where: { bookingId: b.id, userId: user.id, kind: "missed_check_in", status: "active" } }
  );
  return bookingJson(await loadFor(user, id), user.id);
}

/* ------------------------------ clock ------------------------------ */

/** Run every few minutes: expiries, reminders, meet ends, no-shows, payouts. */
async function sweep() {
  const now = new Date();

  const stalePending = await Booking.findAll({
    where: { status: "pending", [Op.or]: [{ createdAt: { [Op.lt]: new Date(now - RESPONSE_WINDOW_HOURS * 3600e3) } }, { startAt: { [Op.lt]: now } }] },
  });
  for (const b of stalePending) {
    await b.update({ status: "expired" });
    await notify(b.customerId, { type: "booking_expired", title: `Booking #${b.id} expired`, body: "The Companion did not answer in time. You were not charged.", link: `/bookings/${b.id}` });
  }

  const unpaid = await Booking.findAll({
    where: { status: "accepted", [Op.or]: [{ respondedAt: { [Op.lt]: new Date(now - PAYMENT_WINDOW_HOURS * 3600e3) } }, { startAt: { [Op.lt]: now } }] },
  });
  for (const b of unpaid) {
    await b.update({ status: "expired" });
    await notify(b.companionId, { type: "booking_expired", title: `Booking #${b.id} expired`, body: "The Customer did not pay in time.", link: `/bookings/${b.id}` });
  }

  const reminded = await sendReminders(now);

  // Meets in progress end by themselves when the booked time runs out.
  const overrun = await Booking.findAll({ where: { status: "in_progress", endAt: { [Op.lt]: now } } });
  for (const b of overrun) await finish(b, "booked time ended");

  // Paid, but the start code was never entered: possible no-show. The money
  // stays held and an admin decides who gets it.
  const noShows = await Booking.findAll({
    where: { status: "confirmed", startedAt: null, endAt: { [Op.lt]: new Date(now - NO_SHOW_GRACE_MINUTES * 60000) } },
  });
  for (const b of noShows) {
    await b.update({ status: "disputed", disputeReason: "The start code was never entered — possible no-show. Held for review." });
    for (const uid of [b.customerId, b.companionId]) {
      await notify(uid, { type: "booking_disputed", title: `Booking #${b.id} is under review`, body: "The meet was never started with the start code, so our team will check what happened. The payment is on hold meanwhile.", link: `/bookings/${b.id}` });
    }
  }

  // Complaint window over with no dispute: the payout is ready.
  const autoRelease = String(await settings.get("payout_auto_release", false)) === "true";
  const ripe = await Payout.findAll({
    where: { status: "pending" },
    include: [{ model: Booking, as: "booking", where: { status: "completed", completedAt: { [Op.lt]: new Date(now - COMPLAINT_WINDOW_HOURS * 3600e3) } } }],
  });
  for (const p of ripe) {
    await Conversation.update({ isClosed: true }, { where: { bookingId: p.bookingId } });
    // The meet cleared its complaint window: a referral reward may be due.
    for (const uid of [p.booking.customerId, p.booking.companionId]) {
      await referrals.rewardIfDue(uid).catch((e) => logger.error(`Referral reward for ${uid} failed: ${e.message}`));
    }
    if (autoRelease) {
      await releasePayout(p.bookingId);
    } else {
      await p.update({ status: "approved", note: "Complaint window passed — ready to release" });
      await notify(p.companionId, { type: "payout_ready", title: `Payout of ${formatINR(p.amountPaise)} approved`, body: `For booking #${p.bookingId}. It will be sent to your bank or UPI shortly.`, link: "/earnings" });
    }
  }

  // Payouts held because the bank/UPI was just changed go out once 24 h pass.
  const cooling = await Payout.findAll({ where: { status: "on_hold", note: PAYOUT_CHANGE_NOTE } });
  for (const p of cooling) await releasePayout(p.bookingId);

  // Checkouts left unfinished for an hour give their wallet money back.
  const abandoned = await Payment.findAll({
    where: { purpose: "booking", status: "created", walletPaise: { [Op.gt]: 0 }, createdAt: { [Op.lt]: new Date(now - 60 * 60000) } },
  });
  for (const p of abandoned) await paymentService.releaseHeldWallet(p, "Checkout not completed within an hour");

  const safety = await safetyChecks(now);

  return { expired: stalePending.length + unpaid.length, reminded, ended: overrun.length, noShows: noShows.length, payoutsReady: ripe.length, walletReleased: abandoned.length, ...safety };
}

module.exports = {
  freeSlots,
  create,
  accept,
  reject,
  startPayment,
  cancel,
  checkIn,
  startMeet,
  complete,
  finish,
  releasePayout,
  refundPayment,
  dispute,
  list,
  get,
  review,
  sweep,
  sendReminders,
  whenText,
  safetyChecks,
  markSafe,
  checkLowRating,
  quote,
  bookingJson,
  PARTY_INCLUDE,
  partyJson,
};
