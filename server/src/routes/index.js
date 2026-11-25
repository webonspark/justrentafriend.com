const express = require("express");
const env = require("../config/env");

/**
 * Every route in the API hangs off here.
 *
 * One folder per domain under modules/, each mounted here.
 */

const router = express.Router();

router.get("/health", (req, res) =>
  res.json({
    status: "ok",
    brand: env.brand.name,
    city: env.brand.city,
    time: new Date().toISOString(),
  })
);

/** What the client needs before anyone signs in. */
router.get("/config", async (req, res, next) => {
  try {
    // Money and cancellation rules come from the admin settings, so the
    // public pages always state what the server actually enforces.
    const set = await require("../lib/settings").all();
    res.json({
      brand: env.brand,
      minimumAge: env.minimumAge,
      commissionPct: Number(set.commission_pct ?? env.money.commissionPct),
      gstPct: Number(set.gst_pct ?? env.money.gstPct),
      gstOnCommission: Boolean(set.gst_on_commission),
      cancellation: {
        freeHours: Number(set.cancellation_free_hours ?? 24),
        partialPct: Number(set.cancellation_partial_pct ?? 50),
      },
      paymentGateway: env.payments.gateway,
      razorpayKeyId: env.payments.gateway === "razorpay" ? env.payments.razorpayKeyId : null,
      googleClientId: process.env.GOOGLE_CLIENT_ID || null,
      priceRange: {
        minPaise: Number(set.min_price_per_hour_paise ?? env.money.minPricePerHour),
        maxPaise: Number(set.max_price_per_hour_paise ?? env.money.maxPricePerHour),
      },
    });
  } catch (err) {
    next(err);
  }
});

router.use("/auth", require("../modules/auth/auth.routes"));
router.use("/profiles", require("../modules/profiles/profile.routes"));
router.use("/discover", require("../modules/discover/discover.routes"));
router.use("/payments", require("../modules/payments/payment.routes"));
router.use("/bookings", require("../modules/bookings/booking.routes"));
router.use("/earnings", require("../modules/earnings/earnings.routes"));
router.use("/chat", require("../modules/chat/chat.routes"));
router.use("/safety", require("../modules/safety/safety.routes"));
router.use("/notifications", require("../modules/notifications/notification.routes"));
router.use("/account", require("../modules/account/account.routes"));
router.use("/dashboard", require("../modules/dashboard/dashboard.routes"));
router.use("/", require("../modules/growth/growth.routes"));
router.use("/admin/auth", require("../modules/admin/admin.auth"));
router.use("/admin", require("../modules/admin/admin.routes"));

module.exports = router;
