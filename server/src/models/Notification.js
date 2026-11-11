const { DataTypes } = require("sequelize");

/**
 * Something worth telling someone about, shown in the app and optionally
 * sent by email. No paid push service in this version.
 */
module.exports = (sequelize) => {
  const Notification = sequelize.define(
    "Notification",
    {
      id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
      userId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },

      type: { type: DataTypes.STRING(40), allowNull: false },
      title: { type: DataTypes.STRING(140), allowNull: false },
      body: { type: DataTypes.STRING(400), allowNull: true },
      link: { type: DataTypes.STRING(200), allowNull: true },

      readAt: { type: DataTypes.DATE, allowNull: true },
      emailedAt: { type: DataTypes.DATE, allowNull: true },
    },
    { tableName: "notifications",
      indexes: [{ fields: ["user_id", "read_at"] }] }
  );

  return Notification;
};
