/**
 * Money, in paise.
 *
 * Every amount in this codebase is an integer number of paise. ₹2,000 is
 * 200000. Nothing is ever a float: 0.1 + 0.2 is not 0.3, and a marketplace
 * that splits every payment three ways cannot afford that drift.
 *
 * Rupees appear only at the edges — what someone types in, and what they
 * are shown.
 */

const PAISE_PER_RUPEE = 100;

const toPaise = (rupees) => Math.round(Number(rupees) * PAISE_PER_RUPEE);
const toRupees = (paise) => Number(paise) / PAISE_PER_RUPEE;

/** "₹2,000" — Indian digit grouping, no decimals unless there are paise. */
function formatINR(paise) {
  const rupees = toRupees(paise);
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: rupees % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(rupees);
}

/**
 * Splits what the User pays into the company's commission and the
 * Customer's payout.
 *
 * The commission comes out of the Customer's price — it is not added on
 * top. The User pays exactly the price shown. At 18% on ₹2,000 the company
 * keeps ₹360 and the Customer receives ₹1,640.
 *
 * The commission is rounded down and the payout takes the remainder, so the
 * two always add back to the exact total with no stray paise.
 */
function splitCommission(amountPaise, commissionPct) {
  const amount = BigInt(Math.round(Number(amountPaise)));
  if (amount < 0n) throw new Error("An amount cannot be negative.");

  const pct = Number(commissionPct);
  if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
    throw new Error("The commission must be a percentage between 0 and 100.");
  }

  // Basis points keep the arithmetic in integers: 18% is 1800 bp.
  const basisPoints = BigInt(Math.round(pct * 100));
  const commission = (amount * basisPoints) / 10000n;
  const payout = amount - commission;

  return {
    amountPaise: Number(amount),
    commissionPct: pct,
    commissionPaise: Number(commission),
    payoutPaise: Number(payout),
  };
}

/** Amount = hours × price per hour. Half hours are allowed; smaller is not. */
function bookingAmount(pricePerHourPaise, hours) {
  const h = Number(hours);
  if (!Number.isFinite(h) || h < 0.5) throw new Error("Book at least half an hour.");
  if (Math.round(h * 2) !== h * 2) throw new Error("Book in half-hour steps.");
  return Math.round(Number(pricePerHourPaise) * h);
}

/** GST added on top of a net amount, rounded to the nearest paisa. */
function addGst(netPaise, gstPct) {
  const net = Math.round(Number(netPaise));
  const gst = Math.round((net * Number(gstPct)) / 100);
  return { netPaise: net, gstPaise: gst, totalPaise: net + gst };
}

module.exports = {
  PAISE_PER_RUPEE,
  toPaise,
  toRupees,
  formatINR,
  splitCommission,
  bookingAmount,
  addGst,
};
