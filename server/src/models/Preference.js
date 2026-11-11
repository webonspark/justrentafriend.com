const { DataTypes } = require("sequelize");

/**
 * What someone wants Discovery to show them by default, so the filters
 * are not re-set on every visit.
 */
module.exports = (sequelize) => {
  const Preference = sequelize.define(
    "Preference",
    {
      id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
      userId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, unique: true },

      minAge: { type: DataTypes.TINYINT.UNSIGNED, allowNull: false, defaultValue: 18 },
      maxAge: { type: DataTypes.TINYINT.UNSIGNED, allowNull: false, defaultValue: 60 },
      maxDistanceKm: { type: DataTypes.SMALLINT.UNSIGNED, allowNull: false, defaultValue: 25 },
      minPricePaise: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
      maxPricePaise: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
      verifiedOnly: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },

      emailNotifications: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      showOnlineStatus: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    },
    { tableName: "preferences" }
  );

  return Preference;
};
