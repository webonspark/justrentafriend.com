const { DataTypes } = require("sequelize");

/**
 * A thread between one User and one Customer.
 *
 * It exists only because a booking was paid for. `bookingId` is what proves
 * that, and the chat service refuses to open a thread without one.
 */
module.exports = (sequelize) => {
  const Conversation = sequelize.define(
    "Conversation",
    {
      id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
      userId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
      customerId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
      bookingId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },

      lastMessageAt: { type: DataTypes.DATE, allowNull: true },
      isClosed: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    },
    { tableName: "conversations",
      indexes: [{ unique: true, fields: ["booking_id"] }, { fields: ["user_id"] }, { fields: ["customer_id"] }] }
  );

  return Conversation;
};
