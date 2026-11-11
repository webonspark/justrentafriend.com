const { DataTypes } = require("sequelize");

/**
 * One person refusing to see or hear from another. Mutual in effect:
 * neither appears in the other's Discovery, and neither can message.
 */
module.exports = (sequelize) => {
  const Block = sequelize.define(
    "Block",
    {
      id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
      blockerId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
      blockedId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
      reason: { type: DataTypes.STRING(200), allowNull: true },
    },
    { tableName: "blocks",
      indexes: [{ unique: true, fields: ["blocker_id", "blocked_id"] }] }
  );

  return Block;
};
