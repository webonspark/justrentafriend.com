const { DataTypes } = require("sequelize");

/**
 * An identity document a Customer uploads before their first payout.
 *
 * `numberMasked` is all that is kept of the number itself — the last four
 * digits — so the full number is never in the database to leak. The file is
 * visible only to roles with permission, and every view is written to the
 * audit log.
 */
module.exports = (sequelize) => {
  const KycDocument = sequelize.define(
    "KycDocument",
    {
      id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
      userId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },

      docType: { type: DataTypes.ENUM("aadhaar", "pan", "passport", "driving_licence"), allowNull: false },
      numberMasked: { type: DataTypes.STRING(30), allowNull: false },
      filePath: { type: DataTypes.STRING(300), allowNull: false },

      status: {
        type: DataTypes.ENUM("submitted", "approved", "rejected"),
        allowNull: false,
        defaultValue: "submitted",
      },
      reviewedById: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
      reviewedAt: { type: DataTypes.DATE, allowNull: true },
      rejectionReason: { type: DataTypes.STRING(200), allowNull: true },
    },
    { tableName: "kyc_documents",
      indexes: [{ fields: ["user_id", "status"] }] }
  );

  return KycDocument;
};
