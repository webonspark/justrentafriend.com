const { DataTypes } = require("sequelize");

/**
 * An account. One row per person, whichever side of the market they are on.
 *
 *   role "customer"   books and pays for a Companion's time
 *   role "companion"  is listed, sets a price per hour, receives payouts
 *
 * Membership is compulsory for both. While `membershipStatus` is anything
 * other than "active" a Companion is hidden from Discovery, and neither side
 * can open a chat or make a booking. That rule is enforced on the server,
 * in Discovery and in the booking service — never in the browser alone.
 *
 * Date of birth is stored, not age: age is derived so it stays correct, and
 * the 18+ check is applied at sign-up and again whenever it matters.
 */
module.exports = (sequelize) => {
  const User = sequelize.define(
    "User",
    {
      id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },

      role: {
        type: DataTypes.ENUM("customer", "companion"),
        allowNull: false,
      },

      fullName: { type: DataTypes.STRING(120), allowNull: false },

      email: {
        type: DataTypes.STRING(190),
        allowNull: false,
        unique: true,
        validate: { isEmail: true },
      },
      mobile: {
        type: DataTypes.STRING(20),
        allowNull: false,
        unique: true,
      },

      // Never returned by the API, never logged. See toSafeJSON below.
      passwordHash: { type: DataTypes.STRING(100), allowNull: false },

      dateOfBirth: { type: DataTypes.DATEONLY, allowNull: false },

      emailVerified: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      mobileVerified: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },

      /* What an admin has done to this account.
         "pending" is the state between sign-up and email verification. */
      status: {
        type: DataTypes.ENUM("pending", "active", "warned", "suspended", "banned", "deleted"),
        allowNull: false,
        defaultValue: "pending",
      },

      membershipStatus: {
        type: DataTypes.ENUM("none", "active", "expired", "cancelled"),
        allowNull: false,
        defaultValue: "none",
      },
      membershipExpiresAt: { type: DataTypes.DATE, allowNull: true },

      kycStatus: {
        type: DataTypes.ENUM("none", "submitted", "approved", "rejected"),
        allowNull: false,
        defaultValue: "none",
      },

      // Consent is recorded, not assumed — the DPDP Act expects proof of it.
      consentAcceptedAt: { type: DataTypes.DATE, allowNull: true },
      consentVersion: { type: DataTypes.STRING(20), allowNull: true },

      lastLoginAt: { type: DataTypes.DATE, allowNull: true },
      lastLoginIp: { type: DataTypes.STRING(45), allowNull: true },

      /* Deleting an account starts a 30-day grace period rather than wiping
         the row, so it can be undone and so finance records survive. */
      deletionRequestedAt: { type: DataTypes.DATE, allowNull: true },
    },
    {
      tableName: "users",
      indexes: [
        { fields: ["email"] },
        { fields: ["mobile"] },
        { fields: ["role", "status"] },
        { fields: ["membership_status", "membership_expires_at"] },
      ],
    }
  );

  /** Age in whole years today. The only place age is worked out. */
  User.prototype.age = function age() {
    const dob = new Date(this.dateOfBirth);
    const now = new Date();
    let years = now.getFullYear() - dob.getFullYear();
    const monthDiff = now.getMonth() - dob.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) years -= 1;
    return years;
  };

  /**
   * Whether this account may be seen and may connect right now.
   * Checked before Discovery returns a row and before a booking is made.
   */
  User.prototype.isMemberActive = function isMemberActive() {
    if (this.membershipStatus !== "active") return false;
    if (!this.membershipExpiresAt) return false;
    return new Date(this.membershipExpiresAt).getTime() > Date.now();
  };

  User.prototype.canTransact = function canTransact() {
    return this.status === "active" && this.isMemberActive();
  };

  /** The only shape of a user that ever leaves the server. */
  User.prototype.toSafeJSON = function toSafeJSON() {
    return {
      id: this.id,
      role: this.role,
      fullName: this.fullName,
      email: this.email,
      mobile: this.mobile,
      age: this.age(),
      emailVerified: this.emailVerified,
      mobileVerified: this.mobileVerified,
      status: this.status,
      membershipStatus: this.membershipStatus,
      membershipExpiresAt: this.membershipExpiresAt,
      kycStatus: this.kycStatus,
      memberActive: this.isMemberActive(),
      createdAt: this.createdAt,
    };
  };

  return User;
};
