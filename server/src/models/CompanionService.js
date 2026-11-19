const { DataTypes } = require("sequelize");

/** Which service categories one Companion offers. */
module.exports = (sequelize) =>
  sequelize.define(
    "CompanionService",
    {
      companionId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, primaryKey: true },
      categoryId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, primaryKey: true },
    },
    { tableName: "companion_services", timestamps: false }
  );
