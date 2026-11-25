const { DataTypes } = require("sequelize");

/**
 * A public meeting place staff have checked: a café, mall, park, museum.
 * Bookings pick one of these, so every meet is somewhere busy and known.
 */
module.exports = (sequelize) =>
  sequelize.define(
    "PublicPlace",
    {
      id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
      name: { type: DataTypes.STRING(160), allowNull: false },
      type: { type: DataTypes.STRING(40), allowNull: false },
      city: { type: DataTypes.STRING(80), allowNull: false },
      area: { type: DataTypes.STRING(80), allowNull: true },
      address: { type: DataTypes.STRING(300), allowNull: true },
      latitude: { type: DataTypes.DECIMAL(10, 7), allowNull: false },
      longitude: { type: DataTypes.DECIMAL(10, 7), allowNull: false },
      isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    },
    { tableName: "public_places", indexes: [{ fields: ["city", "is_active"] }] }
  );
