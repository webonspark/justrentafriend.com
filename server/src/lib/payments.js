const crypto = require("crypto");
const env = require("../config/env");
const { logger } = require("./logger");
const { AppError } = require("./errors");

/**
 * The payment gateway, behind one small interface.
 *
 *   createOrder({ amountPaise, receipt, notes }) → { orderId, gateway, keyId }
 *   verify({ orderId, paymentId, signature })     → true / false
 *   refund({ paymentId, amountPaise })            → { refundId }
 *
 * PAYMENT_GATEWAY=mock (the default) runs the whole flow locally with no
 * account: the browser shows a test checkout and the server accepts it.
 * PAYMENT_GATEWAY=razorpay uses Razorpay Checkout (UPI, cards, netbanking)
 * with the keys in .env — nothing else in the app changes. PayU or Cashfree
 * would slot in here the same way.
 *
 * Escrow: the money is captured into the platform's account at payment and
 * only paid out to the Companion after the meet (see payouts.js).
 */

const gateway = () => env.payments.gateway;

async function razorpay(pathname, body, method = "POST") {
  const auth = Buffer.from(`${env.payments.razorpayKeyId}:${env.payments.razorpayKeySecret}`).toString("base64");
  const res = await fetch(`https://api.razorpay.com/v1${pathname}`, {
    method,
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
    body: method === "GET" ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    logger.error(`Razorpay ${pathname} failed: ${JSON.stringify(data)}`);
    throw new AppError("The payment gateway refused the request. Try again.", 502, "gateway_error");
  }
  return data;
}

async function createOrder({ amountPaise, receipt, notes = {} }) {
  if (gateway() === "razorpay") {
    const order = await razorpay("/orders", { amount: Number(amountPaise), currency: "INR", receipt, notes });
    return { orderId: order.id, gateway: "razorpay", keyId: env.payments.razorpayKeyId };
  }
  return { orderId: `mock_order_${crypto.randomBytes(8).toString("hex")}`, gateway: "mock", keyId: null };
}

function verify({ orderId, paymentId, signature }) {
  if (!orderId || !paymentId) return false;
  if (gateway() === "razorpay") {
    const expected = crypto
      .createHmac("sha256", env.payments.razorpayKeySecret)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");
    const a = Buffer.from(expected);
    const b = Buffer.from(String(signature || ""));
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }
  // The mock gateway: any test payment id against a mock order is "paid".
  return orderId.startsWith("mock_order_") && paymentId.startsWith("mock_pay_");
}

/**
 * Makes sure the money is actually taken. Razorpay can leave a payment
 * "authorized" (depending on the account's capture setting); an authorized
 * payment is not settled and cannot be refunded, so capture it here.
 */
async function ensureCaptured({ paymentId, amountPaise }) {
  if (gateway() !== "razorpay") return;
  const p = await razorpay(`/payments/${paymentId}`, null, "GET");
  if (Number(p.amount) !== Number(amountPaise)) {
    throw new AppError("The amount paid does not match this order.", 400, "amount_mismatch");
  }
  if (p.status === "authorized") {
    await razorpay(`/payments/${paymentId}/capture`, { amount: Number(amountPaise), currency: "INR" });
  } else if (p.status !== "captured") {
    throw new AppError(`The payment is ${p.status}, not completed.`, 400, "payment_not_captured");
  }
}

async function refund({ paymentId, amountPaise }) {
  if (Number(amountPaise) <= 0) return { refundId: null };
  if (gateway() === "razorpay") {
    const r = await razorpay(`/payments/${paymentId}/refund`, { amount: Number(amountPaise) });
    return { refundId: r.id };
  }
  logger.info(`[mock gateway] refund of ${amountPaise} paise on ${paymentId}`);
  return { refundId: `mock_refund_${crypto.randomBytes(6).toString("hex")}` };
}

module.exports = { gateway, createOrder, verify, ensureCaptured, refund };
