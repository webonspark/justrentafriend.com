const crypto = require("crypto");
const { logger } = require("./logger");

/**
 * Identity checks: Aadhaar / PAN, and a selfie matched against the profile
 * photo.
 *
 * KYC_PROVIDER=mock (default) accepts well-formed numbers and scores a
 * selfie match deterministically, so the whole flow — including the admin
 * review queue — can be exercised with no account. For production, plug in
 * DigiLocker (Aadhaar/PAN pull) or IDfy / Signzy (document + liveness + face
 * match) here; the rest of the app only sees these two functions.
 *
 * The full document number is never stored: only the last four digits.
 */
const provider = () => process.env.KYC_PROVIDER || "mock";

const FORMATS = {
  aadhaar: /^\d{12}$/,
  pan: /^[A-Z]{5}\d{4}[A-Z]$/,
};

async function verifyDocument({ docType, number }) {
  const clean = String(number || "").replace(/\s+/g, "").toUpperCase();
  if (!FORMATS[docType] || !FORMATS[docType].test(clean)) {
    return { ok: false, reason: docType === "pan" ? "That is not a valid PAN." : "An Aadhaar number has 12 digits." };
  }
  if (provider() !== "mock") throw new Error(`KYC provider "${provider()}" is not configured yet.`);
  logger.info(`[mock kyc] ${docType} ••••${clean.slice(-4)} checked`);
  return { ok: true, masked: `••••${clean.slice(-4)}`, reference: `mock_kyc_${crypto.randomBytes(6).toString("hex")}` };
}

/** Liveness + face match between a selfie and the primary photo. 0–100. */
async function matchSelfie({ selfiePath, photoPath }) {
  if (provider() !== "mock") throw new Error(`KYC provider "${provider()}" is not configured yet.`);
  if (!photoPath) return { live: true, score: 0 };
  const h = crypto.createHash("sha1").update(`${selfiePath}|${photoPath}`).digest();
  const score = 80 + (h[0] % 20); // 80–99 in the mock
  logger.info(`[mock kyc] selfie match score ${score}`);
  return { live: true, score };
}

module.exports = { provider, verifyDocument, matchSelfie };
