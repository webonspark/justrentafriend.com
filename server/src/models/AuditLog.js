const { DataTypes } = require("sequelize");

/**
 * Who did what, when, and from where.
 *
 * Written for every admin action and for every look at sensitive data — a
 * KYC document, a bank detail, a private chat opened because of a report.
 * The DPDP Act expects that trail to exist, and it is read-only once written.
 */
module.exports = (sequelize) => {
  const AuditLog = sequelize.define(
    "AuditLog",
    {
      id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
      actorType: { type: DataTypes.ENUM("admin", "user", "system"), allowNull: false, defaultValue: "admin" },
      actorId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
      actorName: { type: DataTypes.STRING(120), allowNull: true },

      action: { type: DataTypes.STRING(60), allowNull: false },
      entityType: { type: DataTypes.STRING(40), allowNull: false },
      entityId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },

      detail: { type: DataTypes.STRING(400), allowNull: true },
      // Whether this row records a look at something sensitive.
      wasSensitive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },

      ip: { type: DataTypes.STRING(45), allowNull: true },
      userAgent: { type: DataTypes.STRING(300), allowNull: true },
    },
    { tableName: "audit_logs",
      indexes: [{ fields: ["entity_type", "entity_id"] }, { fields: ["actor_id"] }, { fields: ["created_at"] }] }
  );

  return AuditLog;
};
