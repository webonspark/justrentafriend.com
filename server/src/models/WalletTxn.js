const { DataTypes } = require("sequelize");

/**
 * One line in a member's wallet: money in (+) or out (−), in paise.
 *
 * The balance lives on users.wallet_paise and every change to it writes one
 * of these in the same transaction, with the balance after it, so the
 * statement always adds up and nothing is ever edited in place.
 *
 *   refund     a booking refund credited instantly
 *   referral   the refer-a-friend reward
 *   payment    spent on a booking (negative)
 *   release    wallet money put back when a checkout was abandoned
 *   admin      a manual adjustment by staff, with a reason
 */
module.exports = (sequelize) =>
  sequelize.define(
    "WalletTxn",
    {
      id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
      userId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
      kind: { type: DataTypes.ENUM("refund", "referral", "payment", "release", "admin"), allowNull: false },
      amountPaise: { type: DataTypes.BIGINT, allowNull: false },
      balanceAfterPaise: { type: DataTypes.BIGINT, allowNull: false },
      bookingId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
      paymentId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
      note: { type: DataTypes.STRING(300), allowNull: true },
      adminId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    },
    { tableName: "wallet_txns", updatedAt: false, indexes: [{ fields: ["user_id", "created_at"] }] }
  );
