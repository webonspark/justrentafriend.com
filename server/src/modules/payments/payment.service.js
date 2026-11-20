const crypto = require("crypto");
const { Op } = require("sequelize");
const { sequelize, Payment, Plan, Subscription, User, Booking } = require("../../models");
const gateway = require("../../lib/payments");
const settings = require("../../lib/settings");
const env = require("../../config/env");
const { addGst } = require("../../lib/money");
const { badRequest, notFound, forbidden, conflict } = require("../../lib/errors");
const { notify } = require("../../lib/notify");

/**
 * Money coming in: memberships and bookings.
 *
 * Every payment follows the same three steps:
 *   1. start   → a Payment row ("created") and a gateway order
 *   2. verify  → the gateway's signature is checked on the server
 *   3. apply   → membership switched on, or booking confirmed (escrow)
 *
 * `apply` is idempotent: a payment already "paid" is never applied twice,
 * so the browser callback and the gateway webhook can both arrive safely.
 */

const invoiceNo = (payment) =>
  `INV-${new Date(payment.paidAt || Date.now()).getFullYear()}-${String(payment.id).padStart(6, "0")}`;

/** Called by the booking service when a Customer pays for a booking. */
const bookingHooks = { onPaid: null };

async function startMembership(user, planId) {
  const plan = await Plan.findOne({ where: { id: planId, isActive: true } });
  if (!plan) throw notFound("That plan is not available.");
  if (plan.forRole && plan.forRole !== user.role) throw forbidden("That plan is not for your account type.");

  const { netPaise, gstPaise, totalPaise } = addGst(plan.pricePaise, plan.gstPct);
  const order = await gateway.createOrder({ amountPaise: totalPaise, receipt: `mem-${user.id}-${Date.now()}` });

  const result = await sequelize.transaction(async (t) => {
    const now = new Date();
    const sub = await Subscription.create(
      {
        userId: user.id,
        planId: plan.id,
        startsAt: now,
        endsAt: new Date(now.getTime() + plan.days * 864e5),
        status: "pending",
        amountPaise: netPaise,
        gstPaise,
        totalPaise,
      },
      { transaction: t }
    );
    const payment = await Payment.create(
      {
        userId: user.id,
        purpose: "membership",
        subscriptionId: sub.id,
        gateway: order.gateway,
        gatewayOrderId: order.orderId,
        amountPaise: netPaise,
        gstPaise,
        totalPaise,
        status: "created",
      },
      { transaction: t }
    );
    await sub.update({ paymentId: payment.id }, { transaction: t });
    return payment;
  });

  return checkoutJson(result, order, user, `${plan.name} membership`);
}

/** Starts payment for an accepted booking. */
async function startBooking(user, booking) {
  const gstOnCommission = Boolean(await settings.get("gst_on_commission", false));
  const gstPct = Number(await settings.get("gst_pct", env.money.gstPct));
  const gstPaise = gstOnCommission ? Math.round((Number(booking.commissionPaise) * gstPct) / 100) : 0;
  const totalPaise = Number(booking.amountPaise) + gstPaise;

  // Re-use an unpaid order for the same booking rather than stacking them.
  const open = await Payment.findOne({ where: { bookingId: booking.id, status: "created" } });
  if (open && Number(open.totalPaise) === totalPaise) {
    return checkoutJson(open, { orderId: open.gatewayOrderId, gateway: open.gateway, keyId: env.payments.razorpayKeyId }, user, `Booking #${booking.id}`);
  }

  const order = await gateway.createOrder({ amountPaise: totalPaise, receipt: `bk-${booking.id}` });
  const payment = await Payment.create({
    userId: user.id,
    purpose: "booking",
    bookingId: booking.id,
    gateway: order.gateway,
    gatewayOrderId: order.orderId,
    amountPaise: booking.amountPaise,
    gstPaise,
    totalPaise,
    status: "created",
  });
  return checkoutJson(payment, order, user, `Booking #${booking.id}`);
}

function checkoutJson(payment, order, user, description) {
  return {
    paymentId: payment.id,
    orderId: order.orderId,
    gateway: order.gateway,
    keyId: order.keyId,
    amountPaise: Number(payment.totalPaise),
    currency: "INR",
    description,
    prefill: { name: user.fullName, email: user.email, contact: user.mobile },
  };
}

/** Checks the gateway's word for it, then applies the payment. */
async function verifyAndApply(user, { paymentId, gatewayPaymentId, signature }) {
  const payment = await Payment.findByPk(paymentId);
  if (!payment || payment.userId !== user.id) throw notFound("That payment does not exist.");
  if (payment.status === "paid") return summary(payment);

  const ok = gateway.verify({ orderId: payment.gatewayOrderId, paymentId: gatewayPaymentId, signature });
  if (!ok) {
    await payment.update({ status: "failed", failureReason: "Signature did not verify" });
    throw badRequest("The payment could not be verified. If money left your account it will be refunded automatically.");
  }
  await gateway.ensureCaptured({ paymentId: gatewayPaymentId, amountPaise: payment.totalPaise });
  await apply(payment, { gatewayPaymentId, signature });
  return summary(await payment.reload());
}

/** Marks a payment paid and switches on what it paid for. Idempotent. */
async function apply(payment, { gatewayPaymentId, signature }) {
  await sequelize.transaction(async (t) => {
    const locked = await Payment.findByPk(payment.id, { transaction: t, lock: t.LOCK?.UPDATE });
    if (locked.status === "paid") return;
    const clash = await Payment.findOne({ where: { gatewayPaymentId, id: { [Op.ne]: locked.id } }, transaction: t });
    if (clash) throw conflict("That payment was already used.");

    const paidAt = new Date();
    await locked.update(
      { status: "paid", gatewayPaymentId, gatewaySignature: signature || null, paidAt, invoiceNo: invoiceNo({ id: locked.id, paidAt }) },
      { transaction: t }
    );

    if (locked.purpose === "membership") {
      const sub = await Subscription.findByPk(locked.subscriptionId, { transaction: t });
      const user = await User.findByPk(locked.userId, { transaction: t });
      // Renewing early extends from the current expiry, not from today.
      const base = user.isMemberActive() ? new Date(user.membershipExpiresAt) : paidAt;
      const plan = await Plan.findByPk(sub.planId, { transaction: t });
      const endsAt = new Date(base.getTime() + plan.days * 864e5);
      await sub.update({ status: "active", startsAt: base, endsAt, invoiceNo: locked.invoiceNo }, { transaction: t });
      await user.update({ membershipStatus: "active", membershipExpiresAt: endsAt }, { transaction: t });
    }
  });

  const fresh = await Payment.findByPk(payment.id);
  if (fresh.purpose === "membership") {
    await notify(fresh.userId, {
      type: "membership_active",
      title: "Your membership is active",
      body: `Payment received. Invoice ${fresh.invoiceNo}.`,
      link: "/payments-history",
    });
  } else if (fresh.purpose === "booking" && bookingHooks.onPaid) {
    await bookingHooks.onPaid(fresh);
  }
}

/** Razorpay webhook: payment.captured → apply. Signature-checked. */
async function webhook(rawBody, signatureHeader) {
  if (gateway.gateway() !== "razorpay") return { ignored: true };
  if (!env.payments.razorpayWebhookSecret) throw forbidden("Webhooks are not set up (RAZORPAY_WEBHOOK_SECRET is empty).");
  const expected = Buffer.from(crypto.createHmac("sha256", env.payments.razorpayWebhookSecret).update(rawBody).digest("hex"));
  const given = Buffer.from(String(signatureHeader || ""));
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) throw forbidden("Bad webhook signature.");
  const event = JSON.parse(rawBody.toString("utf8"));
  if (event.event !== "payment.captured") return { ignored: true };
  const entity = event.payload.payment.entity;
  const payment = await Payment.findOne({ where: { gatewayOrderId: entity.order_id } });
  if (!payment) return { ignored: true };
  await apply(payment, { gatewayPaymentId: entity.id, signature: null });
  return { applied: true };
}

function summary(p) {
  return {
    id: p.id,
    purpose: p.purpose,
    bookingId: p.bookingId,
    status: p.status,
    amountPaise: Number(p.amountPaise),
    gstPaise: Number(p.gstPaise),
    totalPaise: Number(p.totalPaise),
    refundedPaise: p.refundedPaise === null ? null : Number(p.refundedPaise),
    invoiceNo: p.invoiceNo,
    paidAt: p.paidAt,
    createdAt: p.createdAt,
  };
}

async function listMine(user) {
  const rows = await Payment.findAll({
    where: { userId: user.id, status: { [Op.in]: ["paid", "refunded"] } },
    order: [["createdAt", "DESC"]],
  });
  return rows.map(summary);
}

/** A GST tax invoice, as printable HTML. */
async function invoiceHtml(user, paymentId, { asAdmin = false } = {}) {
  const p = await Payment.findByPk(paymentId, {
    include: [
      { model: User, as: "payer" },
      { model: Booking, as: "booking", include: [{ model: User, as: "companion", attributes: ["fullName"] }] },
      { model: Subscription, as: "subscription", include: [{ model: Plan, as: "plan" }] },
    ],
  });
  if (!p || (!asAdmin && p.userId !== user.id)) throw notFound("That invoice does not exist.");
  if (!p.invoiceNo) throw badRequest("This payment has not completed, so there is no invoice yet.");

  const s = await settings.all();
  const inr = (paise) => `₹${(Number(paise) / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
  const gstPct = Number(s.gst_pct ?? env.money.gstPct);
  const esc = (v) => String(v ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

  let lines;
  if (p.purpose === "membership") {
    lines = [
      [`${esc(p.subscription?.plan?.name)} membership (${p.subscription?.plan?.days} days) · SAC 998599`, inr(p.amountPaise)],
      [`IGST/CGST+SGST @ ${gstPct}%`, inr(p.gstPaise)],
    ];
  } else {
    const b = p.booking;
    lines = [
      [`Companion time with ${esc(b?.companion?.fullName)} — ${b?.hours} h (collected on behalf of the Companion)`, inr(Number(b?.payoutPaise))],
      [`Platform service fee (${Number(b?.commissionPct)}%) · SAC 998599`, inr(Number(b?.commissionPaise))],
      [`GST @ ${gstPct}% on platform fee`, inr(p.gstPaise)],
    ];
  }

  return `<!doctype html><html><head><meta charset="utf-8"><title>${p.invoiceNo}</title>
<style>body{font-family:system-ui,sans-serif;max-width:720px;margin:40px auto;padding:0 16px;color:#111}
h1{font-size:22px;margin:0}table{width:100%;border-collapse:collapse;margin-top:24px}
td,th{padding:10px;border-bottom:1px solid #ddd;text-align:left}td:last-child,th:last-child{text-align:right}
.muted{color:#666;font-size:13px}.total td{font-weight:700;border-top:2px solid #111}
@media print{button{display:none}}</style></head><body>
<button onclick="print()" style="float:right">Print / save as PDF</button>
<h1>Tax invoice</h1>
<p class="muted">${esc(s.company_legal_name || env.brand.name)}<br>${esc(s.company_address || env.brand.city)}<br>GSTIN: ${esc(s.company_gstin || "—")}</p>
<p><strong>Invoice</strong> ${p.invoiceNo}<br><strong>Date</strong> ${new Date(p.paidAt).toLocaleDateString("en-IN")}<br>
<strong>Billed to</strong> ${esc(p.payer?.fullName)} · ${esc(p.payer?.email)}</p>
<table><tr><th>Description</th><th>Amount</th></tr>
${lines.map(([d, a]) => `<tr><td>${d}</td><td>${a}</td></tr>`).join("")}
<tr class="total"><td>Total paid</td><td>${inr(p.totalPaise)}</td></tr>
${p.refundedPaise ? `<tr><td>Refunded</td><td>− ${inr(p.refundedPaise)}</td></tr>` : ""}
</table>
<p class="muted">Payment reference ${esc(p.gatewayPaymentId)} via ${esc(p.gateway)}. This is a computer-generated invoice.</p>
</body></html>`;
}

async function plans(user) {
  const rows = await Plan.findAll({
    where: { isActive: true, ...(user ? { [Op.or]: [{ forRole: null }, { forRole: user.role }] } : {}) },
    order: [["sortOrder", "ASC"]],
  });
  return rows.map((p) => {
    const g = addGst(p.pricePaise, p.gstPct);
    return { id: p.id, name: p.name, slug: p.slug, days: p.days, pricePaise: Number(p.pricePaise), gstPaise: g.gstPaise, totalPaise: g.totalPaise, blurb: p.blurb };
  });
}

module.exports = {
  bookingHooks,
  startMembership,
  startBooking,
  verifyAndApply,
  apply,
  webhook,
  listMine,
  invoiceHtml,
  plans,
  summary,
};
