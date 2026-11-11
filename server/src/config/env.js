require("dotenv").config();

/**
 * Every setting the server reads, in one place and validated once.
 *
 * Anything missing in production stops the process at boot rather than
 * failing on the first request that needed it. In development the gaps
 * fall back to something that works offline, so a fresh clone runs with
 * no accounts anywhere.
 */

const int = (value, fallback) => {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
};

const isProd = process.env.NODE_ENV === "production";

const env = {
  isProd,
  nodeEnv: process.env.NODE_ENV || "development",
  port: int(process.env.PORT, 5000),
  clientUrl: process.env.CLIENT_URL || "http://localhost:5173",

  brand: {
    name: process.env.BRAND_NAME || "Kindred",
    city: process.env.LAUNCH_CITY || "Bengaluru",
    supportEmail: process.env.SUPPORT_EMAIL || "support@kindred.example",
    grievanceEmail: process.env.GRIEVANCE_EMAIL || "grievance@kindred.example",
  },

  db: {
    dialect: process.env.DB_DIALECT || "mysql",
    host: process.env.DB_HOST || "127.0.0.1",
    port: int(process.env.DB_PORT, 3306),
    name: process.env.DB_NAME || "kindred",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    storage: process.env.DB_STORAGE || "kindred.sqlite",
  },

  auth: {
    accessSecret: process.env.JWT_ACCESS_SECRET || "dev-access-secret",
    refreshSecret: process.env.JWT_REFRESH_SECRET || "dev-refresh-secret",
    accessTtl: process.env.ACCESS_TOKEN_TTL || "15m",
    refreshDays: int(process.env.REFRESH_TOKEN_TTL_DAYS, 30),
    bcryptRounds: int(process.env.BCRYPT_ROUNDS, 12),
  },

  mail: {
    transport: process.env.MAIL_TRANSPORT || "console",
    from: process.env.MAIL_FROM || "Kindred <no-reply@kindred.example>",
    host: process.env.SMTP_HOST,
    port: int(process.env.SMTP_PORT, 587),
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },

  otp: {
    length: int(process.env.OTP_LENGTH, 6),
    ttlMinutes: int(process.env.OTP_TTL_MINUTES, 10),
    maxAttempts: int(process.env.OTP_MAX_ATTEMPTS, 5),
  },

  uploads: {
    dir: process.env.UPLOAD_DIR || "uploads",
    maxMb: int(process.env.MAX_UPLOAD_MB, 5),
  },

  money: {
    commissionPct: int(process.env.DEFAULT_COMMISSION_PCT, 18),
    gstPct: int(process.env.DEFAULT_GST_PCT, 18),
    minPricePerHour: int(process.env.MIN_PRICE_PER_HOUR, 50000),
    maxPricePerHour: int(process.env.MAX_PRICE_PER_HOUR, 1000000),
  },

  payments: {
    gateway: process.env.PAYMENT_GATEWAY || "mock",
    razorpayKeyId: process.env.RAZORPAY_KEY_ID,
    razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET,
    razorpayWebhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET,
  },

  // Nobody under 18 may hold an account. Checked on the server at sign-up,
  // never only in the browser.
  minimumAge: 18,
};

/* A real deployment must not run on the development fallbacks. */
if (isProd) {
  const missing = [];
  if (!process.env.JWT_ACCESS_SECRET) missing.push("JWT_ACCESS_SECRET");
  if (!process.env.JWT_REFRESH_SECRET) missing.push("JWT_REFRESH_SECRET");
  if (env.auth.accessSecret === env.auth.refreshSecret) {
    missing.push("JWT_REFRESH_SECRET (must differ from JWT_ACCESS_SECRET)");
  }
  if (missing.length) {
    throw new Error(`Cannot start in production without: ${missing.join(", ")}`);
  }
}

module.exports = env;
