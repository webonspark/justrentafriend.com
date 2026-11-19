const { DataTypes } = require("sequelize");

/**
 * A Companion's weekly calendar: one row per window they are free in.
 *
 *   weekday   0 = Sunday … 6 = Saturday
 *   startTime "HH:MM", local (IST)
 *   endTime   "HH:MM", local (IST), after startTime
 *
 * A booking must sit entirely inside one window on its weekday and must not
 * overlap another live booking. Both rules are checked on the server.
 */
module.exports = (sequelize) =>
  sequelize.define(
    "Availability",
    {
      id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
      companionId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
      weekday: { type: DataTypes.TINYINT.UNSIGNED, allowNull: false, validate: { min: 0, max: 6 } },
      startTime: { type: DataTypes.STRING(5), allowNull: false },
      endTime: { type: DataTypes.STRING(5), allowNull: false },
    },
    { tableName: "availability", indexes: [{ fields: ["companion_id", "weekday"] }] }
  );
