const { DataTypes } = require("sequelize");

/**
 * One paid membership period. A new row each time someone renews, so the
 * admin detail page can show the whole history.
 */
module.exports = (sequelize) => {
  const Subscription = sequelize.define(
    "Subscription",
    {
      id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
      userId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
      planId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
      paymentId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },

      startsAt: { type: DataTypes.DATE, allowNull: false },
      endsAt: { type: DataTypes.DATE, allowNull: false },

      status: {
        type: DataTypes.ENUM("pending", "active", "expired", "cancelled"),
        allowNull: false,
        defaultValue: "pending",
      },

      amountPaise: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
      gstPaise: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, defaultValue: 0 },
      totalPaise: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
      invoiceNo: { type: DataTypes.STRING(40), allowNull: true, unique: true },
    },
    { tableName: "subscriptions",
      indexes: [{ fields: ["user_id", "status"] }, { fields: ["ends_at"] }] }
  );

  return Subscription;
};
