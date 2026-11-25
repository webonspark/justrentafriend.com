const { DataTypes } = require("sequelize");

/** A Companion a Customer saved, for "Book again". */
module.exports = (sequelize) =>
  sequelize.define(
    "Favorite",
    {
      id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
      userId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
      companionId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    },
    { tableName: "favorites", updatedAt: false, indexes: [{ unique: true, fields: ["user_id", "companion_id"] }] }
  );
