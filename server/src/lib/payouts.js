const crypto = require("crypto");
const { logger } = require("./logger");

/**
 * Money out to Companions.
 *
 * PAYOUT_PROVIDER=mock (default) records a reference and logs the transfer.
 * In production this calls Razorpay Route (transfer to a linked account) or
 * Cashfree Payouts (UPI / IMPS); the interface stays the same:
 *
 *   transfer({ account, amountPaise, reference }) → { reference }
 */
const provider = () => process.env.PAYOUT_PROVIDER || "mock";

async function transfer({ account, amountPaise, reference }) {
  if (provider() !== "mock") {
    throw new Error(`Payout provider "${provider()}" is not configured yet.`);
  }
  const to = account.method === "upi" ? account.upiId : `A/C ••••${account.accountLast4} (${account.ifsc})`;
  const ref = `mock_payout_${crypto.randomBytes(6).toString("hex")}`;
  logger.info(`[mock payouts] ${amountPaise} paise → ${to} (${reference}) ref ${ref}`);
  return { reference: ref };
}

module.exports = { provider, transfer };
