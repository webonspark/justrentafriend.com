const { DataTypes } = require("sequelize");

/**
 * One live session.
 *
 * Refresh tokens rotate: using one issues a replacement and retires the old
 * row. If a retired token is ever presented again it means a copy was stolen,
 * so the whole family is revoked and that person is signed out everywhere.
 */
module.exports = (sequelize) => {
  const RefreshToken = sequelize.define(
    "RefreshToken",
    {
      id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
      userId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
      adminId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },

      // The token is hashed, like a password, for the same reason.
      tokenHash: { type: DataTypes.STRING(100), allowNull: false, unique: true },
      // All the rotations descended from one login share a family id.
      familyId: { type: DataTypes.STRING(64), allowNull: false },

      expiresAt: { type: DataTypes.DATE, allowNull: false },
      revokedAt: { type: DataTypes.DATE, allowNull: true },
      replacedByHash: { type: DataTypes.STRING(100), allowNull: true },

      ip: { type: DataTypes.STRING(45), allowNull: true },
      userAgent: { type: DataTypes.STRING(300), allowNull: true },
    },
    { tableName: "refresh_tokens",
      indexes: [{ fields: ["family_id"] }, { fields: ["user_id"] }, { fields: ["expires_at"] }] }
  );

  return RefreshToken;
};
