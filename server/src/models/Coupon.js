const { DataTypes } = require("sequelize");

/**
 * A discount code for bookings, made by staff.
 *
 * percent: value is the percentage (e.g. 20), capped by maxDiscountPaise.
 * flat:    value is paise off (e.g. 20000 = ₹200).
 * The platform pays for the discount out of its commission; the Companion
 * always receives their full share.
 */
module.exports = (sequelize) =>
  sequelize.define(
    "Coupon",
    {
      id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
      code: { type: DataTypes.STRING(30), allowNull: false, unique: true },
      description: { type: DataTypes.STRING(200), allowNull: true },
      kind: { type: DataTypes.ENUM("percent", "flat"), allowNull: false, defaultValue: "percent" },
      value: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
      maxDiscountPaise: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
      minAmountPaise: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, defaultValue: 0 },
      firstBookingOnly: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      startsAt: { type: DataTypes.DATE, allowNull: true },
      endsAt: { type: DataTypes.DATE, allowNull: true },
      usageLimit: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
      perUserLimit: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 1 },
      isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    },
    { tableName: "coupons" }
  );
