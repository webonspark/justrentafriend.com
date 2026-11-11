const { DataTypes } = require("sequelize");

/**
 * One admin-editable setting, as a key and a JSON value.
 *
 * The commission percentage lives here rather than in code, because the
 * brief requires an admin to be able to change it. Price limits, cancellation
 * hours and GST flags are here for the same reason.
 */
module.exports = (sequelize) => {
  const Setting = sequelize.define(
    "Setting",
    {
      id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
      key: { type: DataTypes.STRING(60), allowNull: false, unique: true },
      value: { type: DataTypes.JSON, allowNull: false },
      label: { type: DataTypes.STRING(140), allowNull: true },
      group: { type: DataTypes.STRING(40), allowNull: false, defaultValue: "general" },
      updatedById: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    },
    { tableName: "settings" }
  );

  return Setting;
};
