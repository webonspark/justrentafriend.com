const { DataTypes } = require("sequelize");

/**
 * Where a Companion's payouts go: a UPI ID or a bank account.
 *
 * Only the last four digits of an account number are stored. The full
 * number goes straight to the payout provider (Razorpay Route / Cashfree
 * Payouts), which holds it; in development the mock provider keeps nothing.
 */
module.exports = (sequelize) =>
  sequelize.define(
    "PayoutAccount",
    {
      id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
      companionId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, unique: true },
      method: { type: DataTypes.ENUM("upi", "bank"), allowNull: false },
      upiId: { type: DataTypes.STRING(100), allowNull: true },
      accountName: { type: DataTypes.STRING(120), allowNull: true },
      accountLast4: { type: DataTypes.STRING(4), allowNull: true },
      ifsc: { type: DataTypes.STRING(11), allowNull: true },
      providerRef: { type: DataTypes.STRING(120), allowNull: true },
    },
    { tableName: "payout_accounts" }
  );
