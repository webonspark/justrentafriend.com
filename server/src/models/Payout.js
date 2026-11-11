const { DataTypes } = require("sequelize");

/**
 * Money going out to a Customer once a booking is complete.
 *
 * Released only after both sides mark the booking done, or after an admin
 * settles a dispute. Every payment out carries a bank reference, so it can
 * be traced later.
 */
module.exports = (sequelize) => {
  const Payout = sequelize.define(
    "Payout",
    {
      id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
      customerId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
      bookingId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },

      amountPaise: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },

      status: {
        type: DataTypes.ENUM("pending", "approved", "paid", "failed", "on_hold"),
        allowNull: false,
        defaultValue: "pending",
      },

      bankReference: { type: DataTypes.STRING(80), allowNull: true },
      paidAt: { type: DataTypes.DATE, allowNull: true },
      processedById: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
      note: { type: DataTypes.STRING(300), allowNull: true },
    },
    { tableName: "payouts",
      indexes: [{ fields: ["customer_id", "status"] }, { unique: true, fields: ["booking_id"] }] }
  );

  return Payout;
};
