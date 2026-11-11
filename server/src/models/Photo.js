const { DataTypes } = require("sequelize");

/**
 * One uploaded photo, waiting on the review queue until a moderator sees it.
 *
 * Nothing is shown publicly at "pending": a profile with no approved photo
 * falls back to the illustrated placeholder. EXIF is stripped on upload, so
 * a photo can never leak where it was taken.
 */
module.exports = (sequelize) => {
  const Photo = sequelize.define(
    "Photo",
    {
      id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
      userId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },

      path: { type: DataTypes.STRING(300), allowNull: false },
      thumbPath: { type: DataTypes.STRING(300), allowNull: true },

      position: { type: DataTypes.TINYINT.UNSIGNED, allowNull: false, defaultValue: 0 },
      isPrimary: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },

      moderationStatus: {
        type: DataTypes.ENUM("pending", "approved", "rejected"),
        allowNull: false,
        defaultValue: "pending",
      },
      moderatedById: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
      moderatedAt: { type: DataTypes.DATE, allowNull: true },
      rejectionReason: { type: DataTypes.STRING(200), allowNull: true },
    },
    { tableName: "photos",
      indexes: [{ fields: ["user_id", "moderation_status"] }] }
  );

  return Photo;
};
