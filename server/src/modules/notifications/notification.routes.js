const express = require("express");
const { Notification } = require("../../models");
const { wrap } = require("../../lib/handler");
const { requireAuth } = require("../../middleware/auth");

/**
 *   GET  /notifications            latest 50, and the unread count
 *   POST /notifications/read-all
 *   POST /notifications/:id/read
 */
const router = express.Router();
router.use(requireAuth);

router.get(
  "/",
  wrap(async (req, res) => {
    const rows = await Notification.findAll({ where: { userId: req.user.id }, order: [["id", "DESC"]], limit: 50 });
    const unread = await Notification.count({ where: { userId: req.user.id, readAt: null } });
    res.json({ unread, notifications: rows });
  })
);
router.post(
  "/read-all",
  wrap(async (req, res) => {
    await Notification.update({ readAt: new Date() }, { where: { userId: req.user.id, readAt: null } });
    res.json({ ok: true });
  })
);
router.post(
  "/:id(\\d+)/read",
  wrap(async (req, res) => {
    await Notification.update({ readAt: new Date() }, { where: { id: req.params.id, userId: req.user.id } });
    res.json({ ok: true });
  })
);

module.exports = router;
