const express = require("express");
const { Op } = require("sequelize");
const { User, Profile, Photo, ServiceCategory, CompanionRate, Favorite, Booking, PublicPlace } = require("../../models");
const { wrap } = require("../../lib/handler");
const { requireAuth } = require("../../middleware/auth");
const { badRequest, notFound } = require("../../lib/errors");
const presenter = require("../profiles/profile.presenter");
const wallet = require("../../lib/wallet");
const referrals = require("../../lib/referrals");
const env = require("../../config/env");

/**
 * The member's own: favourites, wallet, refer-a-friend, and the list of
 * checked public places a booking can use.
 *
 *   GET    /me/favorites               saved Companions (+ last booking with each)
 *   POST   /me/favorites/:companionId  save
 *   DELETE /me/favorites/:companionId  unsave
 *   GET    /me/wallet                  balance and statement
 *   GET    /me/referral                my code, link, who joined
 *   GET    /places?city=&area=         public meeting places
 */
const router = express.Router();

const COMPANION_INCLUDE = [
  { model: Profile, as: "profile" },
  { model: Photo, as: "photos", where: { moderationStatus: "approved" }, required: false },
  { model: ServiceCategory, as: "services", through: { attributes: [] } },
  { model: CompanionRate, as: "rates", where: { isCurrent: true }, required: false },
];

router.get(
  "/me/favorites",
  requireAuth,
  wrap(async (req, res) => {
    const favs = await Favorite.findAll({ where: { userId: req.user.id }, order: [["createdAt", "DESC"]] });
    const ids = favs.map((f) => f.companionId);
    const users = ids.length ? await User.findAll({ where: { id: ids, role: "companion" }, include: COMPANION_INCLUDE }) : [];
    const last = ids.length
      ? await Booking.findAll({ where: { customerId: req.user.id, companionId: ids, status: "completed" }, attributes: ["companionId", "startAt"], order: [["startAt", "DESC"]] })
      : [];
    const lastBy = {};
    last.forEach((b) => { if (!lastBy[b.companionId]) lastBy[b.companionId] = b.startAt; });
    const byId = Object.fromEntries(users.map((u) => [u.id, u]));
    res.json({
      favorites: ids
        .filter((id) => byId[id])
        .map((id) => {
          const u = byId[id];
          const bookable = u.canTransact() && u.profile?.approvalStatus === "approved";
          return { ...presenter.card(u), favorite: true, bookable, lastMetAt: lastBy[id] || null };
        }),
    });
  })
);

router.post(
  "/me/favorites/:companionId(\\d+)",
  requireAuth,
  wrap(async (req, res) => {
    const c = await User.findOne({ where: { id: req.params.companionId, role: "companion" }, attributes: ["id"] });
    if (!c) throw notFound("That Companion does not exist.");
    const count = await Favorite.count({ where: { userId: req.user.id } });
    if (count >= 200) throw badRequest("You can save up to 200 Companions.");
    await Favorite.findOrCreate({ where: { userId: req.user.id, companionId: c.id }, defaults: { userId: req.user.id, companionId: c.id } });
    res.json({ favorite: true });
  })
);

router.delete(
  "/me/favorites/:companionId(\\d+)",
  requireAuth,
  wrap(async (req, res) => {
    await Favorite.destroy({ where: { userId: req.user.id, companionId: req.params.companionId } });
    res.json({ favorite: false });
  })
);

router.get(
  "/me/wallet",
  requireAuth,
  wrap(async (req, res) => {
    res.json({ balancePaise: await wallet.balance(req.user.id), transactions: await wallet.statement(req.user.id) });
  })
);

router.get(
  "/me/referral",
  requireAuth,
  wrap(async (req, res) => {
    const r = await referrals.summary(req.user);
    res.json({ ...r, link: `${env.clientUrl}/signup?ref=${encodeURIComponent(r.code)}` });
  })
);

/** Checked public places, for the booking form's picker and map. */
router.get(
  "/places",
  requireAuth,
  wrap(async (req, res) => {
    const where = { isActive: true };
    if (req.query.city) where.city = String(req.query.city);
    if (req.query.area) where.area = { [Op.like]: `%${String(req.query.area).trim()}%` };
    if (req.query.q) where.name = { [Op.like]: `%${String(req.query.q).trim()}%` };
    const rows = await PublicPlace.findAll({ where, order: [["area", "ASC"], ["name", "ASC"]], limit: 300 });
    res.json({ places: rows.map(placeJson) });
  })
);

function placeJson(p) {
  return {
    id: p.id,
    name: p.name,
    type: p.type,
    city: p.city,
    area: p.area,
    address: p.address,
    latitude: Number(p.latitude),
    longitude: Number(p.longitude),
    isActive: p.isActive,
  };
}

module.exports = router;
module.exports.placeJson = placeJson;
