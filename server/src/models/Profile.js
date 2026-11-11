const { DataTypes } = require("sequelize");

/**
 * The public face of an account: bio, city, interests and where they are.
 *
 * Latitude and longitude are kept so Discovery can sort by distance, but an
 * exact position is never sent to the browser. Discovery returns a rounded
 * distance in kilometres and the city name, nothing finer.
 */
module.exports = (sequelize) => {
  const Profile = sequelize.define(
    "Profile",
    {
      id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
      userId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, unique: true },

      gender: { type: DataTypes.ENUM("female", "male", "other", "prefer_not_to_say"), allowNull: true },
      bio: { type: DataTypes.TEXT, allowNull: true },
      city: { type: DataTypes.STRING(80), allowNull: true },
      state: { type: DataTypes.STRING(80), allowNull: true },
      country: { type: DataTypes.STRING(80), allowNull: false, defaultValue: "India" },

      // Never leaves the server as-is; distance is derived from it.
      latitude: { type: DataTypes.DECIMAL(10, 7), allowNull: true },
      longitude: { type: DataTypes.DECIMAL(10, 7), allowNull: true },

      languages: { type: DataTypes.STRING(200), allowNull: true },
      occupation: { type: DataTypes.STRING(120), allowNull: true },

      // Set by the photo-review queue once at least one photo is approved.
      isVerified: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      ratingAvg: { type: DataTypes.DECIMAL(3, 2), allowNull: false, defaultValue: 0 },
      ratingCount: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },

      lastSeenAt: { type: DataTypes.DATE, allowNull: true },
      onboardingComplete: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    },
    { tableName: "profiles",
      indexes: [{ fields: ["city"] }, { fields: ["latitude", "longitude"] }] }
  );

  return Profile;
};
