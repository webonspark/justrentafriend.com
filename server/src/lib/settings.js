const { Setting } = require("../models");
const env = require("../config/env");

/**
 * Admin-editable settings, read through a short cache.
 *
 * Commission, cancellation windows and GST flags live in the settings table
 * so an admin can change them without a deploy. A 30-second cache keeps a
 * busy booking page from reading the table on every request; saving a
 * setting clears it at once.
 */

let cache = null;
let loadedAt = 0;
const TTL_MS = 30 * 1000;

async function all() {
  if (cache && Date.now() - loadedAt < TTL_MS) return cache;
  const rows = await Setting.findAll();
  cache = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  loadedAt = Date.now();
  return cache;
}

async function get(key, fallback) {
  const values = await all();
  return values[key] === undefined ? fallback : values[key];
}

function clear() {
  cache = null;
}

/** Every setting the app knows, with its starting value: [key, value, label, group]. */
function defaults() {
  return [
    ["commission_pct", env.money.commissionPct, "Commission on every booking (%) — e.g. 20 means the Companion gets 80%", "money"],
    ["gst_pct", env.money.gstPct, "GST on membership (%)", "money"],
    ["gst_on_commission", false, "Charge GST on the commission too", "money"],
    ["payout_auto_release", false, "Pay Companions automatically when the 24-hour complaint window ends (off: an admin releases each payout)", "money"],
    ["min_price_per_hour_paise", env.money.minPricePerHour, "Lowest price a Companion may set", "money"],
    ["max_price_per_hour_paise", env.money.maxPricePerHour, "Highest price a Companion may set", "money"],
    ["cancellation_free_hours", 24, "Free cancellation up to this many hours before", "bookings"],
    ["cancellation_partial_pct", 50, "Refund when cancelling inside that window (%)", "bookings"],
    ["launch_city", env.brand.city, "The city this is open in", "general"],
    ["company_legal_name", `${env.brand.name} Technologies Pvt Ltd`, "Legal name on invoices", "company"],
    ["company_gstin", "29AAAAA0000A1Z5", "GSTIN on invoices (replace before launch)", "company"],
    ["company_address", `${env.brand.city}, Karnataka, India`, "Registered address on invoices", "company"],
    ["grievance_officer_name", "Grievance Officer", "Grievance Officer's name (IT Rules 2021)", "company"],
    ["grievance_officer_email", env.brand.grievanceEmail, "Grievance Officer's email", "company"],
    ["maintenance_mode", false, "Show the maintenance page to everyone", "general"],
    ["referral_reward_paise", 10000, "Refer a friend: wallet credit each person gets, in paise (10000 = ₹100)", "growth"],
    ["referral_max_rewards", 50, "Refer a friend: most rewards one member can earn", "growth"],
    ["safety_check_grace_minutes", 15, "Safety check-in: minutes to tap \"I'm safe\" before staff are alerted", "safety"],
    ["low_rating_threshold", 3, "Ratings: average below this sends the member for review", "safety"],
    ["low_rating_min_reviews", 5, "Ratings: only judge the average after this many reviews", "safety"],
    ["public_places_only", true, "Bookings must use a place from the checked public-places list", "safety"],
  ];
}

/** Adds any setting that is missing. Never changes a value already saved. */
async function ensureDefaults() {
  const added = [];
  for (const [key, value, label, group] of defaults()) {
    const [, made] = await Setting.findOrCreate({ where: { key }, defaults: { key, value, label, group } });
    if (made) added.push(key);
  }
  clear();
  return added;
}

module.exports = { all, get, clear, defaults, ensureDefaults };
