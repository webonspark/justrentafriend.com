const bcrypt = require("bcryptjs");
const env = require("../config/env");
const sequelize = require("../config/db");
const {
  User,
  Profile,
  Preference,
  Interest,
  UserInterest,
  CompanionRate,
  Plan,
  Setting,
  AdminUser,
  Booking,
  ServiceCategory,
  CompanionService,
  Availability,
  PayoutAccount,
  Payment,
  Payout,
  Conversation,
  Message,
  Review,
  Photo,
  KycDocument,
  Subscription,
  Report,
  Block,
  SosAlert,
  Notification,
  AuditLog,
} = require("../models");
const crypto = require("crypto");
const sharp = require("sharp");
const { savePhoto, savePrivate } = require("../lib/uploads");
const { splitCommission, bookingAmount } = require("../lib/money");
const { logger } = require("../lib/logger");
const settings = require("../lib/settings");

/**
 * Enough data to open every page and see something real.
 *
 * One Super Admin, ten Companions, ten Customers and a few bookings, as the brief
 * asks. Everything is invented. Re-running is safe: rows are looked up
 * before they are created, so nothing doubles up.
 *
 * Every seeded password is "Password123" — fine locally, never anywhere else.
 *
 *   npm run db:seed                  everything, sample members included
 *   npm run db:seed -- --base        settings, plans, categories, admin only
 *   ADMIN_EMAIL=… ADMIN_PASSWORD=… npm run db:seed -- --base   your own admin
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

const SERVICES = [
  ["Coffee & conversation", "Unhurried chat over coffee or chai."],
  ["City walk", "Explore a neighbourhood on foot with a local."],
  ["Food trail", "Street food, darshinis and hidden eateries."],
  ["Event plus-one", "Company for a wedding, party or work event."],
  ["Movie or theatre", "A film, play or show together."],
  ["Shopping companion", "A second opinion at the mall or market."],
  ["Museum & gallery visit", "Art, history and a good discussion."],
  ["Fitness buddy", "A run, a game of badminton or a gym session."],
  ["Language practice", "Practise Kannada, Hindi or English in conversation."],
  ["Gaming & board games", "Board-game cafés and arcades."],
];

const COMPANIONS = [
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

const CUSTOMERS = [
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
  const added = await settings.ensureDefaults();
  logger.info(`Settings ready (${added.length} added).`);
  await require("../lib/placesDefault").ensureDefaultPlaces(env.brand.city);
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

async function seedServices() {
  for (const [i, [name, description]] of SERVICES.entries()) {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    await ServiceCategory.findOrCreate({ where: { slug }, defaults: { name, slug, description, sortOrder: i } });
  }
  logger.info(`${SERVICES.length} service categories ready.`);
}

async function seedInterests() {
  for (const [name, slug] of INTERESTS) {
    await Interest.findOrCreate({ where: { slug }, defaults: { name, slug } });
  }
  logger.info(`${INTERESTS.length} interests ready.`);
}

/**
 * The first staff account.
 *
 * ADMIN_EMAIL / ADMIN_PASSWORD (passed on the command line, never stored)
 * create a real super admin; without them the sample admin is used, which
 * is only for local testing.
 */
async function seedAdmin() {
  const email = (process.env.ADMIN_EMAIL || "admin@kindred.example").trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || PASSWORD;
  const [admin, made] = await AdminUser.findOrCreate({
    where: { email },
    defaults: {
      name: process.env.ADMIN_NAME || "Super Admin",
      email,
      passwordHash: await bcrypt.hash(password, env.auth.bcryptRounds),
      role: "super_admin",
    },
  });
  logger.info(made ? `Super Admin created: ${email}` : `Super Admin already there: ${email}`);
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
    mobile: mobileFor(index + (role === "companion" ? 0 : 50)),
    passwordHash: await bcrypt.hash(PASSWORD, env.auth.bcryptRounds),
    dateOfBirth: dobFor(age),
    emailVerified: true,
    mobileVerified: true,
    status: "active",
    membershipStatus: "active",
    membershipExpiresAt: expires,
    kycStatus: role === "companion" ? "approved" : "none",
    consentAcceptedAt: new Date(),
    consentVersion: "1.0",
  });

  await Profile.create({
    userId: user.id,
    gender,
    bio: bio || null,
    city: env.brand.city,
    area: place,
    state: "Karnataka",
    latitude: lat,
    longitude: lng,
    languages: ["English, Kannada", "English, Hindi", "English, Tamil", "English, Hindi, Kannada"][index % 4],
    isVerified: role === "companion",
    selfieStatus: role === "companion" ? "approved" : "none",
    approvalStatus: "approved",
    approvedAt: new Date(),
    emergencyContactName: "Family contact",
    emergencyContactPhone: `+9190000${String(10000 + index).slice(-5)}`,
    onboardingComplete: true,
    ratingAvg: role === "companion" ? 4 + ((index % 10) / 10) : 0,
    ratingCount: role === "companion" ? 3 + index : 0,
  });

  await Preference.create({ userId: user.id });

  if (role === "companion") {
    await CompanionRate.create({
      companionId: user.id,
      pricePerHourPaise: pricePaise,
      isCurrent: true,
    });

    // Three services each, and a weekly calendar: two evenings and the weekend.
    const services = await ServiceCategory.findAll({ order: [["sortOrder", "ASC"]] });
    const picks = [0, 1, 2].map((n) => services[(index * 2 + n) % services.length]);
    await CompanionService.bulkCreate(picks.map((c) => ({ companionId: user.id, categoryId: c.id })));
    const evenings = [[1 + (index % 3), "17:00", "22:00"], [4 + (index % 2), "17:00", "22:00"]];
    const weekend = [[6, "10:00", "20:00"], [0, "10:00", "18:00"]];
    await Availability.bulkCreate(
      [...evenings, ...weekend].map(([weekday, startTime, endTime]) => ({ companionId: user.id, weekday, startTime, endTime }))
    );
    await PayoutAccount.create({ companionId: user.id, method: "upi", upiId: `${emailFor(name).split("@")[0].replace(/\./g, "")}@okaxis` });
  }

  // Three interests each, spread so no two people match exactly.
  const picked = [0, 1, 2].map((n) => INTERESTS[(index * 3 + n) % INTERESTS.length][1]);
  const rows = await Interest.findAll({ where: { slug: picked } });
  await UserInterest.bulkCreate(rows.map((r) => ({ userId: user.id, interestId: r.id })));

  return user;
}

async function seedBookings(companions, users) {
  if (await Booking.count()) {
    logger.info("Bookings already there.");
    return;
  }

  const pct = env.money.commissionPct;
  const plan = [
    { c: 0, u: 0, hours: 2, status: "completed", daysAgo: 9, place: ["Third Wave Coffee, Indiranagar", "cafe"] },
    { c: 1, u: 1, hours: 1, status: "completed", daysAgo: 5, place: ["Cubbon Park", "park"] },
    { c: 2, u: 0, hours: 3, status: "confirmed", daysAgo: -2, place: ["National Gallery of Modern Art", "museum"] },
    { c: 4, u: 3, hours: 1.5, status: "confirmed", daysAgo: -4, place: ["Ranga Shankara", "cinema"] },
    { c: 3, u: 4, hours: 2, status: "cancelled", daysAgo: 2, place: ["Phoenix Marketcity", "mall"] },
    { c: 0, u: 5, hours: 1, status: "pending", daysAgo: -6, place: ["Blossom Book House", "bookstore"] },
    { c: 5, u: 0, hours: 2, status: "accepted", daysAgo: -3, place: ["Toit, Indiranagar", "restaurant"] },
  ];

  for (const row of plan) {
    const companion = companions[row.c];
    const user = users[row.u];
    const rate = await CompanionRate.findOne({ where: { companionId: companion.id, isCurrent: true } });
    const service = await CompanionService.findOne({ where: { companionId: companion.id } });

    const amount = bookingAmount(rate.pricePerHourPaise, row.hours);
    const split = splitCommission(amount, pct);

    const startAt = new Date();
    startAt.setDate(startAt.getDate() - row.daysAgo);
    startAt.setHours(18, 30, 0, 0);
    const endAt = new Date(startAt.getTime() + row.hours * 3600e3);

    const paid = ["confirmed", "completed"].includes(row.status);
    const done = row.status === "completed" ? new Date(endAt.getTime() + 600e3) : null;

    const booking = await Booking.create({
      customerId: user.id,
      companionId: companion.id,
      serviceId: service.categoryId,
      hours: row.hours,
      startAt,
      endAt,
      meetingPlaceName: row.place[0],
      meetingPlaceType: row.place[1],
      pricePerHourPaise: rate.pricePerHourPaise,
      amountPaise: split.amountPaise,
      commissionPct: pct,
      commissionPaise: split.commissionPaise,
      payoutPaise: split.payoutPaise,
      status: row.status,
      respondedAt: row.status === "pending" ? null : new Date(),
      paidAt: paid ? new Date() : null,
      customerCheckInAt: done ? startAt : null,
      companionCheckInAt: done ? startAt : null,
      customerCompletedAt: done,
      companionCompletedAt: done,
      completedAt: done,
      payoutReleasedAt: done,
      cancelledAt: row.status === "cancelled" ? new Date() : null,
      cancelledById: row.status === "cancelled" ? user.id : null,
      cancelReason: row.status === "cancelled" ? "Could not make it." : null,
    });

    if (paid) {
      const payment = await Payment.create({
        userId: user.id,
        purpose: "booking",
        bookingId: booking.id,
        gateway: "mock",
        gatewayOrderId: `mock_order_seed${booking.id}`,
        gatewayPaymentId: `mock_pay_seed${booking.id}`,
        amountPaise: split.amountPaise,
        gstPaise: 0,
        totalPaise: split.amountPaise,
        status: "paid",
        paidAt: new Date(),
      });
      await payment.update({ invoiceNo: `INV-${new Date().getFullYear()}-${String(payment.id).padStart(6, "0")}` });
      const convo = await Conversation.create({ bookingId: booking.id, customerId: user.id, companionId: companion.id, isClosed: Boolean(done), lastMessageAt: new Date() });
      await Message.bulkCreate([
        { conversationId: convo.id, senderId: user.id, body: "Hi! Looking forward to it. I'll be at the entrance.", deliveredAt: new Date() },
        { conversationId: convo.id, senderId: companion.id, body: "Great, see you there. I'll be wearing a blue jacket.", deliveredAt: new Date() },
      ]);
    }

    if (done) {
      await Payout.create({ companionId: companion.id, bookingId: booking.id, amountPaise: split.payoutPaise, status: "paid", bankReference: `mock_payout_seed${booking.id}`, paidAt: done });
      await Review.bulkCreate([
        { bookingId: booking.id, authorId: user.id, subjectId: companion.id, rating: 5, comment: "Punctual, friendly and knew the area really well." },
        { bookingId: booking.id, authorId: companion.id, subjectId: user.id, rating: 5, comment: "Lovely conversation, very respectful." },
      ]);
      await Profile.increment("completedMeets", { by: 1, where: { userId: companion.id } });
    }
  }

  logger.info(`${plan.length} sample bookings created.`);
}


/* ------------------------------------------------------------------ */
/* Everything else, so every screen and every admin queue has content. */
/* ------------------------------------------------------------------ */

/** A portrait-style placeholder: a soft gradient with the person's initials. */
async function portrait(name, hueSeed) {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) % 360;
  const h = (hash + hueSeed) % 360;
  const initials = name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="900">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="hsl(${h},45%,42%)"/><stop offset="1" stop-color="hsl(${(h + 50) % 360},55%,22%)"/>
    </linearGradient></defs>
    <rect width="900" height="900" fill="url(#g)"/>
    <circle cx="450" cy="360" r="150" fill="rgba(255,255,255,0.18)"/>
    <ellipse cx="450" cy="800" rx="290" ry="230" fill="rgba(255,255,255,0.18)"/>
    <text x="450" y="405" font-family="sans-serif" font-size="130" font-weight="700" fill="#fff" text-anchor="middle">${initials}</text>
  </svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 85 }).toBuffer();
}

/** A clearly fake ID card image for the KYC review screen. */
async function fakeId(name, docType, last4) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="630">
    <rect width="1000" height="630" rx="30" fill="#f4f1ea"/>
    <rect width="1000" height="110" rx="30" fill="#1f3c88"/>
    <text x="40" y="70" font-family="sans-serif" font-size="40" font-weight="700" fill="#fff">${docType === "pan" ? "INCOME TAX DEPARTMENT — PAN" : "AADHAAR"} (SAMPLE)</text>
    <rect x="40" y="160" width="220" height="270" fill="#c9c3b6"/>
    <text x="300" y="220" font-family="sans-serif" font-size="38" fill="#222">${name}</text>
    <text x="300" y="290" font-family="monospace" font-size="40" fill="#222">XXXX XXXX ${last4}</text>
    <text x="40" y="560" font-family="sans-serif" font-size="30" fill="#b00">SAMPLE DOCUMENT — NOT A REAL ID</text>
  </svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 85 }).toBuffer();
}

async function addPhoto(user, i, status = "approved") {
  const saved = await savePhoto(await portrait(user.fullName, i * 17));
  return Photo.create({ userId: user.id, path: saved.path, thumbPath: saved.thumbPath, position: 0, isPrimary: true, moderationStatus: status, moderatedAt: status === "approved" ? new Date() : null });
}

async function addKyc(user, i, status = "approved") {
  const docType = i % 2 ? "pan" : "aadhaar";
  const last4 = String(1000 + ((i * 377) % 9000)).slice(-4);
  const filePath = await savePrivate(await fakeId(user.fullName, docType, last4), "kyc");
  const selfiePath = await savePrivate(await portrait(user.fullName, i * 17 + 5), "selfies");
  await KycDocument.create({ userId: user.id, docType, numberMasked: `••••${last4}`, filePath, status, reviewedAt: status === "approved" ? new Date() : null });
  await Profile.update({ selfiePath, selfieMatchScore: 88 + (i % 10), selfieStatus: status === "approved" ? "approved" : "submitted" }, { where: { userId: user.id } });
}

/** A paid membership with its payment and invoice. */
async function addMembership(user, plan, daysAgo) {
  const start = new Date(Date.now() - daysAgo * 864e5);
  const end = new Date(start.getTime() + plan.days * 864e5);
  const gst = Math.round((Number(plan.pricePaise) * Number(plan.gstPct)) / 100);
  const total = Number(plan.pricePaise) + gst;
  const sub = await Subscription.create({ userId: user.id, planId: plan.id, startsAt: start, endsAt: end, status: "active", amountPaise: plan.pricePaise, gstPaise: gst, totalPaise: total });
  const pay = await Payment.create({
    userId: user.id, purpose: "membership", subscriptionId: sub.id, gateway: "mock",
    gatewayOrderId: `mock_order_mem${user.id}`, gatewayPaymentId: `mock_pay_mem${user.id}`,
    amountPaise: plan.pricePaise, gstPaise: gst, totalPaise: total, status: "paid", paidAt: start,
  });
  const invoiceNo = `INV-${start.getFullYear()}-${String(pay.id).padStart(6, "0")}`;
  await pay.update({ invoiceNo, createdAt: start });
  await sub.update({ paymentId: pay.id, invoiceNo });
  await user.update({ membershipStatus: "active", membershipExpiresAt: end });
}

async function seedExtras(companions, users) {
  if (await Photo.count()) {
    logger.info("Extra sample data already there.");
    return;
  }
  const plans = await Plan.findAll({ order: [["sortOrder", "ASC"]] });

  // Photos, KYC + selfie for every Companion; photos for half the Customers.
  for (const [i, c] of companions.entries()) {
    await addPhoto(c, i);
    await addKyc(c, i);
  }
  for (const [i, u] of users.entries()) if (i % 2 === 0) await addPhoto(u, i + 20);

  // Memberships with invoices for everyone.
  for (const [i, m] of [...companions, ...users].entries()) await addMembership(m, plans[i % plans.length], 5 + (i % 20));

  // A Companion waiting in every admin queue: approval, KYC, selfie, photo.
  const kavya = await seedPerson({ name: "Kavya Menon", role: "companion", gender: "female", age: 26, pricePaise: 160000, bio: "Classical dancer and chai enthusiast. I love showing people around Malleshwaram's old markets.", index: 10 });
  await Profile.update({ approvalStatus: "pending", isVerified: false, selfieStatus: "submitted", approvedAt: null }, { where: { userId: kavya.id } });
  await kavya.update({ kycStatus: "submitted" });
  await addPhoto(kavya, 10, "pending");
  await addKyc(kavya, 10, "submitted");
  await addMembership(kavya, plans[0], 1);

  // A customer photo waiting for moderation too.
  await addPhoto(users[1], 41, "pending").then((p) => p.update({ isPrimary: false, position: 1 }));

  // More booking outcomes: rejected, expired, disputed.
  const pct = env.money.commissionPct;
  const make = async ({ c, u, status, daysAgo, hours = 1, place, extra = {} }) => {
    const rate = await CompanionRate.findOne({ where: { companionId: companions[c].id, isCurrent: true } });
    const svc = await CompanionService.findOne({ where: { companionId: companions[c].id } });
    const split = splitCommission(bookingAmount(rate.pricePerHourPaise, hours), pct);
    const startAt = new Date(Date.now() - daysAgo * 864e5);
    startAt.setHours(17, 0, 0, 0);
    return Booking.create({
      customerId: users[u].id, companionId: companions[c].id, serviceId: svc.categoryId, hours, startAt,
      endAt: new Date(startAt.getTime() + hours * 3600e3), meetingPlaceName: place[0], meetingPlaceType: place[1],
      pricePerHourPaise: rate.pricePerHourPaise, amountPaise: split.amountPaise, commissionPct: pct,
      commissionPaise: split.commissionPaise, payoutPaise: split.payoutPaise, status, ...extra,
    });
  };
  await make({ c: 7, u: 6, status: "rejected", daysAgo: -5, place: ["Cubbon Park", "park"], extra: { respondedAt: new Date(), rejectReason: "Away that weekend, sorry!" } });
  await make({ c: 8, u: 7, status: "expired", daysAgo: 3, place: ["Lalbagh Glass House", "park"] });
  const disputed = await make({
    c: 9, u: 2, status: "disputed", daysAgo: 1, hours: 2, place: ["Forum Mall, Koramangala", "mall"],
    extra: { respondedAt: new Date(), paidAt: new Date(), disputeReason: "The Companion arrived 50 minutes late and left early.", customerCheckInAt: new Date() },
  });
  disputed.disputedById = users[2].id;
  await disputed.save();
  await Payment.create({ userId: users[2].id, purpose: "booking", bookingId: disputed.id, gateway: "mock", gatewayOrderId: `mock_order_d${disputed.id}`, gatewayPaymentId: `mock_pay_d${disputed.id}`, amountPaise: disputed.amountPaise, gstPaise: 0, totalPaise: disputed.amountPaise, status: "paid", paidAt: new Date(), invoiceNo: `INV-${new Date().getFullYear()}-D${disputed.id}` });
  await Payout.create({ companionId: companions[9].id, bookingId: disputed.id, amountPaise: disputed.payoutPaise, status: "on_hold", note: "Disputed" });
  const dConvo = await Conversation.create({ bookingId: disputed.id, customerId: users[2].id, companionId: companions[9].id, lastMessageAt: new Date() });

  // Chat moderation: one masked message, one that breaks the platonic policy.
  const flagged = await Message.create({ conversationId: dConvo.id, senderId: companions[9].id, body: "Running late. WhatsApp me on 98450 11223 instead", bodyFiltered: "Running late. WhatsApp me on [hidden] instead", wasFiltered: true, flagReason: "contact_details", deliveredAt: new Date() });
  await Message.create({ conversationId: dConvo.id, senderId: companions[9].id, body: "We could skip the mall and go to a hotel room instead", flagged: true, flagReason: "platonic_policy", deliveredAt: new Date() });

  // Reports: one urgent (linked to the message), one ordinary.
  await Report.create({ reporterId: users[2].id, reportedId: companions[9].id, bookingId: disputed.id, messageId: flagged.id, reason: "harassment", details: "Suggested meeting in a hotel room and kept asking to move to WhatsApp.", priority: "urgent" });
  await Report.create({ reporterId: users[7].id, reportedId: companions[8].id, reason: "no_show", details: "Did not reply and did not turn up.", priority: "normal" });

  // A block, and an SOS that is still active (shows on the admin dashboard).
  await Block.create({ blockerId: users[2].id, blockedId: companions[9].id, reason: "harassment" });
  await SosAlert.create({ userId: users[3].id, bookingId: null, shareToken: crypto.randomBytes(24).toString("hex"), latitude: 12.9716, longitude: 77.5946, accuracyM: 25, locationAt: new Date() });
  await SosAlert.create({ userId: users[1].id, shareToken: crypto.randomBytes(24).toString("hex"), latitude: 12.9352, longitude: 77.6245, status: "resolved", resolvedAt: new Date(), resolvedNote: "Called the member — false alarm, safe." });

  // Notifications for the two accounts most people will try first.
  const note = (u, type, title, body, link, read) => Notification.create({ userId: u.id, type, title, body, link, readAt: read ? new Date() : null });
  const [meera] = companions;
  const [aditya] = users;
  await note(meera, "booking_request", "New booking request from Lakshmi", "1 h at Blossom Book House. Accept or reject within 24 hours.", "/bookings?tab=requests", false);
  await note(meera, "payout_sent", "Payout sent", "For your completed meet. It is on its way to your UPI ID.", "/earnings", false);
  await note(meera, "review_received", "You received a 5-star review", null, "/bookings?tab=past", true);
  await note(aditya, "booking_accepted", "Kabir accepted your booking", "Pay within 12 hours to confirm it.", "/bookings?tab=requests", false);
  await note(aditya, "booking_confirmed", "Booking confirmed", "Chat is open. See you at the National Gallery of Modern Art.", "/bookings?tab=upcoming", false);
  await note(aditya, "membership_active", "Your membership is active", "Thanks for joining.", "/payments-history", true);

  // A few audit log lines so the admin audit screen is not empty.
  for (const [action, entityType, detail] of [
    ["companion.approve", "user", "Approved after KYC and selfie"],
    ["kyc.approve", "kyc_document", null],
    ["photo.approve", "photo", null],
    ["setting.update", "setting", "commission_pct = 18"],
  ]) {
    await AuditLog.create({ actorType: "admin", actorId: 1, actorName: "Super Admin", action, entityType, detail, ip: "127.0.0.1" });
  }

  logger.info("Photos, KYC, memberships, an approval queue, disputes, reports, SOS and notifications ready.");
}

/* Sample accounts all share one known password, so a live database must
   never get them by accident. In production: --base only, and only with a
   real ADMIN_PASSWORD. --allow-sample-data overrides (a staging copy). */
function refuseInProduction() {
  if (env.nodeEnv !== "production" || process.argv.includes("--allow-sample-data")) return;
  if (!process.argv.includes("--base")) {
    console.error(
      "Refusing to add sample members to a production database — every one of them has the password \"Password123\".\n" +
        "Use:  ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='a strong one' npm run db:seed -- --base\n" +
        "(or add --allow-sample-data if this really is a throwaway test database)."
    );
    process.exit(1);
  }
  if (!process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD === PASSWORD || process.env.ADMIN_PASSWORD.length < 10) {
    console.error("In production, set ADMIN_EMAIL and a strong ADMIN_PASSWORD (10+ characters) for the first admin.");
    process.exit(1);
  }
}

(async () => {
  try {
    refuseInProduction();
    await sequelize.authenticate();
    await sequelize.sync();

    await seedSettings();
    await seedPlans();
    await seedInterests();
    await seedServices();
    await seedAdmin();

    /* --base: only what the app needs to run (settings, plans, interests,
       service categories, the admin). No sample members or bookings. */
    if (process.argv.includes("--base")) {
      logger.info("Base data ready. No sample members were created (--base).");
      process.exit(0);
    }

    const companions = [];
    for (let i = 0; i < COMPANIONS.length; i += 1) {
      const [name, gender, age, pricePaise, bio] = COMPANIONS[i];
      companions.push(
        await seedPerson({ name, role: "companion", gender, age, pricePaise, bio, index: i })
      );
    }
    logger.info(`${companions.length} Companions ready.`);

    const users = [];
    for (let i = 0; i < CUSTOMERS.length; i += 1) {
      const [name, gender, age] = CUSTOMERS[i];
      users.push(await seedPerson({ name, role: "customer", gender, age, index: i }));
    }
    logger.info(`${users.length} Customers ready.`);

    await seedBookings(companions, users);
    await seedExtras(companions, users);

    logger.info(
      `\nDone. Sign in with any of these — the password is "${PASSWORD}".\n` +
        `  Admin     admin@kindred.example   (at /admin)\n` +
        `  Companion ${emailFor(COMPANIONS[0][0])}\n` +
        `  Customer  ${emailFor(CUSTOMERS[0][0])}\n`
    );
    process.exit(0);
  } catch (err) {
    logger.error(`Seeding failed: ${err.message}\n${err.stack}`);
    process.exit(1);
  }
})();
