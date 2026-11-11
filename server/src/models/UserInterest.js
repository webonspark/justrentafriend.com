const { DataTypes } = require("sequelize");

/**
 * Which interests belong to which account. A plain join table.
 */
module.exports = (sequelize) => {
  const UserInterest = sequelize.define(
    "UserInterest",
    {
      id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
      userId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
      interestId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    },
    { tableName: "user_interests",
      indexes: [{ unique: true, fields: ["user_id", "interest_id"] }] }
  );

  return UserInterest;
};
