const express = require("express");
const { Op } = require("sequelize");
const { Conversation, Message, Booking, User, Photo } = require("../../models");
const { wrap } = require("../../lib/handler");
const { requireAuth } = require("../../middleware/auth");
const { messageLimiter } = require("../../middleware/rateLimit");
const { filterMessage } = require("../../lib/chatFilter");
const { emitTo } = require("../../lib/realtime");
const { notify } = require("../../lib/notify");
const { publicUrl } = require("../../lib/uploads");
const { badRequest, notFound, forbidden } = require("../../lib/errors");
const { isBlocked } = require("../profiles/profile.service");

/**
 * In-app chat. A conversation exists only for a confirmed (paid) booking,
 * and is created by the booking service at that moment — never here.
 *
 * Every message goes through the filter: contact details are masked so
 * deals cannot be taken off the platform, and messages breaking the
 * platonic-only policy are flagged for moderators. The sender sees what
 * they typed; the other side sees the filtered text.
 *
 *   GET  /chat                       my conversations
 *   GET  /chat/:id/messages?before=  history, newest last
 *   POST /chat/:id/messages          send
 *   POST /chat/:id/read              mark read
 */
const router = express.Router();
router.use(requireAuth);

async function load(user, id) {
  const c = await Conversation.findByPk(id, {
    include: [{ model: Booking, as: "booking", attributes: ["id", "status", "startAt", "meetingPlaceName"] }],
  });
  if (!c || (c.customerId !== user.id && c.companionId !== user.id)) throw notFound("That conversation does not exist.");
  return c;
}

const otherId = (c, user) => (c.customerId === user.id ? c.companionId : c.customerId);

function messageJson(m, viewerId) {
  const mine = m.senderId === viewerId;
  return {
    id: m.id,
    mine,
    body: mine ? m.body : m.bodyFiltered || m.body,
    wasFiltered: m.wasFiltered,
    flagged: mine ? m.flagged : false,
    readAt: m.readAt,
    createdAt: m.createdAt,
  };
}

router.get(
  "/",
  wrap(async (req, res) => {
    const me = req.user.id;
    const rows = await Conversation.findAll({
      where: { [Op.or]: [{ customerId: me }, { companionId: me }] },
      include: [{ model: Booking, as: "booking", attributes: ["id", "status", "startAt", "meetingPlaceName"] }],
      order: [["lastMessageAt", "DESC"], ["createdAt", "DESC"]],
    });
    const out = [];
    for (const c of rows) {
      const other = await User.findByPk(otherId(c, req.user), {
        attributes: ["id", "fullName"],
        include: [{ model: Photo, as: "photos", where: { isPrimary: true, moderationStatus: "approved" }, required: false }],
      });
      const last = await Message.findOne({ where: { conversationId: c.id }, order: [["id", "DESC"]] });
      const unread = await Message.count({ where: { conversationId: c.id, senderId: { [Op.ne]: me }, readAt: null } });
      out.push({
        id: c.id,
        isClosed: c.isClosed,
        booking: c.booking,
        other: other ? { id: other.id, name: other.fullName, photo: other.photos?.[0] ? publicUrl(other.photos[0].thumbPath) : null } : null,
        lastMessage: last ? messageJson(last, me) : null,
        unread,
      });
    }
    res.json({ conversations: out });
  })
);

router.get(
  "/:id(\\d+)/messages",
  wrap(async (req, res) => {
    const c = await load(req.user, req.params.id);
    const where = { conversationId: c.id };
    if (req.query.before) where.id = { [Op.lt]: Number(req.query.before) };
    const rows = await Message.findAll({ where, order: [["id", "DESC"]], limit: 50 });
    const other = await User.findByPk(otherId(c, req.user), { attributes: ["id", "fullName"] });
    res.json({
      conversation: { id: c.id, isClosed: c.isClosed, booking: c.booking, other: { id: other.id, name: other.fullName } },
      messages: rows.reverse().map((m) => messageJson(m, req.user.id)),
    });
  })
);

router.post(
  "/:id(\\d+)/messages",
  messageLimiter,
  wrap(async (req, res) => {
    const c = await load(req.user, req.params.id);
    if (c.isClosed || !["confirmed", "disputed"].includes(c.booking.status)) {
      throw forbidden("This chat is closed. Chat is open only while a booking is confirmed.");
    }
    const to = otherId(c, req.user);
    if (await isBlocked(req.user.id, to)) throw forbidden("You cannot message this person.");
    const text = String(req.body.body || "").trim();
    if (!text) throw badRequest("Write a message.");
    if (text.length > 2000) throw badRequest("Keep messages under 2,000 characters.");

    const f = filterMessage(text);
    const m = await Message.create({
      conversationId: c.id,
      senderId: req.user.id,
      body: text,
      bodyFiltered: f.masked ? f.filtered : null,
      wasFiltered: f.masked,
      flagged: f.flagged,
      flagReason: f.flagReason,
      deliveredAt: new Date(),
    });
    await c.update({ lastMessageAt: new Date() });

    emitTo(to, "message", { conversationId: c.id, message: messageJson(m, to) });
    await notify(to, { type: "message", title: `New message from ${req.user.fullName.split(" ")[0]}`, link: `/messages/${c.id}` });

    res.status(201).json({
      message: messageJson(m, req.user.id),
      notice: f.masked
        ? "Contact details were hidden. Keep chat and payments on the platform — that is what protects you."
        : f.flagged
          ? "This message may break our platonic-only policy and has been sent to our safety team."
          : null,
    });
  })
);

router.post(
  "/:id(\\d+)/read",
  wrap(async (req, res) => {
    const c = await load(req.user, req.params.id);
    await Message.update(
      { readAt: new Date() },
      { where: { conversationId: c.id, senderId: { [Op.ne]: req.user.id }, readAt: null } }
    );
    emitTo(otherId(c, req.user), "read", { conversationId: c.id });
    res.json({ ok: true });
  })
);

module.exports = router;
