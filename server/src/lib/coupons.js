const { Op } = require("sequelize");
const { Coupon, CouponRedemption, Booking } = require("../models");
const { badRequest } = require("./errors");
const { formatINR } = require("./money");

const tidyCode = (code) => String(code || "").trim().toUpperCase().replace(/\s+/g, "");

/** The discount, in paise, a coupon gives on an amount. Never more than the amount. */
function discountFor(coupon, amountPaise) {
  const amount = Number(amountPaise);
  let off = coupon.kind === "percent" ? Math.floor((amount * Number(coupon.value)) / 100) : Number(coupon.value);
  if (coupon.maxDiscountPaise != null) off = Math.min(off, Number(coupon.maxDiscountPaise));
  return Math.max(0, Math.min(off, amount));
}

/**
 * Checks a code for this Customer and booking. Returns { coupon, discountPaise }
 * or throws a message the Customer can act on.
 */
async function check(code, user, booking) {
  const c = tidyCode(code);
  if (!c) throw badRequest("Enter a coupon code.");
  const coupon = await Coupon.findOne({ where: { code: c } });
  const now = new Date();
  if (!coupon || !coupon.isActive) throw badRequest("That coupon code is not valid.");
  if (coupon.startsAt && now < new Date(coupon.startsAt)) throw badRequest("That coupon is not active yet.");
  if (coupon.endsAt && now > new Date(coupon.endsAt)) throw badRequest("That coupon has expired.");
  if (Number(booking.amountPaise) < Number(coupon.minAmountPaise || 0)) {
    throw badRequest(`This coupon needs a booking of at least ${formatINR(coupon.minAmountPaise)}.`);
  }

  const used = { couponId: coupon.id, status: "used", bookingId: { [Op.ne]: booking.id } };
  if (coupon.usageLimit != null && (await CouponRedemption.count({ where: used })) >= coupon.usageLimit) {
    throw badRequest("This coupon has been fully used.");
  }
  if ((await CouponRedemption.count({ where: { ...used, userId: user.id } })) >= Number(coupon.perUserLimit || 1)) {
    throw badRequest("You have already used this coupon.");
  }
  if (coupon.firstBookingOnly) {
    const before = await Booking.count({
      where: { customerId: user.id, id: { [Op.ne]: booking.id }, paidAt: { [Op.ne]: null } },
    });
    if (before) throw badRequest("This coupon is for your first booking only.");
  }

  const discountPaise = discountFor(coupon, booking.amountPaise);
  if (!discountPaise) throw badRequest("This coupon gives no discount on this booking.");
  return { coupon, discountPaise };
}

function couponJson(c, { withStats = null } = {}) {
  return {
    id: c.id,
    code: c.code,
    description: c.description,
    kind: c.kind,
    value: Number(c.value),
    maxDiscountPaise: c.maxDiscountPaise == null ? null : Number(c.maxDiscountPaise),
    minAmountPaise: Number(c.minAmountPaise || 0),
    firstBookingOnly: c.firstBookingOnly,
    startsAt: c.startsAt,
    endsAt: c.endsAt,
    usageLimit: c.usageLimit,
    perUserLimit: c.perUserLimit,
    isActive: c.isActive,
    ...(withStats || {}),
  };
}

module.exports = { tidyCode, discountFor, check, couponJson };
