const { publicUrl } = require("../../lib/uploads");
const { distanceKm } = require("../../lib/geo");

/**
 * The shapes a profile leaves the server in. Exact coordinates never do:
 * a card carries the area name and a rounded distance, nothing finer.
 */

const photoJson = (p) => ({
  id: p.id,
  url: publicUrl(p.path),
  thumbUrl: publicUrl(p.thumbPath),
  isPrimary: p.isPrimary,
  moderationStatus: p.moderationStatus,
  rejectionReason: p.rejectionReason,
});

const currentRate = (user) => {
  const r = (user.rates || []).find((x) => x.isCurrent);
  return r ? Number(r.pricePerHourPaise) : null;
};

const languagesOf = (profile) =>
  String(profile?.languages || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

/** A Discover card. */
function card(user, { from } = {}) {
  const p = user.profile || {};
  const photos = (user.photos || []).filter((x) => x.moderationStatus === "approved");
  const primary = photos.find((x) => x.isPrimary) || photos[0];
  const km = from ? distanceKm(from.lat, from.lng, p.latitude, p.longitude) : null;
  return {
    id: user.id,
    name: user.fullName,
    firstName: user.fullName.split(" ")[0],
    age: user.age(),
    gender: p.gender,
    city: p.city,
    area: p.area,
    bio: p.bio,
    languages: languagesOf(p),
    pricePerHourPaise: currentRate(user),
    rating: Number(p.ratingAvg || 0),
    ratingCount: p.ratingCount || 0,
    completedMeets: p.completedMeets || 0,
    verified: Boolean(p.isVerified),
    photo: primary ? publicUrl(primary.thumbPath || primary.path) : null,
    services: (user.services || []).map((s) => ({ id: s.id, name: s.name, slug: s.slug })),
    distanceKm: km === null ? null : Math.round(km * 10) / 10,
  };
}

/** The full public profile page. */
function full(user, { from, reviews = [] } = {}) {
  const base = card(user, { from });
  return {
    ...base,
    occupation: user.profile?.occupation,
    photos: (user.photos || [])
      .filter((x) => x.moderationStatus === "approved")
      .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.position - b.position)
      .map((x) => ({ id: x.id, url: publicUrl(x.path), thumbUrl: publicUrl(x.thumbPath) })),
    interests: (user.interests || []).map((i) => ({ id: i.id, name: i.name })),
    availability: (user.availability || [])
      .map((a) => ({ weekday: a.weekday, startTime: a.startTime, endTime: a.endTime }))
      .sort((a, b) => a.weekday - b.weekday || a.startTime.localeCompare(b.startTime)),
    reviews: reviews.map((r) => ({
      id: r.id,
      rating: r.rating,
      comment: r.comment,
      author: r.author ? r.author.fullName.split(" ")[0] : "Member",
      createdAt: r.createdAt,
    })),
  };
}

module.exports = { card, full, photoJson, currentRate, languagesOf };
