const { DataTypes } = require("sequelize");

/**
 * A staff account for the admin area at /admin.
 *
 * Deliberately a separate table from `users`: a moderator is not a member,
 * and a member must never be able to become staff by changing a column on
 * their own row.
 */
module.exports = (sequelize) => {
  const AdminUser = sequelize.define(
    "AdminUser",
    {
      id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
      name: { type: DataTypes.STRING(120), allowNull: false },
      email: { type: DataTypes.STRING(190), allowNull: false, unique: true, validate: { isEmail: true } },
      passwordHash: { type: DataTypes.STRING(100), allowNull: false },

      role: {
        type: DataTypes.ENUM("super_admin", "finance", "moderator", "support"),
        allowNull: false,
        defaultValue: "support",
      },

      isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      lastLoginAt: { type: DataTypes.DATE, allowNull: true },
      lastLoginIp: { type: DataTypes.STRING(45), allowNull: true },
    },
    { tableName: "admin_users" }
  );

  return AdminUser;
};
