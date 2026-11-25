const { Op } = require("sequelize");
const { User, Profile, Photo, ServiceCategory, CompanionRate, Availability, Block, Interest } = require("../../models");
const presenter = require("../profiles/profile.presenter");
const { weekdayOf } = require("../../lib/time");

/**
 * Search and discovery.
 *
 * Only live Companions are ever returned: approved by an admin, account
 * active, membership paid, and not blocked by (or blocking) the viewer.
 *
 * Filters: city, area, distance from a point, service, price range, gender,
 * age range, language, minimum rating, a date they are available, verified
 * only, and a name search. Sort: rating, price (either way), distance, newest.
 *
 * The cheap filters run in SQL; distance, age, price and availability are
 * worked out per row, which is fine for a one-city launch and keeps the
 * logic identical on MySQL and SQLite. When the catalogue grows, distance
 * moves into SQL with ST_Distance_Sphere and a spatial index.
 */
async function search(viewer, q) {
  const profileWhere = { approvalStatus: "approved" };
  if (q.city) profileWhere.city = q.city;
  if (q.area) profileWhere.area = { [Op.like]: `%${String(q.area).trim()}%` };
  if (q.gender && ["female", "male", "other"].includes(q.gender)) profileWhere.gender = q.gender;
  if (q.verified === "1" || q.verified === "true") profileWhere.isVerified = true;

  const userWhere = {
    role: "companion",
    status: "active",
    membershipStatus: "active",
    membershipExpiresAt: { [Op.gt]: new Date() },
  };
  if (q.q) userWhere.fullName = { [Op.like]: `%${String(q.q).trim()}%` };

  if (viewer) {
    const blocks = await Block.findAll({
      where: { [Op.or]: [{ blockerId: viewer.id }, { blockedId: viewer.id }] },
    });
    const hidden = blocks.map((b) => (b.blockerId === viewer.id ? b.blockedId : b.blockerId));
    userWhere.id = { [Op.notIn]: [viewer.id, ...hidden] };
  }

  const serviceId = Number(q.service) || null;

  const rows = await User.findAll({
    where: userWhere,
    include: [
      { model: Profile, as: "profile", where: profileWhere, required: true },
      { model: Photo, as: "photos", where: { moderationStatus: "approved" }, required: false },
      { model: ServiceCategory, as: "services", through: { attributes: [] } },
      { model: CompanionRate, as: "rates", where: { isCurrent: true }, required: false },
      { model: Availability, as: "availability" },
      { model: Interest, as: "interests", through: { attributes: [] } },
    ],
  });

  /* Where distance is measured from: the point in the query (the browser's
     geolocation), else the viewer's own saved location. */
  let from = null;
  if (q.lat && q.lng && Number.isFinite(Number(q.lat)) && Number.isFinite(Number(q.lng))) {
    from = { lat: Number(q.lat), lng: Number(q.lng) };
  } else if (viewer) {
    const vp = await Profile.findOne({ where: { userId: viewer.id } });
    if (vp?.latitude != null) from = { lat: Number(vp.latitude), lng: Number(vp.longitude) };
  }

  const minPrice = q.minPrice ? Number(q.minPrice) : null; // paise
  const maxPrice = q.maxPrice ? Number(q.maxPrice) : null;
  const minAge = q.minAge ? Number(q.minAge) : null;
  const maxAge = q.maxAge ? Number(q.maxAge) : null;
  const minRating = q.minRating ? Number(q.minRating) : null;
  const maxKm = q.maxKm ? Number(q.maxKm) : null;
  const language = q.language ? String(q.language).toLowerCase() : null;
  // "Available today" is the same as a date filter for today, in India time.
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const dateWanted = q.today === "1" || q.today === "true" ? today : q.date;
  const weekday = dateWanted && /^\d{4}-\d{2}-\d{2}$/.test(dateWanted) ? weekdayOf(dateWanted) : null;
  const interestIds = String(q.interests || "").split(",").map(Number).filter((n) => Number.isInteger(n) && n > 0);
  const nowOnly = q.availableNow === "1" || q.availableNow === "true";

  let cards = rows
    .filter((u) => !serviceId || u.services.some((s) => s.id === serviceId))
    .filter((u) => weekday === null || u.availability.some((a) => a.weekday === weekday))
    .filter((u) => !interestIds.length || (u.interests || []).some((i) => interestIds.includes(i.id)))
    .map((u) => presenter.card(u, { from }))
    .filter((c) => c.pricePerHourPaise !== null)
    .filter((c) => minPrice === null || c.pricePerHourPaise >= minPrice)
    .filter((c) => maxPrice === null || c.pricePerHourPaise <= maxPrice)
    .filter((c) => minAge === null || c.age >= minAge)
    .filter((c) => maxAge === null || c.age <= maxAge)
    .filter((c) => minRating === null || c.rating >= minRating)
    .filter((c) => !language || c.languages.some((l) => l.toLowerCase() === language))
    .filter((c) => maxKm === null || c.distanceKm === null || c.distanceKm <= maxKm)
    .filter((c) => !nowOnly || c.availableNow);

  const sort = q.sort || (from ? "distance" : "rating");
  const byDistance = (a, b) => (a.distanceKm ?? 1e9) - (b.distanceKm ?? 1e9);
  const sorters = {
    rating: (a, b) => b.rating - a.rating || b.ratingCount - a.ratingCount,
    price_asc: (a, b) => a.pricePerHourPaise - b.pricePerHourPaise,
    price_desc: (a, b) => b.pricePerHourPaise - a.pricePerHourPaise,
    distance: byDistance,
    newest: (a, b) => b.id - a.id,
  };
  cards = cards.sort(sorters[sort] || sorters.rating);
  // Whoever is available right now goes first, keeping the chosen order otherwise.
  cards = [...cards.filter((c) => c.availableNow), ...cards.filter((c) => !c.availableNow)];

  // Mark the viewer's favourites.
  if (viewer) {
    const favs = await require("../../models").Favorite.findAll({ where: { userId: viewer.id }, attributes: ["companionId"] });
    const set = new Set(favs.map((f) => f.companionId));
    cards = cards.map((c) => ({ ...c, favorite: set.has(c.id) }));
  }

  const limit = Math.min(Number(q.limit) || 24, 60);
  const page = Math.max(Number(q.page) || 1, 1);
  return {
    total: cards.length,
    page,
    pages: Math.max(Math.ceil(cards.length / limit), 1),
    sort,
    measuredFrom: from ? "location" : null,
    results: cards.slice((page - 1) * limit, page * limit),
  };
}

/**
 * Every area for the filter: the city's full list, plus any area a live
 * Companion already uses that is not on it, with a count of Companions in each.
 */
async function areas(city) {
  const { areasFor } = require("../../lib/areas");
  const rows = await Profile.findAll({
    attributes: ["area"],
    where: { approvalStatus: "approved", area: { [Op.ne]: null }, ...(city ? { city } : {}) },
    // Count live Companions only — Customers have areas too.
    include: [{ model: User, as: "user", attributes: [], where: { role: "companion", status: "active" } }],
  });
  const counts = {};
  rows.forEach((r) => { counts[r.area] = (counts[r.area] || 0) + 1; });
  const names = new Set([...areasFor(city || require("../../config/env").brand.city), ...Object.keys(counts)]);
  return [...names].sort((a, b) => a.localeCompare(b)).map((name) => ({ name, count: counts[name] || 0 }));
}

module.exports = { search, areas };
