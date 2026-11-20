/**
 * Display helpers. Money arrives in paise; times are shown in IST.
 */
export function inr(paise, { decimals = false } = {}) {
  const rupees = Number(paise || 0) / 100;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: decimals ? 2 : 0,
    maximumFractionDigits: rupees % 1 === 0 && !decimals ? 0 : 2,
  }).format(rupees);
}

const TZ = { timeZone: "Asia/Kolkata" };
export const dateTime = (d) => (d ? new Date(d).toLocaleString("en-IN", { ...TZ, dateStyle: "medium", timeStyle: "short" }) : "—");
export const dateOnly = (d) => (d ? new Date(d).toLocaleDateString("en-IN", { ...TZ, dateStyle: "medium" }) : "—");
export const timeOnly = (d) => (d ? new Date(d).toLocaleTimeString("en-IN", { ...TZ, hour: "numeric", minute: "2-digit" }) : "—");
export const ago = (d) => {
  const s = Math.round((Date.now() - new Date(d)) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return dateOnly(d);
};

/** "2026-11-21" for a Date, in IST. */
export function isoDate(d = new Date()) {
  const p = new Intl.DateTimeFormat("en-CA", { ...TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  return p;
}

export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Booking status → label and badge tone. */
export const STATUS = {
  pending: { label: "Waiting for Companion", tone: "warn" },
  accepted: { label: "Accepted · awaiting payment", tone: "accent" },
  rejected: { label: "Declined", tone: "plain" },
  confirmed: { label: "Confirmed", tone: "good" },
  in_progress: { label: "Meet in progress", tone: "accent" },
  completed: { label: "Completed", tone: "good" },
  cancelled: { label: "Cancelled", tone: "plain" },
  disputed: { label: "Disputed", tone: "warn" },
  expired: { label: "Expired", tone: "plain" },
};

export const REPORT_REASONS = [
  ["solicitation", "Asked for sexual services"],
  ["harassment", "Harassment or threats"],
  ["fake_profile", "Fake profile or catfishing"],
  ["scam_or_money", "Scam, or asked to pay off-platform"],
  ["underage", "Appears to be under 18"],
  ["no_show", "Did not turn up"],
  ["offensive_photos", "Offensive photos"],
  ["other", "Something else"],
];
