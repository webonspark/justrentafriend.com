const { logger } = require("./logger");

/**
 * SMS, WhatsApp and push, behind one function each.
 *
 * MESSAGING_PROVIDER=console (default) prints to the server log, so every
 * notification can be seen working with no account. For production wire
 * MSG91 / Twilio (SMS, WhatsApp) and Firebase Cloud Messaging (push) here.
 */
const provider = () => process.env.MESSAGING_PROVIDER || "console";

async function send(channel, to, text) {
  if (!to) return { delivered: false };
  if (provider() !== "console") throw new Error(`Messaging provider "${provider()}" is not configured yet.`);
  logger.info(`[${channel}] → ${to}: ${text}`);
  return { delivered: false };
}

module.exports = {
  provider,
  sendSms: (to, text) => send("sms", to, text),
  sendWhatsApp: (to, text) => send("whatsapp", to, text),
  sendPush: (userId, text) => send("push", `user#${userId}`, text),
};
