const { DataTypes } = require("sequelize");

/**
 * A tag people pick during onboarding — "live music", "trekking", "films".
 * Seeded, not free text, so Discovery can filter on it cleanly.
 */
module.exports = (sequelize) => {
  const Interest = sequelize.define(
    "Interest",
    {
      id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
      name: { type: DataTypes.STRING(60), allowNull: false, unique: true },
      slug: { type: DataTypes.STRING(60), allowNull: false, unique: true },
      icon: { type: DataTypes.STRING(40), allowNull: true },
    },
    { tableName: "interests" }
  );

  return Interest;
};
