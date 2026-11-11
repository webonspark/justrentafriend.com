const express = require("express");
const env = require("../config/env");

/**
 * Every route in the API hangs off here.
 *
 * Phase 1 ships Auth. The other modules named in the brief — Profiles,
 * Discovery, Bookings, Payments, Chat, Notifications, Moderation, Admin —
 * mount alongside it as each phase lands, and the shape does not change.
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
router.get("/config", (req, res) =>
  res.json({
    brand: env.brand,
    minimumAge: env.minimumAge,
    commissionPct: env.money.commissionPct,
    gstPct: env.money.gstPct,
    priceRange: {
      minPaise: env.money.minPricePerHour,
      maxPaise: env.money.maxPricePerHour,
    },
  })
);

router.use("/auth", require("../modules/auth/auth.routes"));

// Phase 2 → profiles, discovery
// Phase 3 → plans, membership, payments
// Phase 4 → bookings, payouts
// Phase 5 → conversations, messages, reports, blocks
// Phase 6 → admin

module.exports = router;
