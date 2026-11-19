/**
 * What a chat message is allowed to carry.
 *
 * 1. Contact details are masked — phone numbers, emails, UPI IDs and social
 *    handles — so deals cannot be taken off the platform (where neither
 *    side is protected).
 * 2. Messages that break the platonic-only policy are flagged for the
 *    moderation queue. They are delivered masked, and the original is kept
 *    for a moderator.
 */

const PATTERNS = [
  // Phone numbers: 10 digits, optionally +91 / 0, allowing spaces, dots, dashes.
  /(?:\+?91[\s.-]*)?(?:0)?[6-9](?:[\s.-]*\d){9}/g,
  // Emails.
  /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,
  // UPI IDs (name@bank).
  /\b[\w.-]{2,}@(?:ok\w+|ybl|ibl|axl|upi|paytm|apl|icici|sbi|hdfcbank)\b/gi,
  // Social handles and links people use to move off-platform.
  /\b(?:wa\.me|whatsapp|telegram|t\.me|instagram|insta|snapchat|snap)\b[^\s]*/gi,
  /(?:^|\s)@[a-z0-9_.]{3,}/gi,
  // Digits spelt out to dodge the filter: "nine eight four five ...".
  /\b(?:(?:zero|one|two|three|four|five|six|seven|eight|nine)[\s,.-]*){6,}/gi,
];

/* Platonic-only policy. Kept short and specific: the goal is a moderator
   reviewing the message, not a vocabulary test for ordinary chat. */
const BANNED = [
  "sex", "sexual", "nude", "nudes", "escort", "hookup", "hook up", "one night",
  "night stay", "overnight", "body massage", "happy ending", "intimate",
  "kiss", "sleep with", "room service", "hotel room", "naked", "bed",
];
const BANNED_RE = new RegExp(`\\b(?:${BANNED.map((w) => w.replace(/ /g, "\\s+")).join("|")})\\b`, "i");

function filterMessage(text) {
  let filtered = String(text);
  let masked = false;
  for (const re of PATTERNS) {
    filtered = filtered.replace(re, (m) => {
      masked = true;
      const lead = m.match(/^\s*/)[0];
      return `${lead}[hidden]`;
    });
  }
  const policy = BANNED_RE.test(text);
  return {
    filtered,
    masked,
    flagged: policy,
    flagReason: policy ? "platonic_policy" : masked ? "contact_details" : null,
  };
}

module.exports = { filterMessage };
