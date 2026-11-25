const { DataTypes } = require("sequelize");

/**
 * Money coming in, for a membership or a booking.
 *
 * `gatewayOrderId` and `gatewayPaymentId` are what the webhook matches on,
 * and the unique index on the payment id is what makes the webhook safe to
 * receive twice — a repeat delivery cannot be applied a second time.
 */
module.exports = (sequelize) => {
  const Payment = sequelize.define(
    "Payment",
    {
      id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
      // Null once the payer's account is erased; the payment record stays.
      userId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },

      purpose: { type: DataTypes.ENUM("membership", "booking"), allowNull: false },
      bookingId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
      subscriptionId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },

      gateway: { type: DataTypes.STRING(30), allowNull: false, defaultValue: "mock" },
      gatewayOrderId: { type: DataTypes.STRING(120), allowNull: true },
      gatewayPaymentId: { type: DataTypes.STRING(120), allowNull: true, unique: true },
      gatewaySignature: { type: DataTypes.STRING(200), allowNull: true },

      amountPaise: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
      gstPaise: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, defaultValue: 0 },
      feePaise: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, defaultValue: 0 },
      totalPaise: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
      currency: { type: DataTypes.STRING(3), allowNull: false, defaultValue: "INR" },

      status: {
        type: DataTypes.ENUM("created", "pending", "paid", "failed", "refunded"),
        allowNull: false,
        defaultValue: "created",
      },
      failureReason: { type: DataTypes.STRING(200), allowNull: true },
      paidAt: { type: DataTypes.DATE, allowNull: true },
      refundedPaise: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
      /* Bookings only. totalPaise is what the gateway charged; walletPaise
         came out of the wallet; discountPaise is the coupon. Of refundedPaise,
         refundedToWalletPaise went back to the wallet instead of the card. */
      walletPaise: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, defaultValue: 0 },
      discountPaise: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, defaultValue: 0 },
      couponId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
      refundedToWalletPaise: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, defaultValue: 0 },
      invoiceNo: { type: DataTypes.STRING(40), allowNull: true },
    },
    { tableName: "payments",
      indexes: [{ fields: ["user_id", "status"] }, { fields: ["gateway_order_id"] }] }
  );

  return Payment;
};
