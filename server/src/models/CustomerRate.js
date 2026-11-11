const { DataTypes } = require("sequelize");

/**
 * What one Customer charges for an hour, in paise.
 *
 * A row per change rather than a column on the user, so the history is kept:
 * a booking copies the price it was made at, and this table says when the
 * price moved and what it moved from.
 */
module.exports = (sequelize) => {
  const CustomerRate = sequelize.define(
    "CustomerRate",
    {
      id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
      customerId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },

      pricePerHourPaise: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
      currency: { type: DataTypes.STRING(3), allowNull: false, defaultValue: "INR" },

      // Exactly one row per Customer is current; the rest are history.
      isCurrent: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    },
    { tableName: "customer_rates",
      indexes: [{ fields: ["customer_id", "is_current"] }] }
  );

  return CustomerRate;
};
