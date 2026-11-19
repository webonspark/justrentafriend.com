const { DataTypes } = require("sequelize");

/**
 * A membership plan. Compulsory for both sides before anything opens.
 */
module.exports = (sequelize) => {
  const Plan = sequelize.define(
    "Plan",
    {
      id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
      name: { type: DataTypes.STRING(60), allowNull: false },
      slug: { type: DataTypes.STRING(60), allowNull: false, unique: true },
      days: { type: DataTypes.SMALLINT.UNSIGNED, allowNull: false },

      pricePaise: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
      // GST is shown separately at checkout and on the invoice.
      gstPct: { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 18 },

      // null means the plan is for both roles.
      forRole: { type: DataTypes.ENUM("customer", "companion"), allowNull: true },

      isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      sortOrder: { type: DataTypes.TINYINT.UNSIGNED, allowNull: false, defaultValue: 0 },
      blurb: { type: DataTypes.STRING(200), allowNull: true },
    },
    { tableName: "plans" }
  );

  return Plan;
};
