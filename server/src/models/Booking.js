const { DataTypes } = require("sequelize");

/**
 * One booking: a User paying for a number of hours of a Customer's time.
 *
 * Every amount here is an integer number of paise. ₹2,000 is 200000. Money
 * is never a float anywhere in this codebase, because 0.1 + 0.2 is not 0.3
 * and a rupee lost per booking is a rupee lost per booking.
 *
 * The commission percentage and the three amounts are written onto the row
 * at the moment the booking is made, and never recalculated. If an admin
 * changes the commission next month, bookings already taken keep the terms
 * they were agreed on.
 *
 *   amountPaise      what the User pays — exactly the price shown
 *   commissionPaise  what the company keeps
 *   payoutPaise      what the Customer receives
 *
 * amountPaise = commissionPaise + payoutPaise, always. The commission comes
 * out of the Customer's price; it is not added on top.
 */
module.exports = (sequelize) => {
  const Booking = sequelize.define(
    "Booking",
    {
      id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },

      userId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
      customerId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },

      hours: {
        type: DataTypes.DECIMAL(4, 1),
        allowNull: false,
        validate: { min: 0.5 },
      },
      startAt: { type: DataTypes.DATE, allowNull: false },

      /* The Customer's price when this booking was made. A later price
         change applies to new bookings only, so it is copied here. */
      pricePerHourPaise: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },

      amountPaise: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
      commissionPct: { type: DataTypes.DECIMAL(5, 2), allowNull: false },
      commissionPaise: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
      payoutPaise: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },

      /**
       * pending    made, not yet paid. Chat is shut.
       * paid       the gateway confirmed it server-side. Chat opens.
       * completed  both sides marked it done. The payout may be released.
       * cancelled  called off; refund decided by the cancellation rules.
       * refunded   money returned to the User.
       * disputed   waiting on an admin decision.
       */
      status: {
        type: DataTypes.ENUM(
          "pending",
          "paid",
          "completed",
          "cancelled",
          "refunded",
          "disputed"
        ),
        allowNull: false,
        defaultValue: "pending",
      },

      // Both sides have to agree it happened before money is released.
      userCompletedAt: { type: DataTypes.DATE, allowNull: true },
      customerCompletedAt: { type: DataTypes.DATE, allowNull: true },

      cancelledById: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
      cancelledAt: { type: DataTypes.DATE, allowNull: true },
      cancelReason: { type: DataTypes.STRING(300), allowNull: true },
      refundPaise: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },

      payoutReleasedAt: { type: DataTypes.DATE, allowNull: true },
    },
    {
      tableName: "bookings",
      indexes: [
        { fields: ["user_id", "status"] },
        { fields: ["customer_id", "status"] },
        { fields: ["start_at"] },
      ],
      validate: {
        /* A split that does not add up is a bug worth refusing to store. */
        splitAddsUp() {
          const total = BigInt(this.commissionPaise) + BigInt(this.payoutPaise);
          if (total !== BigInt(this.amountPaise)) {
            throw new Error(
              "commission + payout must equal the amount the User pays"
            );
          }
        },
      },
    }
  );

  /** Chat and contact details stay shut until the money is confirmed. */
  Booking.prototype.isUnlocked = function isUnlocked() {
    return ["paid", "completed", "disputed"].includes(this.status);
  };

  Booking.prototype.bothCompleted = function bothCompleted() {
    return Boolean(this.userCompletedAt && this.customerCompletedAt);
  };

  return Booking;
};
