const sequelize = require("../config/db");

/**
 * Every model, and how they relate.
 *
 * Deletion rules are chosen so that money survives people. Deleting an
 * account takes its profile, photos and preferences with it, but payments,
 * payouts and audit rows are kept with a null actor: finance and compliance
 * records have to outlive the account they came from.
 */

const User = require("./User")(sequelize);
const Profile = require("./Profile")(sequelize);
const Photo = require("./Photo")(sequelize);
const Interest = require("./Interest")(sequelize);
const UserInterest = require("./UserInterest")(sequelize);
const Preference = require("./Preference")(sequelize);
const CompanionRate = require("./CompanionRate")(sequelize);
const Plan = require("./Plan")(sequelize);
const Subscription = require("./Subscription")(sequelize);
const Booking = require("./Booking")(sequelize);
const Payment = require("./Payment")(sequelize);
const Payout = require("./Payout")(sequelize);
const KycDocument = require("./KycDocument")(sequelize);
const Conversation = require("./Conversation")(sequelize);
const Message = require("./Message")(sequelize);
const Block = require("./Block")(sequelize);
const Report = require("./Report")(sequelize);
const OtpCode = require("./OtpCode")(sequelize);
const Notification = require("./Notification")(sequelize);
const Setting = require("./Setting")(sequelize);
const AdminUser = require("./AdminUser")(sequelize);
const AuditLog = require("./AuditLog")(sequelize);
const RefreshToken = require("./RefreshToken")(sequelize);
const ServiceCategory = require("./ServiceCategory")(sequelize);
const CompanionService = require("./CompanionService")(sequelize);
const Availability = require("./Availability")(sequelize);
const Review = require("./Review")(sequelize);
const PayoutAccount = require("./PayoutAccount")(sequelize);
const SosAlert = require("./SosAlert")(sequelize);

/* ---- the account and the things that describe it ---- */

User.hasOne(Profile, { foreignKey: "userId", as: "profile", onDelete: "CASCADE" });
Profile.belongsTo(User, { foreignKey: "userId", as: "user" });

User.hasOne(Preference, { foreignKey: "userId", as: "preference", onDelete: "CASCADE" });
Preference.belongsTo(User, { foreignKey: "userId" });

User.hasMany(Photo, { foreignKey: "userId", as: "photos", onDelete: "CASCADE" });
Photo.belongsTo(User, { foreignKey: "userId", as: "owner" });

User.belongsToMany(Interest, {
  through: UserInterest,
  foreignKey: "userId",
  otherKey: "interestId",
  as: "interests",
});
Interest.belongsToMany(User, {
  through: UserInterest,
  foreignKey: "interestId",
  otherKey: "userId",
  as: "people",
});

/* ---- what a Companion charges ---- */

User.hasMany(CompanionRate, { foreignKey: "companionId", as: "rates", onDelete: "CASCADE" });
CompanionRate.belongsTo(User, { foreignKey: "companionId", as: "companion" });

/* ---- what a Companion offers, and when ---- */

User.belongsToMany(ServiceCategory, {
  through: CompanionService,
  foreignKey: "companionId",
  otherKey: "categoryId",
  as: "services",
});
ServiceCategory.belongsToMany(User, {
  through: CompanionService,
  foreignKey: "categoryId",
  otherKey: "companionId",
  as: "companions",
});

User.hasMany(Availability, { foreignKey: "companionId", as: "availability", onDelete: "CASCADE" });
Availability.belongsTo(User, { foreignKey: "companionId", as: "companion" });

User.hasOne(PayoutAccount, { foreignKey: "companionId", as: "payoutAccount", onDelete: "CASCADE" });
PayoutAccount.belongsTo(User, { foreignKey: "companionId", as: "companion" });

/* ---- membership ---- */

Plan.hasMany(Subscription, { foreignKey: "planId", as: "subscriptions" });
Subscription.belongsTo(Plan, { foreignKey: "planId", as: "plan" });

User.hasMany(Subscription, { foreignKey: "userId", as: "subscriptions", onDelete: "CASCADE" });
Subscription.belongsTo(User, { foreignKey: "userId", as: "member" });

/* ---- bookings ---- */

// Two sides of one booking, so each needs its own alias.
User.hasMany(Booking, { foreignKey: "customerId", as: "bookingsMade" });
User.hasMany(Booking, { foreignKey: "companionId", as: "bookingsReceived" });
Booking.belongsTo(User, { foreignKey: "customerId", as: "customer" });
Booking.belongsTo(User, { foreignKey: "companionId", as: "companion" });
Booking.belongsTo(ServiceCategory, { foreignKey: "serviceId", as: "service" });

/* ---- reviews, two-way, after a completed booking ---- */

Booking.hasMany(Review, { foreignKey: "bookingId", as: "reviews", onDelete: "CASCADE" });
Review.belongsTo(Booking, { foreignKey: "bookingId", as: "booking" });
Review.belongsTo(User, { foreignKey: "authorId", as: "author" });
Review.belongsTo(User, { foreignKey: "subjectId", as: "subject" });
User.hasMany(Review, { foreignKey: "subjectId", as: "reviewsReceived" });

/* ---- money ---- */

// Payments outlive accounts: the actor goes null, the record stays.
User.hasMany(Payment, { foreignKey: "userId", as: "payments", onDelete: "SET NULL" });
Payment.belongsTo(User, { foreignKey: "userId", as: "payer" });

Booking.hasMany(Payment, { foreignKey: "bookingId", as: "payments" });
Payment.belongsTo(Booking, { foreignKey: "bookingId", as: "booking" });

Subscription.hasOne(Payment, { foreignKey: "subscriptionId", as: "payment" });
Payment.belongsTo(Subscription, { foreignKey: "subscriptionId", as: "subscription" });

User.hasMany(Payout, { foreignKey: "companionId", as: "payouts", onDelete: "SET NULL" });
Payout.belongsTo(User, { foreignKey: "companionId", as: "companion" });

Booking.hasOne(Payout, { foreignKey: "bookingId", as: "payout" });
Payout.belongsTo(Booking, { foreignKey: "bookingId", as: "booking" });

/* ---- identity ---- */

User.hasMany(KycDocument, { foreignKey: "userId", as: "kycDocuments", onDelete: "CASCADE" });
KycDocument.belongsTo(User, { foreignKey: "userId", as: "owner" });

/* ---- chat, which exists only because a booking was paid for ---- */

Booking.hasOne(Conversation, { foreignKey: "bookingId", as: "conversation", onDelete: "CASCADE" });
Conversation.belongsTo(Booking, { foreignKey: "bookingId", as: "booking" });

Conversation.belongsTo(User, { foreignKey: "customerId", as: "customer" });
Conversation.belongsTo(User, { foreignKey: "companionId", as: "companion" });

Conversation.hasMany(Message, { foreignKey: "conversationId", as: "messages", onDelete: "CASCADE" });
Message.belongsTo(Conversation, { foreignKey: "conversationId", as: "conversation" });
Message.belongsTo(User, { foreignKey: "senderId", as: "sender" });

/* ---- safety ---- */

Block.belongsTo(User, { foreignKey: "blockerId", as: "blocker" });
Block.belongsTo(User, { foreignKey: "blockedId", as: "blocked" });

Report.belongsTo(User, { foreignKey: "reporterId", as: "reporter" });
Report.belongsTo(User, { foreignKey: "reportedId", as: "reported" });
Report.belongsTo(Booking, { foreignKey: "bookingId", as: "booking" });
Report.belongsTo(Message, { foreignKey: "messageId", as: "message" });

SosAlert.belongsTo(User, { foreignKey: "userId", as: "user" });
SosAlert.belongsTo(Booking, { foreignKey: "bookingId", as: "booking" });

/* ---- housekeeping ---- */

User.hasMany(OtpCode, { foreignKey: "userId", as: "otpCodes", onDelete: "CASCADE" });
OtpCode.belongsTo(User, { foreignKey: "userId" });

User.hasMany(Notification, { foreignKey: "userId", as: "notifications", onDelete: "CASCADE" });
Notification.belongsTo(User, { foreignKey: "userId" });

User.hasMany(RefreshToken, { foreignKey: "userId", as: "sessions", onDelete: "CASCADE" });
RefreshToken.belongsTo(User, { foreignKey: "userId" });
AdminUser.hasMany(RefreshToken, { foreignKey: "adminId", as: "sessions", onDelete: "CASCADE" });
RefreshToken.belongsTo(AdminUser, { foreignKey: "adminId" });

module.exports = {
  sequelize,
  User,
  Profile,
  Photo,
  Interest,
  UserInterest,
  Preference,
  CompanionRate,
  Plan,
  Subscription,
  Booking,
  Payment,
  Payout,
  KycDocument,
  Conversation,
  Message,
  Block,
  Report,
  OtpCode,
  Notification,
  Setting,
  AdminUser,
  AuditLog,
  RefreshToken,
  ServiceCategory,
  CompanionService,
  Availability,
  Review,
  PayoutAccount,
  SosAlert,
};
