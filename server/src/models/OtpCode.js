const { DataTypes } = require("sequelize");

/**
 * A one-time code sent by email, for verifying an address or resetting a
 * password.
 *
 * The code itself is never stored — only a hash of it — so a leaked database
 * cannot be used to walk into accounts. Codes expire, attempts are counted,
 * and a used code is marked spent so it cannot be replayed.
 */
module.exports = (sequelize) => {
  const OtpCode = sequelize.define(
    "OtpCode",
    {
      id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
      userId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
      destination: { type: DataTypes.STRING(190), allowNull: false },

      purpose: {
        type: DataTypes.ENUM("verify_email", "verify_mobile", "login_mobile", "reset_password", "change_email", "change_mobile"),
        allowNull: false,
      },

      codeHash: { type: DataTypes.STRING(100), allowNull: false },
      expiresAt: { type: DataTypes.DATE, allowNull: false },
      attempts: { type: DataTypes.TINYINT.UNSIGNED, allowNull: false, defaultValue: 0 },
      consumedAt: { type: DataTypes.DATE, allowNull: true },
    },
    { tableName: "otp_codes",
      indexes: [{ fields: ["destination", "purpose"] }, { fields: ["expires_at"] }] }
  );

  return OtpCode;
};
