const { DataTypes } = require("sequelize");

/**
 * A rating left after a completed booking. Two-way: the Customer rates the
 * Companion and the Companion rates the Customer. One review per author per
 * booking, enforced by the unique index, and only once the booking is
 * completed — enforced in the review service.
 */
module.exports = (sequelize) =>
  sequelize.define(
    "Review",
    {
      id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
      bookingId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
      authorId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
      subjectId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
      rating: { type: DataTypes.TINYINT.UNSIGNED, allowNull: false, validate: { min: 1, max: 5 } },
      comment: { type: DataTypes.STRING(1000), allowNull: true },
      isHidden: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    },
    {
      tableName: "reviews",
      indexes: [{ unique: true, fields: ["booking_id", "author_id"] }, { fields: ["subject_id"] }],
    }
  );
