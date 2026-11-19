/**
 * Time, in India.
 *
 * Everything is stored in UTC. Availability windows and the calendar are
 * written in IST, which has no daylight saving, so a fixed +05:30 offset is
 * exact all year round.
 */

const IST_OFFSET_MIN = 330;

/** The IST wall-clock parts of a UTC instant. */
function istParts(date) {
  const shifted = new Date(new Date(date).getTime() + IST_OFFSET_MIN * 60000);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    weekday: shifted.getUTCDay(),
    minutes: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
  };
}

/** "2026-11-20" + "18:30" in IST → a UTC Date. */
function fromIst(dateStr, timeStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = timeStr.split(":").map(Number);
  return new Date(Date.UTC(y, m - 1, d, hh, mm) - IST_OFFSET_MIN * 60000);
}

/** "18:30" → 1110 */
const toMinutes = (hhmm) => {
  const [h, m] = String(hhmm).split(":").map(Number);
  return h * 60 + m;
};

/** 1110 → "18:30" */
const fromMinutes = (n) =>
  `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;

const isHhMm = (s) => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(s)) || s === "24:00";

/** Weekday (0 = Sunday) of an IST date string. */
function weekdayOf(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

module.exports = { IST_OFFSET_MIN, istParts, fromIst, toMinutes, fromMinutes, isHhMm, weekdayOf };
