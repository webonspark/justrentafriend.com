const { DataTypes } = require("sequelize");

/** A coupon used on a paid booking. "released" when the booking fell through. */
module.exports = (sequelize) =>
  sequelize.define(
    "CouponRedemption",
    {
      id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
      couponId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
      userId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
      bookingId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, unique: true },
      discountPaise: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
      status: { type: DataTypes.ENUM("used", "released"), allowNull: false, defaultValue: "used" },
    },
    { tableName: "coupon_redemptions", indexes: [{ fields: ["coupon_id", "status"] }, { fields: ["user_id"] }] }
  );
