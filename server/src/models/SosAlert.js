const { DataTypes } = require("sequelize");

/**
 * An SOS raised during a meet.
 *
 * The member's emergency contact gets an SMS/WhatsApp with a private link
 * (by `shareToken`) showing the live location, which the member's phone
 * keeps updating while the alert is active. The safety team sees it at the
 * top of the admin queue.
 */
module.exports = (sequelize) =>
  sequelize.define(
    "SosAlert",
    {
      id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
      userId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
      bookingId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
      shareToken: { type: DataTypes.STRING(64), allowNull: false, unique: true },
      latitude: { type: DataTypes.DECIMAL(10, 7), allowNull: true },
      longitude: { type: DataTypes.DECIMAL(10, 7), allowNull: true },
      accuracyM: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
      locationAt: { type: DataTypes.DATE, allowNull: true },
      status: { type: DataTypes.ENUM("active", "resolved"), allowNull: false, defaultValue: "active" },
      resolvedAt: { type: DataTypes.DATE, allowNull: true },
      resolvedNote: { type: DataTypes.STRING(300), allowNull: true },
    },
    { tableName: "sos_alerts", indexes: [{ fields: ["status"] }, { fields: ["user_id"] }] }
  );
