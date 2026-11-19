const { Notification, User, Preference } = require("../models");
const { sendMail } = require("./mailer");
const { sendSms, sendWhatsApp, sendPush } = require("./messaging");
const { emitTo } = require("./realtime");
const env = require("../config/env");
const { logger } = require("./logger");

/**
 * Tells someone something, on every channel that suits it.
 *
 *   in-app   always — a Notification row, pushed live over the socket
 *   email    unless they switched email off in Settings
 *   sms / whatsapp / push   for the events that matter in real time
 *
 * A failed send is logged, never thrown: a booking must not fail because
 * an SMS could not go out.
 */
async function notify(userId, { type, title, body = "", link = null, urgent = false }) {
  try {
    const row = await Notification.create({ userId, type, title, body, link });
    emitTo(userId, "notification", row.toJSON());

    const user = await User.findByPk(userId, { include: [{ model: Preference, as: "preference" }] });
    if (!user) return row;

    const text = `${env.brand.name}: ${title}${body ? ` — ${body}` : ""}`;
    const wantsEmail = user.preference ? user.preference.emailNotifications : true;

    const jobs = [sendPush(user.id, text)];
    if (wantsEmail) {
      jobs.push(
        sendMail({
          to: user.email,
          subject: `${title} · ${env.brand.name}`,
          text: `Hi ${user.fullName},\n\n${title}\n${body}\n\n${link ? `${env.clientUrl}${link}` : ""}`,
        }).then(() => row.update({ emailedAt: new Date() }))
      );
    }
    if (urgent) {
      jobs.push(sendSms(user.mobile, text), sendWhatsApp(user.mobile, text));
    }
    await Promise.allSettled(jobs);
    return row;
  } catch (err) {
    logger.error(`Notification "${type}" to user ${userId} failed: ${err.message}`);
    return null;
  }
}

module.exports = { notify };
