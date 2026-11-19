/**
 * The brand, in one place.
 *
 * Change these two lines and the whole site follows — the navbar, the page
 * titles, the emails are set by the matching values in the server's .env.
 */
export const BRAND = import.meta.env.VITE_BRAND_NAME || "Just Rent a Friend";
export const CITY = import.meta.env.VITE_LAUNCH_CITY || "Bengaluru";

/** Nobody under this age may hold an account. Enforced on the server too. */
export const MINIMUM_AGE = 18;

/** Cities the launch covers. One for now, by design. */
export const CITIES = [CITY];

export const LEGAL = {
  terms: "/terms",
  privacy: "/privacy",
  refunds: "/refunds",
  guidelines: "/community-guidelines",
  childSafety: "/child-safety",
  deletion: "/account-deletion",
  grievance: "/grievance-officer",
  safety: "/safety",
};
