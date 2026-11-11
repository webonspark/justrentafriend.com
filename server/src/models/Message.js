const { DataTypes } = require("sequelize");

/**
 * One chat message.
 *
 * `bodyFiltered` is what the other side actually reads: phone numbers and
 * social handles are masked out of early messages, and the original is kept
 * in `body` so a moderator reviewing a report sees what was really sent.
 */
module.exports = (sequelize) => {
  const Message = sequelize.define(
    "Message",
    {
      id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
      conversationId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
      senderId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },

      body: { type: DataTypes.TEXT, allowNull: false },
      bodyFiltered: { type: DataTypes.TEXT, allowNull: true },
      wasFiltered: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },

      deliveredAt: { type: DataTypes.DATE, allowNull: true },
      readAt: { type: DataTypes.DATE, allowNull: true },

      // Raised by the keyword filter for a moderator to look at.
      flagged: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      flagReason: { type: DataTypes.STRING(120), allowNull: true },
    },
    { tableName: "messages",
      indexes: [{ fields: ["conversation_id", "created_at"] }, { fields: ["flagged"] }] }
  );

  return Message;
};
