const express = require("express");
const bcrypt = require("bcryptjs");
const { Op } = require("sequelize");
const { User, Preference, Booking, Profile, Photo, PayoutAccount, KycDocument } = require("../../models");
const { wrap } = require("../../lib/handler");
const { requireAuth } = require("../../middleware/auth");
const { revokeAllForUser } = require("../../lib/tokens");
const { remove } = require("../../lib/uploads");
const { badRequest, conflict } = require("../../lib/errors");
const { logger } = require("../../lib/logger");

/**
 * The account itself.
 *
 *   GET    /account/preferences
 *   PUT    /account/preferences
 *   PUT    /account/support-access   { allow }  let staff view my account for 24 h
 *   DELETE /account               delete my account (30-day grace period)
 *
 * Deleting is required by the Play Store, the App Store and the DPDP Act.
 * The account is hidden and signed out at once; signing in again within 30
 * days restores it. After that `purgeDeleted` erases the personal data.
 * Payments, payouts and invoices are kept (with the person anonymised)
 * because tax law requires them.
 */
const router = express.Router();
router.use(requireAuth);

const PREFS = ["emailNotifications", "showOnlineStatus", "minAge", "maxAge", "maxDistanceKm", "verifiedOnly"];

router.get(
  "/preferences",
  wrap(async (req, res) => {
    const [p] = await Preference.findOrCreate({ where: { userId: req.user.id }, defaults: { userId: req.user.id } });
    res.json(Object.fromEntries(PREFS.map((k) => [k, p[k]])));
  })
);

router.put(
  "/preferences",
  wrap(async (req, res) => {
    const [p] = await Preference.findOrCreate({ where: { userId: req.user.id }, defaults: { userId: req.user.id } });
    const patch = {};
    for (const k of PREFS) if (req.body[k] !== undefined) patch[k] = req.body[k];
    await p.update(patch);
    res.json(Object.fromEntries(PREFS.map((k) => [k, p[k]])));
  })
);

/**
 * "Allow support to view my account" — the member's permission for staff
 * to open a read-only view of their account, for 24 hours. Only the member
 * can switch it on; switching it off ends any view in progress.
 */
const SUPPORT_ACCESS_HOURS = 24;
router.put(
  "/support-access",
  wrap(async (req, res) => {
    const allow = req.body.allow === true;
    const until = allow ? new Date(Date.now() + SUPPORT_ACCESS_HOURS * 3600e3) : null;
    await req.user.update({ supportAccessUntil: until });
    await require("../../lib/audit").record(req, {
      action: allow ? "support_access.granted" : "support_access.revoked", entityType: "user", entityId: req.user.id, detail: allow ? `until ${until.toISOString()}` : null,
    });
    res.json({ supportAccessUntil: until });
  })
);

router.delete(
  "/",
  wrap(async (req, res) => {
    const ok = await bcrypt.compare(String(req.body.password || ""), req.user.passwordHash);
    if (!ok) throw badRequest("That password is not right.");
    const live = await Booking.count({
      where: {
        [Op.or]: [{ customerId: req.user.id }, { companionId: req.user.id }],
        status: { [Op.in]: ["confirmed", "in_progress", "disputed"] },
      },
    });
    if (live) throw conflict("You have a confirmed or disputed booking. Finish or cancel it before deleting your account.");
    await Booking.update(
      { status: "cancelled", cancelledAt: new Date(), cancelledById: req.user.id, cancelReason: "Account deleted" },
      { where: { [Op.or]: [{ customerId: req.user.id }, { companionId: req.user.id }], status: { [Op.in]: ["pending", "accepted"] } } }
    );
    await req.user.update({ status: "deleted", deletionRequestedAt: new Date() });
    await revokeAllForUser(req.user.id);
    res.clearCookie("kindred_refresh", { path: "/api/auth" });
    res.json({ message: "Your account is deleted. Sign in within 30 days if you change your mind; after that your data is erased for good." });
  })
);

/** Erases personal data of accounts deleted more than 30 days ago. Nightly. */
async function purgeDeleted() {
  const cutoff = new Date(Date.now() - 30 * 864e5);
  const rows = await User.findAll({ where: { status: "deleted", deletionRequestedAt: { [Op.lt]: cutoff }, email: { [Op.notLike]: "deleted-%" } } });
  for (const u of rows) {
    const photos = await Photo.findAll({ where: { userId: u.id } });
    photos.forEach((p) => { remove(p.path); remove(p.thumbPath); });
    await Photo.destroy({ where: { userId: u.id } });
    const docs = await KycDocument.findAll({ where: { userId: u.id } });
    docs.forEach((d) => remove(d.filePath));
    await KycDocument.destroy({ where: { userId: u.id } });
    const profile = await Profile.findOne({ where: { userId: u.id } });
    if (profile) {
      remove(profile.selfiePath);
      await profile.update({ bio: null, occupation: null, latitude: null, longitude: null, selfiePath: null, emergencyContactName: null, emergencyContactPhone: null, languages: null, area: null });
    }
    await PayoutAccount.destroy({ where: { companionId: u.id } });
    await u.update({ fullName: "Deleted member", email: `deleted-${u.id}@deleted.invalid`, mobile: `deleted-${u.id}`, passwordHash: "!" });
  }
  if (rows.length) logger.info(`Erased ${rows.length} deleted account(s).`);
}

module.exports = router;
module.exports.purgeDeleted = purgeDeleted;
