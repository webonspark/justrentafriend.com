const { Op } = require("sequelize");
const {
  sequelize,
  User,
  Profile,
  Photo,
  Interest,
  UserInterest,
  ServiceCategory,
  CompanionService,
  CompanionRate,
  Availability,
  KycDocument,
  PayoutAccount,
  Review,
  Block,
} = require("../../models");
const settings = require("../../lib/settings");
const kyc = require("../../lib/kyc");
const { savePhoto, savePrivate, remove, publicUrl } = require("../../lib/uploads");
const { isHhMm, toMinutes } = require("../../lib/time");
const { badRequest, notFound, forbidden } = require("../../lib/errors");
const { notify } = require("../../lib/notify");
const presenter = require("./profile.presenter");

/**
 * A member's own profile, and a Companion's public one.
 *
 * A Companion goes live only when every one of these is true:
 *   - an admin has approved the profile        (approvalStatus "approved")
 *   - the account is active with a membership  (canTransact)
 * Submitting for approval requires a complete profile, an approved-or-
 * pending photo, a KYC document and a selfie.
 */

const MAX_PHOTOS = 6;

const FULL_INCLUDE = [
  { model: Profile, as: "profile" },
  { model: Photo, as: "photos" },
  { model: Interest, as: "interests", through: { attributes: [] } },
  { model: ServiceCategory, as: "services", through: { attributes: [] } },
  { model: CompanionRate, as: "rates", where: { isCurrent: true }, required: false },
  { model: Availability, as: "availability" },
];

async function load(userId) {
  const user = await User.findByPk(userId, { include: FULL_INCLUDE });
  if (!user) throw notFound("That account does not exist.");
  return user;
}

/** Everything the member's own profile editor needs. */
async function getMine(userId) {
  const user = await load(userId);
  const p = user.profile;
  const kycDocs = await KycDocument.findAll({ where: { userId }, order: [["createdAt", "DESC"]] });
  const payoutAccount =
    user.role === "companion" ? await PayoutAccount.findOne({ where: { companionId: userId } }) : null;

  return {
    user: user.toSafeJSON(),
    profile: {
      gender: p.gender,
      bio: p.bio,
      city: p.city,
      area: p.area,
      latitude: p.latitude === null ? null : Number(p.latitude),
      longitude: p.longitude === null ? null : Number(p.longitude),
      languages: presenter.languagesOf(p),
      occupation: p.occupation,
      verified: p.isVerified,
      selfieStatus: p.selfieStatus,
      approvalStatus: p.approvalStatus,
      approvalNote: p.approvalNote,
      onboardingComplete: p.onboardingComplete,
      rating: Number(p.ratingAvg),
      ratingCount: p.ratingCount,
      completedMeets: p.completedMeets,
    },
    photos: user.photos.sort((a, b) => a.position - b.position).map(presenter.photoJson),
    interestIds: user.interests.map((i) => i.id),
    serviceIds: user.services.map((s) => s.id),
    pricePerHourPaise: presenter.currentRate(user),
    availability: user.availability.map((a) => ({ weekday: a.weekday, startTime: a.startTime, endTime: a.endTime })),
    kyc: kycDocs.map((d) => ({
      id: d.id,
      docType: d.docType,
      numberMasked: d.numberMasked,
      status: d.status,
      rejectionReason: d.rejectionReason,
      createdAt: d.createdAt,
    })),
    payoutAccount: payoutAccount
      ? {
          method: payoutAccount.method,
          upiId: payoutAccount.upiId,
          accountName: payoutAccount.accountName,
          accountLast4: payoutAccount.accountLast4,
          ifsc: payoutAccount.ifsc,
        }
      : null,
    checklist: user.role === "companion" ? await checklist(user) : null,
  };
}

/** What a Companion still has to do before they can be submitted. */
async function checklist(user) {
  const p = user.profile;
  const kycDoc = await KycDocument.findOne({
    where: { userId: user.id, status: { [Op.in]: ["submitted", "approved"] } },
  });
  const usablePhotos = user.photos.filter((x) => x.moderationStatus !== "rejected");
  return {
    about: Boolean(p.bio && p.bio.length >= 30 && p.gender && p.area && p.languages),
    services: user.services.length > 0,
    rate: Boolean(presenter.currentRate(user)),
    availability: user.availability.length > 0,
    photo: usablePhotos.length > 0,
    kyc: Boolean(kycDoc),
    selfie: ["submitted", "approved"].includes(p.selfieStatus),
  };
}

async function updateMine(user, body) {
  const profile = await Profile.findOne({ where: { userId: user.id } });

  const fields = {};
  for (const key of ["gender", "bio", "city", "area", "occupation"]) {
    if (body[key] !== undefined) fields[key] = body[key] === "" ? null : String(body[key]).trim();
  }
  if (body.languages !== undefined) {
    const list = Array.isArray(body.languages) ? body.languages : String(body.languages).split(",");
    fields.languages = list.map((s) => String(s).trim()).filter(Boolean).slice(0, 8).join(", ") || null;
  }
  if (body.latitude !== undefined && body.longitude !== undefined) {
    const lat = Number(body.latitude);
    const lng = Number(body.longitude);
    if (body.latitude === null || body.longitude === null) {
      fields.latitude = null;
      fields.longitude = null;
    } else if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
      fields.latitude = lat;
      fields.longitude = lng;
    }
  }

  await sequelize.transaction(async (t) => {
    await profile.update(fields, { transaction: t });

    if (Array.isArray(body.interestIds)) {
      const ids = body.interestIds.map(Number).filter(Number.isInteger).slice(0, 10);
      await UserInterest.destroy({ where: { userId: user.id }, transaction: t });
      const found = await Interest.findAll({ where: { id: ids }, transaction: t });
      await UserInterest.bulkCreate(found.map((i) => ({ userId: user.id, interestId: i.id })), { transaction: t });
    }

    if (user.role === "companion" && Array.isArray(body.serviceIds)) {
      const ids = body.serviceIds.map(Number).filter(Number.isInteger);
      const found = await ServiceCategory.findAll({ where: { id: ids, isActive: true }, transaction: t });
      await CompanionService.destroy({ where: { companionId: user.id }, transaction: t });
      await CompanionService.bulkCreate(
        found.map((c) => ({ companionId: user.id, categoryId: c.id })),
        { transaction: t }
      );
    }

    if (user.role === "companion" && body.pricePerHourPaise !== undefined) {
      const price = Math.round(Number(body.pricePerHourPaise));
      const min = Number(await settings.get("min_price_per_hour_paise", 50000));
      const max = Number(await settings.get("max_price_per_hour_paise", 1000000));
      if (!Number.isFinite(price) || price < min || price > max) {
        throw badRequest(`Set an hourly rate between ₹${min / 100} and ₹${max / 100}.`);
      }
      const current = await CompanionRate.findOne({ where: { companionId: user.id, isCurrent: true }, transaction: t });
      if (!current || Number(current.pricePerHourPaise) !== price) {
        await CompanionRate.update({ isCurrent: false }, { where: { companionId: user.id }, transaction: t });
        await CompanionRate.create({ companionId: user.id, pricePerHourPaise: price, isCurrent: true }, { transaction: t });
      }
    }
  });

  const fresh = await load(user.id);
  const done = fresh.profile.bio && fresh.profile.gender && fresh.profile.area;
  if (done && !fresh.profile.onboardingComplete) await fresh.profile.update({ onboardingComplete: true });

  return getMine(user.id);
}

/** Replaces the weekly calendar. Windows must not overlap on a day. */
async function setAvailability(user, slots) {
  if (user.role !== "companion") throw forbidden("Only Companions keep a calendar.");
  if (!Array.isArray(slots) || slots.length > 42) throw badRequest("Send a list of time windows.");

  const clean = slots.map((s) => {
    const weekday = Number(s.weekday);
    if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) throw badRequest("Pick a day of the week.");
    if (!isHhMm(s.startTime) || !isHhMm(s.endTime)) throw badRequest("Times are HH:MM.");
    if (toMinutes(s.endTime) - toMinutes(s.startTime) < 30) {
      throw badRequest("Each window must be at least 30 minutes long and end after it starts.");
    }
    return { companionId: user.id, weekday, startTime: s.startTime, endTime: s.endTime };
  });

  for (let d = 0; d < 7; d += 1) {
    const day = clean.filter((s) => s.weekday === d).sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime));
    for (let i = 1; i < day.length; i += 1) {
      if (toMinutes(day[i].startTime) < toMinutes(day[i - 1].endTime)) {
        throw badRequest("Two windows on the same day overlap.");
      }
    }
  }

  await sequelize.transaction(async (t) => {
    await Availability.destroy({ where: { companionId: user.id }, transaction: t });
    await Availability.bulkCreate(clean, { transaction: t });
  });
  return getMine(user.id);
}

/* ------------------------------ photos ------------------------------ */

async function addPhoto(user, file) {
  if (!file) throw badRequest("Choose a photo to upload.");
  const count = await Photo.count({ where: { userId: user.id } });
  if (count >= MAX_PHOTOS) throw badRequest(`You can keep up to ${MAX_PHOTOS} photos.`);
  const saved = await savePhoto(file.buffer);
  await Photo.create({
    userId: user.id,
    path: saved.path,
    thumbPath: saved.thumbPath,
    position: count,
    isPrimary: count === 0,
    moderationStatus: "pending",
  });
  return getMine(user.id);
}

async function deletePhoto(user, photoId) {
  const photo = await Photo.findOne({ where: { id: photoId, userId: user.id } });
  if (!photo) throw notFound("That photo does not exist.");
  await photo.destroy();
  remove(photo.path);
  remove(photo.thumbPath);
  if (photo.isPrimary) {
    const next = await Photo.findOne({ where: { userId: user.id }, order: [["position", "ASC"]] });
    if (next) await next.update({ isPrimary: true });
  }
  return getMine(user.id);
}

async function setPrimaryPhoto(user, photoId) {
  const photo = await Photo.findOne({ where: { id: photoId, userId: user.id } });
  if (!photo) throw notFound("That photo does not exist.");
  await Photo.update({ isPrimary: false }, { where: { userId: user.id } });
  await photo.update({ isPrimary: true });
  return getMine(user.id);
}

/* ------------------------------ verification ------------------------------ */

async function submitKyc(user, { docType, number }, file) {
  if (user.role !== "companion") throw forbidden("Identity checks are for Companions.");
  if (!["aadhaar", "pan"].includes(docType)) throw badRequest("Choose Aadhaar or PAN.");
  if (!file) throw badRequest("Upload a photo of the document.");

  const check = await kyc.verifyDocument({ docType, number });
  if (!check.ok) throw badRequest(check.reason);

  const filePath = await savePrivate(file.buffer, "kyc");
  await KycDocument.create({ userId: user.id, docType, numberMasked: check.masked, filePath, status: "submitted" });
  await User.update({ kycStatus: "submitted" }, { where: { id: user.id } });
  return getMine(user.id);
}

async function submitSelfie(user, file) {
  if (user.role !== "companion") throw forbidden("The selfie check is for Companions.");
  if (!file) throw badRequest("Take or upload a selfie.");

  const primary = await Photo.findOne({ where: { userId: user.id, isPrimary: true } });
  if (!primary) throw badRequest("Add a profile photo first — the selfie is matched against it.");

  const selfiePath = await savePrivate(file.buffer, "selfies");
  const result = await kyc.matchSelfie({ selfiePath, photoPath: primary.path });
  const profile = await Profile.findOne({ where: { userId: user.id } });
  if (profile.selfiePath) remove(profile.selfiePath);
  await profile.update({ selfiePath, selfieMatchScore: result.score, selfieStatus: "submitted" });
  return getMine(user.id);
}

/** A Companion asks to go live. */
async function submitForApproval(user) {
  if (user.role !== "companion") throw forbidden("Only Companions are reviewed.");
  const fresh = await load(user.id);
  const list = await checklist(fresh);
  const missing = Object.entries(list).filter(([, ok]) => !ok).map(([k]) => k);
  if (missing.length) {
    throw badRequest("Finish your profile before submitting it.", missing.map((m) => ({ field: m, message: "Missing" })));
  }
  if (fresh.profile.approvalStatus === "approved") return getMine(user.id);
  await fresh.profile.update({ approvalStatus: "pending", approvalNote: null });
  await notify(user.id, {
    type: "profile_submitted",
    title: "Your profile is with our team",
    body: "We review new Companions within two working days.",
    link: "/profile",
  });
  return getMine(user.id);
}

async function savePayoutAccount(user, body) {
  if (user.role !== "companion") throw forbidden("Payouts are for Companions.");
  const method = body.method;
  const row = { companionId: user.id, method, upiId: null, accountName: null, accountLast4: null, ifsc: null };
  if (method === "upi") {
    if (!/^[\w.-]{2,}@[a-z]{2,}$/i.test(String(body.upiId || ""))) throw badRequest("Enter a valid UPI ID, like name@okbank.");
    row.upiId = String(body.upiId).trim();
  } else if (method === "bank") {
    const acc = String(body.accountNumber || "").replace(/\s+/g, "");
    if (!/^\d{9,18}$/.test(acc)) throw badRequest("Enter a valid account number.");
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(String(body.ifsc || "").toUpperCase())) throw badRequest("Enter a valid IFSC code.");
    if (!body.accountName) throw badRequest("Enter the name on the account.");
    row.accountName = String(body.accountName).trim();
    row.accountLast4 = acc.slice(-4);
    row.ifsc = String(body.ifsc).toUpperCase();
  } else {
    throw badRequest("Choose UPI or bank account.");
  }
  const existing = await PayoutAccount.findOne({ where: { companionId: user.id } });
  if (existing) await existing.update(row);
  else await PayoutAccount.create(row);
  return getMine(user.id);
}

/* ------------------------------ public ------------------------------ */

/** Whether either side has blocked the other. */
async function isBlocked(a, b) {
  if (!a || !b) return false;
  const row = await Block.findOne({
    where: {
      [Op.or]: [
        { blockerId: a, blockedId: b },
        { blockerId: b, blockedId: a },
      ],
    },
  });
  return Boolean(row);
}

/** A Companion's public page. Hidden unless they are live. */
async function getPublic(companionId, viewer) {
  const user = await User.findByPk(companionId, { include: FULL_INCLUDE });
  const live =
    user &&
    user.role === "companion" &&
    user.canTransact() &&
    user.profile?.approvalStatus === "approved";
  const isSelf = viewer && viewer.id === Number(companionId);
  if (!live && !isSelf) throw notFound("That profile is not available.");
  if (viewer && (await isBlocked(viewer.id, user.id))) throw notFound("That profile is not available.");

  const reviews = await Review.findAll({
    where: { subjectId: user.id, isHidden: false },
    include: [{ model: User, as: "author", attributes: ["fullName"] }],
    order: [["createdAt", "DESC"]],
    limit: 20,
  });

  const vp = viewer ? await Profile.findOne({ where: { userId: viewer.id } }) : null;
  const from = vp?.latitude != null ? { lat: Number(vp.latitude), lng: Number(vp.longitude) } : null;
  return presenter.full(user, { from, reviews });
}

/** The lists the editors and filters choose from. */
async function catalog() {
  const [services, interests] = await Promise.all([
    ServiceCategory.findAll({ where: { isActive: true }, order: [["sortOrder", "ASC"], ["name", "ASC"]] }),
    Interest.findAll({ order: [["name", "ASC"]] }),
  ]);
  return {
    services: services.map((s) => ({ id: s.id, name: s.name, slug: s.slug, description: s.description })),
    interests: interests.map((i) => ({ id: i.id, name: i.name })),
    areas: require("../../lib/areas").areasFor(require("../../config/env").brand.city),
    languages: ["English", "Hindi", "Kannada", "Tamil", "Telugu", "Malayalam", "Marathi", "Bengali", "Gujarati", "Urdu"],
    meetingPlaceTypes: MEETING_PLACE_TYPES,
  };
}

/** Public places only. Private homes and hotel rooms are never allowed. */
const MEETING_PLACE_TYPES = [
  { id: "cafe", name: "Café" },
  { id: "restaurant", name: "Restaurant" },
  { id: "mall", name: "Shopping mall" },
  { id: "park", name: "Park or garden" },
  { id: "museum", name: "Museum or gallery" },
  { id: "cinema", name: "Cinema or theatre" },
  { id: "event", name: "Public event or venue" },
  { id: "bookstore", name: "Bookstore or library" },
  { id: "sports", name: "Sports venue or gym" },
  { id: "landmark", name: "Public landmark" },
];

module.exports = {
  getMine,
  updateMine,
  setAvailability,
  addPhoto,
  deletePhoto,
  setPrimaryPhoto,
  submitKyc,
  submitSelfie,
  submitForApproval,
  savePayoutAccount,
  getPublic,
  catalog,
  isBlocked,
  load,
  FULL_INCLUDE,
  MEETING_PLACE_TYPES,
  publicUrl,
};
