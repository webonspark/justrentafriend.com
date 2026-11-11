const bcrypt = require("bcryptjs");
const env = require("../config/env");
const sequelize = require("../config/db");
const {
  User,
  Profile,
  Preference,
  Interest,
  UserInterest,
  CustomerRate,
  Plan,
  Setting,
  AdminUser,
  Booking,
} = require("../models");
const { splitCommission, bookingAmount } = require("../lib/money");
const { logger } = require("../lib/logger");

/**
 * Enough data to open every page and see something real.
 *
 * One Super Admin, ten Customers, ten Users and a few bookings, as the brief
 * asks. Everything is invented. Re-running is safe: rows are looked up
 * before they are created, so nothing doubles up.
 *
 * Every seeded password is "Password123" — fine locally, never anywhere else.
 */

const PASSWORD = "Password123";

/* Bengaluru, roughly: a spread of real neighbourhoods so distance search has
   something to sort once Phase 2 lands. */
const SPOTS = [
  ["Indiranagar", 12.9784, 77.6408],
  ["Koramangala", 12.9352, 77.6245],
  ["Jayanagar", 12.9308, 77.5838],
  ["Whitefield", 12.9698, 77.7500],
  ["HSR Layout", 12.9116, 77.6474],
  ["Malleshwaram", 13.0035, 77.5647],
  ["Hebbal", 13.0358, 77.5970],
  ["JP Nagar", 12.9063, 77.5857],
  ["Electronic City", 12.8452, 77.6602],
  ["Rajajinagar", 12.9916, 77.5551],
];

const INTERESTS = [
  ["Live music", "live-music"], ["Trekking", "trekking"], ["Films", "films"],
  ["Cafés", "cafes"], ["Food walks", "food-walks"], ["Art and galleries", "art"],
  ["Board games", "board-games"], ["Running", "running"], ["Photography", "photography"],
  ["Theatre", "theatre"], ["Cricket", "cricket"], ["Books", "books"],
  ["Stand-up", "stand-up"], ["Cycling", "cycling"], ["Yoga", "yoga"],
];

const CUSTOMERS = [
  ["Meera Iyer", "female", 27, 180000, "Weekend trekker, weekday architect. Happy to show you the quiet corners of the city."],
  ["Arjun Nair", "male", 31, 200000, "I know every filter coffee worth queuing for. Good company at a gig or a gallery."],
  ["Priya Raghavan", "female", 24, 150000, "Final-year design student. Ask me about the indie film scene here."],
  ["Rohan Mehta", "male", 29, 220000, "Marathon pacer and amateur cook. I talk a lot about both."],
  ["Ananya Rao", "female", 33, 250000, "Theatre producer. If there is a show on, I have an opinion about it."],
  ["Kabir Shetty", "male", 26, 160000, "Bookshop regular, board-game evangelist, reliably early."],
  ["Divya Pillai", "female", 30, 190000, "Photographer. I will take you somewhere with good light."],
  ["Nikhil Joshi", "male", 35, 240000, "Cyclist, cricket tragic, decent conversationalist on a long walk."],
  ["Sneha Kulkarni", "female", 28, 170000, "Yoga teacher by morning, food-walk guide by evening."],
  ["Vikram Desai", "male", 32, 210000, "Stand-up open-mic regular. Mostly I listen, though."],
];

const USERS = [
  ["Aditya Sharma", "male", 30], ["Neha Gupta", "female", 27], ["Farhan Qureshi", "male", 34],
  ["Ritika Arora", "female", 25], ["Sanjay Menon", "male", 38], ["Lakshmi Narayan", "female", 29],
  ["Imran Ali", "male", 31], ["Pooja Bhatt", "female", 26], ["Harish Kumar", "male", 41],
  ["Tanvi Shah", "female", 23],
];

const dobFor = (age) => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - age);
  d.setMonth((age * 7) % 12);
  d.setDate(((age * 13) % 27) + 1);
  return d.toISOString().slice(0, 10);
};

const emailFor = (name) => `${name.toLowerCase().replace(/[^a-z]+/g, ".")}@example.com`;

/** Deterministic, so re-seeding gives the same people the same numbers. */
const mobileFor = (i) => `+9198${String(45000000 + i * 13717).slice(0, 8)}`;

async function seedSettings() {
  const rows = [
    ["commission_pct", env.money.commissionPct, "Commission on every booking (%)", "money"],
    ["gst_pct", env.money.gstPct, "GST on membership (%)", "money"],
    ["gst_on_commission", false, "Charge GST on the commission too", "money"],
    ["min_price_per_hour_paise", env.money.minPricePerHour, "Lowest price a Customer may set", "money"],
    ["max_price_per_hour_paise", env.money.maxPricePerHour, "Highest price a Customer may set", "money"],
    ["cancellation_free_hours", 24, "Free cancellation up to this many hours before", "bookings"],
    ["cancellation_partial_pct", 50, "Refund when cancelling inside that window (%)", "bookings"],
    ["launch_city", env.brand.city, "The city this is open in", "general"],
    ["maintenance_mode", false, "Show the maintenance page to everyone", "general"],
  ];

  for (const [key, value, label, group] of rows) {
    await Setting.findOrCreate({ where: { key }, defaults: { key, value, label, group } });
  }
  logger.info(`${rows.length} settings ready.`);
}

async function seedPlans() {
  const plans = [
    ["Month", "month", 30, 49900, 0, "Try it for a month."],
    ["Quarter", "quarter", 90, 119900, 1, "Three months, better value."],
    ["Year", "year", 365, 349900, 2, "The cheapest way to stay listed."],
  ];

  for (const [name, slug, days, pricePaise, sortOrder, blurb] of plans) {
    await Plan.findOrCreate({
      where: { slug },
      defaults: { name, slug, days, pricePaise, gstPct: env.money.gstPct, sortOrder, blurb },
    });
  }
  logger.info(`${plans.length} membership plans ready.`);
}

async function seedInterests() {
  for (const [name, slug] of INTERESTS) {
    await Interest.findOrCreate({ where: { slug }, defaults: { name, slug } });
  }
  logger.info(`${INTERESTS.length} interests ready.`);
}

async function seedAdmin() {
  const email = "admin@kindred.example";
  const [admin, made] = await AdminUser.findOrCreate({
    where: { email },
    defaults: {
      name: "Super Admin",
      email,
      passwordHash: await bcrypt.hash(PASSWORD, env.auth.bcryptRounds),
      role: "super_admin",
    },
  });
  logger.info(made ? `Super Admin created: ${email}` : "Super Admin already there.");
  return admin;
}

async function seedPerson({ name, role, gender, age, pricePaise, bio, index }) {
  const email = emailFor(name);
  const existing = await User.findOne({ where: { email } });
  if (existing) return existing;

  const [place, lat, lng] = SPOTS[index % SPOTS.length];
  const expires = new Date();
  expires.setDate(expires.getDate() + 60);

  const user = await User.create({
    role,
    fullName: name,
    email,
    mobile: mobileFor(index + (role === "customer" ? 0 : 50)),
    passwordHash: await bcrypt.hash(PASSWORD, env.auth.bcryptRounds),
    dateOfBirth: dobFor(age),
    emailVerified: true,
    mobileVerified: true,
    status: "active",
    membershipStatus: "active",
    membershipExpiresAt: expires,
    kycStatus: role === "customer" ? "approved" : "none",
    consentAcceptedAt: new Date(),
    consentVersion: "1.0",
  });

  await Profile.create({
    userId: user.id,
    gender,
    bio: bio || null,
    city: env.brand.city,
    state: "Karnataka",
    latitude: lat,
    longitude: lng,
    occupation: place,
    isVerified: role === "customer",
    onboardingComplete: true,
    ratingAvg: role === "customer" ? 4 + ((index % 10) / 10) : 0,
    ratingCount: role === "customer" ? 3 + index : 0,
  });

  await Preference.create({ userId: user.id });

  if (role === "customer") {
    await CustomerRate.create({
      customerId: user.id,
      pricePerHourPaise: pricePaise,
      isCurrent: true,
    });
  }

  // Three interests each, spread so no two people match exactly.
  const picked = [0, 1, 2].map((n) => INTERESTS[(index * 3 + n) % INTERESTS.length][1]);
  const rows = await Interest.findAll({ where: { slug: picked } });
  await UserInterest.bulkCreate(rows.map((r) => ({ userId: user.id, interestId: r.id })));

  return user;
}

async function seedBookings(customers, users) {
  if (await Booking.count()) {
    logger.info("Bookings already there.");
    return;
  }

  const pct = env.money.commissionPct;
  const plan = [
    { c: 0, u: 0, hours: 2, status: "completed", daysAgo: 9 },
    { c: 1, u: 1, hours: 1, status: "completed", daysAgo: 5 },
    { c: 2, u: 2, hours: 3, status: "paid", daysAgo: -2 },
    { c: 4, u: 3, hours: 1.5, status: "paid", daysAgo: -4 },
    { c: 3, u: 4, hours: 2, status: "cancelled", daysAgo: 2 },
    { c: 6, u: 5, hours: 1, status: "pending", daysAgo: -6 },
  ];

  for (const row of plan) {
    const customer = customers[row.c];
    const user = users[row.u];
    const rate = await CustomerRate.findOne({
      where: { customerId: customer.id, isCurrent: true },
    });

    const amount = bookingAmount(rate.pricePerHourPaise, row.hours);
    const split = splitCommission(amount, pct);

    const startAt = new Date();
    startAt.setDate(startAt.getDate() - row.daysAgo);
    startAt.setHours(18, 30, 0, 0);

    const done = row.status === "completed" ? new Date(startAt.getTime() + 36e5) : null;

    await Booking.create({
      userId: user.id,
      customerId: customer.id,
      hours: row.hours,
      startAt,
      pricePerHourPaise: rate.pricePerHourPaise,
      amountPaise: split.amountPaise,
      commissionPct: pct,
      commissionPaise: split.commissionPaise,
      payoutPaise: split.payoutPaise,
      status: row.status,
      userCompletedAt: done,
      customerCompletedAt: done,
      cancelledAt: row.status === "cancelled" ? new Date() : null,
      cancelledById: row.status === "cancelled" ? user.id : null,
      cancelReason: row.status === "cancelled" ? "Could not make it." : null,
    });
  }

  logger.info(`${plan.length} sample bookings created.`);
}

(async () => {
  try {
    await sequelize.authenticate();
    await sequelize.sync();

    await seedSettings();
    await seedPlans();
    await seedInterests();
    await seedAdmin();

    const customers = [];
    for (let i = 0; i < CUSTOMERS.length; i += 1) {
      const [name, gender, age, pricePaise, bio] = CUSTOMERS[i];
      customers.push(
        await seedPerson({ name, role: "customer", gender, age, pricePaise, bio, index: i })
      );
    }
    logger.info(`${customers.length} Customers ready.`);

    const users = [];
    for (let i = 0; i < USERS.length; i += 1) {
      const [name, gender, age] = USERS[i];
      users.push(await seedPerson({ name, role: "user", gender, age, index: i }));
    }
    logger.info(`${users.length} Users ready.`);

    await seedBookings(customers, users);

    logger.info(
      `\nDone. Sign in with any of these — the password is "${PASSWORD}".\n` +
        `  Admin     admin@kindred.example   (at /admin)\n` +
        `  Customer  ${emailFor(CUSTOMERS[0][0])}\n` +
        `  User      ${emailFor(USERS[0][0])}\n`
    );
    process.exit(0);
  } catch (err) {
    logger.error(`Seeding failed: ${err.message}\n${err.stack}`);
    process.exit(1);
  }
})();
