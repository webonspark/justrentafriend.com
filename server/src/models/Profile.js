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
      // Neighbourhood, shown publicly ("Indiranagar"); the exact spot never is.
      area: { type: DataTypes.STRING(80), allowNull: true },
      state: { type: DataTypes.STRING(80), allowNull: true },
      country: { type: DataTypes.STRING(80), allowNull: false, defaultValue: "India" },

      // Never leaves the server as-is; distance is derived from it.
      latitude: { type: DataTypes.DECIMAL(10, 7), allowNull: true },
      longitude: { type: DataTypes.DECIMAL(10, 7), allowNull: true },

      languages: { type: DataTypes.STRING(200), allowNull: true },
      occupation: { type: DataTypes.STRING(120), allowNull: true },

      /* The "Verified" badge: KYC approved and the selfie matched the
         profile photo. Set by the KYC review, never by the member. */
      isVerified: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },

      /* Selfie / liveness check. The selfie is compared against the primary
         photo by the KYC provider (mocked in development). */
      selfieStatus: {
        type: DataTypes.ENUM("none", "submitted", "approved", "rejected"),
        allowNull: false,
        defaultValue: "none",
      },
      selfiePath: { type: DataTypes.STRING(300), allowNull: true },
      selfieMatchScore: { type: DataTypes.DECIMAL(5, 2), allowNull: true },

      /* A Companion is not listed until an admin approves them.
         Customers are "approved" from the start. */
      approvalStatus: {
        type: DataTypes.ENUM("draft", "pending", "approved", "rejected"),
        allowNull: false,
        defaultValue: "draft",
      },
      approvalNote: { type: DataTypes.STRING(300), allowNull: true },
      approvedAt: { type: DataTypes.DATE, allowNull: true },

      // Who gets the SOS link during a meet.
      emergencyContactName: { type: DataTypes.STRING(120), allowNull: true },
      emergencyContactPhone: { type: DataTypes.STRING(20), allowNull: true },

      completedMeets: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
      ratingAvg: { type: DataTypes.DECIMAL(3, 2), allowNull: false, defaultValue: 0 },
      ratingCount: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },

      lastSeenAt: { type: DataTypes.DATE, allowNull: true },

      /* Companions: "Available now" for same-day meets, until this time. */
      availableNowUntil: { type: DataTypes.DATE, allowNull: true },
      /* Companions: only take requests from ID-verified Customers. */
      verifiedCustomersOnly: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      /* Set when the rating fell below the bar; staff review, then clear it. */
      ratingReviewAt: { type: DataTypes.DATE, allowNull: true },
      onboardingComplete: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    },
    { tableName: "profiles",
      indexes: [{ fields: ["city"] }, { fields: ["approval_status"] }, { fields: ["latitude", "longitude"] }] }
  );

  return Profile;
};
