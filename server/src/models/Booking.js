const { DataTypes } = require("sequelize");

/**
 * One booking: a Customer asking for a number of hours of a Companion's time.
 *
 * The flow, and the status at each step:
 *
 *   pending    the Customer has asked. The Companion accepts or rejects.
 *   accepted   the Companion said yes. The Customer now pays.
 *   rejected   the Companion said no. Nothing was charged.
 *   confirmed  paid. The money is held (escrow), chat opens.
 *   in_progress the Companion entered the Customer's start code at the meet.
 *   completed  the meet ended. The money stays held for the complaint
 *              window, then the payout is released to the Companion.
 *   cancelled  called off by either side; refund decided by the time rules.
 *   disputed   someone raised a problem; the money stays held for an admin.
 *   expired    nobody acted in time (no answer, or accepted but never paid).
 *
 * Every amount is an integer number of paise. ₹2,000 is 200000.
 *
 * The commission percentage and the three amounts are written onto the row
 * when the booking is made and never recalculated, so a later change to the
 * commission cannot alter terms already agreed.
 *
 *   amountPaise      what the Customer pays for the time — the price shown
 *   commissionPaise  what the company keeps
 *   payoutPaise      what the Companion receives
 *
 * amountPaise = commissionPaise + payoutPaise, always. The commission comes
 * out of the Companion's price; it is not added on top. GST on the
 * commission, when switched on, is charged on the platform's invoice.
 */
module.exports = (sequelize) => {
  const Booking = sequelize.define(
    "Booking",
    {
      id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },

      customerId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
      companionId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
      serviceId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },

      hours: {
        type: DataTypes.DECIMAL(4, 1),
        allowNull: false,
        validate: { min: 0.5 },
      },
      startAt: { type: DataTypes.DATE, allowNull: false },
      endAt: { type: DataTypes.DATE, allowNull: false },

      /* Public places only. The place is named, and its category is checked
         against the allowed list when the booking is made. */
      meetingPlaceName: { type: DataTypes.STRING(160), allowNull: false },
      meetingPlaceType: { type: DataTypes.STRING(40), allowNull: false },
      meetingPlaceAddress: { type: DataTypes.STRING(300), allowNull: true },
      note: { type: DataTypes.STRING(500), allowNull: true },

      /* The Companion's price when this booking was made. A later price
         change applies to new bookings only, so it is copied here. */
      pricePerHourPaise: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },

      amountPaise: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
      commissionPct: { type: DataTypes.DECIMAL(5, 2), allowNull: false },
      commissionPaise: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
      payoutPaise: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },

      status: {
        type: DataTypes.ENUM(
          "pending",
          "accepted",
          "rejected",
          "confirmed",
          "in_progress",
          "completed",
          "cancelled",
          "disputed",
          "expired"
        ),
        allowNull: false,
        defaultValue: "pending",
      },

      respondedAt: { type: DataTypes.DATE, allowNull: true },
      rejectReason: { type: DataTypes.STRING(300), allowNull: true },
      paidAt: { type: DataTypes.DATE, allowNull: true },

      /* The 4-digit code the Customer shows at the meet. The Companion enters
         it to start the meet — proof that both were really there. Shown to
         the Customer only. */
      startCode: { type: DataTypes.STRING(4), allowNull: true },
      startCodeAttempts: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
      startedAt: { type: DataTypes.DATE, allowNull: true },

      /* Check-in / check-out, for safety and as proof the meet happened. */
      customerCheckInAt: { type: DataTypes.DATE, allowNull: true },
      companionCheckInAt: { type: DataTypes.DATE, allowNull: true },
      customerCompletedAt: { type: DataTypes.DATE, allowNull: true },
      companionCompletedAt: { type: DataTypes.DATE, allowNull: true },
      completedAt: { type: DataTypes.DATE, allowNull: true },

      cancelledById: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
      cancelledAt: { type: DataTypes.DATE, allowNull: true },
      cancelReason: { type: DataTypes.STRING(300), allowNull: true },
      refundPaise: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },

      disputeReason: { type: DataTypes.STRING(500), allowNull: true },
      disputedById: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
      disputeResolution: { type: DataTypes.STRING(500), allowNull: true },

      /* Escrow: the money is held from payment until this is set. */
      payoutReleasedAt: { type: DataTypes.DATE, allowNull: true },
      reminderSentAt: { type: DataTypes.DATE, allowNull: true },
    },
    {
      tableName: "bookings",
      indexes: [
        { fields: ["customer_id", "status"] },
        { fields: ["companion_id", "status"] },
        { fields: ["start_at"] },
      ],
      validate: {
        /* A split that does not add up is a bug worth refusing to store. */
        splitAddsUp() {
          // A partial update (refund, payout date) does not carry the amounts.
          if ([this.amountPaise, this.commissionPaise, this.payoutPaise].some((v) => v === undefined || v === null)) return;
          const total = BigInt(this.commissionPaise) + BigInt(this.payoutPaise);
          if (total !== BigInt(this.amountPaise)) {
            throw new Error("commission + payout must equal the amount the Customer pays");
          }
        },
      },
    }
  );

  /** Chat and the meet itself open only once the money is held. */
  Booking.prototype.isUnlocked = function isUnlocked() {
    return ["confirmed", "in_progress", "completed", "disputed"].includes(this.status);
  };

  /** Statuses that hold the Companion's time, for clash checks. */
  Booking.LIVE = ["pending", "accepted", "confirmed", "in_progress"];

  /** Hours after the meet ends during which either side can raise a complaint. */
  Booking.COMPLAINT_WINDOW_HOURS = 24;

  /** True while a completed meet is still inside its complaint window. */
  Booking.prototype.inComplaintWindow = function inComplaintWindow(now = Date.now()) {
    return (
      this.status === "completed" &&
      Boolean(this.completedAt) &&
      now < new Date(this.completedAt).getTime() + Booking.COMPLAINT_WINDOW_HOURS * 3600e3
    );
  };

  return Booking;
};
