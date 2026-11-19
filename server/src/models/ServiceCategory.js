const { DataTypes } = require("sequelize");

/**
 * A kind of time a Companion offers — "City walk", "Café catch-up",
 * "Event plus-one". Managed by admins, picked by Companions, filtered on in
 * search. Seeded, not free text, so search can filter cleanly.
 */
module.exports = (sequelize) => {
  const ServiceCategory = sequelize.define(
    "ServiceCategory",
    {
      id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
      name: { type: DataTypes.STRING(60), allowNull: false, unique: true },
      slug: { type: DataTypes.STRING(60), allowNull: false, unique: true },
      description: { type: DataTypes.STRING(200), allowNull: true },
      isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      sortOrder: { type: DataTypes.SMALLINT.UNSIGNED, allowNull: false, defaultValue: 0 },
    },
    { tableName: "service_categories" }
  );
  return ServiceCategory;
};
