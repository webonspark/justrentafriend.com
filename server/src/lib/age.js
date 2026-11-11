const env = require("../config/env");

/**
 * The 18+ gate.
 *
 * Checked on the server at sign-up. A date of birth typed in the browser is
 * only a claim, so nothing here trusts the age the client sends — it is
 * always worked out again from the date.
 */

/** Whole years between a date of birth and today. */
function ageOn(dateOfBirth, on = new Date()) {
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return null;

  let years = on.getFullYear() - dob.getFullYear();
  const months = on.getMonth() - dob.getMonth();
  if (months < 0 || (months === 0 && on.getDate() < dob.getDate())) years -= 1;
  return years;
}

function isOldEnough(dateOfBirth) {
  const age = ageOn(dateOfBirth);
  return age !== null && age >= env.minimumAge;
}

/** A sanity check as well as an age check — 1890 is a typo, not a birthday. */
function checkDateOfBirth(dateOfBirth) {
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return "Enter your date of birth as YYYY-MM-DD.";
  if (dob.getTime() > Date.now()) return "That date is in the future.";

  const age = ageOn(dob);
  if (age > 120) return "Check your date of birth.";
  if (age < env.minimumAge) return `You must be ${env.minimumAge} or over to use this.`;
  return null;
}

module.exports = { ageOn, isOldEnough, checkDateOfBirth, MINIMUM_AGE: env.minimumAge };
