const { DataTypes } = require("sequelize");

/**
 * A complaint about somebody, for the moderation queue.
 *
 * "solicitation" is its own reason on purpose: bookings are for social time
 * only, and a report of sexual services is the signal the policy depends on.
 */
module.exports = (sequelize) => {
  const Report = sequelize.define(
    "Report",
    {
      id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
      reporterId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
      reportedId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
      bookingId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
      messageId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },

      reason: {
        type: DataTypes.ENUM(
          "solicitation",
          "harassment",
          "fake_profile",
          "scam_or_money",
          "underage",
          "no_show",
          "offensive_photos",
          "other"
        ),
        allowNull: false,
      },
      details: { type: DataTypes.TEXT, allowNull: true },
      evidencePath: { type: DataTypes.STRING(300), allowNull: true },

      status: {
        type: DataTypes.ENUM("open", "reviewing", "actioned", "dismissed"),
        allowNull: false,
        defaultValue: "open",
      },
      // Solicitation and underage reports jump the queue.
      priority: { type: DataTypes.ENUM("normal", "high", "urgent"), allowNull: false, defaultValue: "normal" },

      handledById: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
      handledAt: { type: DataTypes.DATE, allowNull: true },
      outcome: { type: DataTypes.STRING(300), allowNull: true },
    },
    { tableName: "reports",
      indexes: [{ fields: ["status", "priority"] }, { fields: ["reported_id"] }] }
  );

  return Report;
};
