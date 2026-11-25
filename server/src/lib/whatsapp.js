const { logger } = require("./logger");

/**
 * WhatsApp messages through the official WhatsApp Business Cloud API (Meta).
 *
 *   WHATSAPP_PROVIDER=console   (default) print to the server log only
 *   WHATSAPP_PROVIDER=meta      send for real; needs the three below
 *   WHATSAPP_TOKEN              permanent access token (System User)
 *   WHATSAPP_PHONE_NUMBER_ID    the ID Meta gives the business number
 *   WHATSAPP_API_VERSION        default v21.0
 *
 * A business may only start a conversation with an approved *template*,
 * never free text, and only with people who opted in. So everything here
 * sends a named template with numbered parameters ({{1}}, {{2}}, …).
 *
 *   WHATSAPP_TEMPLATE_REMINDER  default "meet_reminder"
 *   WHATSAPP_TEMPLATE_LANG      default "en"
 */
const cfg = () => ({
  provider: process.env.WHATSAPP_PROVIDER || "console",
  token: process.env.WHATSAPP_TOKEN,
  phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
  version: process.env.WHATSAPP_API_VERSION || "v21.0",
  lang: process.env.WHATSAPP_TEMPLATE_LANG || "en",
});

const TEMPLATES = {
  reminder: () => process.env.WHATSAPP_TEMPLATE_REMINDER || "meet_reminder",
};

/** "+91 98765 43210" → "919876543210", which is what the API wants. */
function toWaNumber(mobile) {
  const digits = String(mobile || "").replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  return digits.length >= 11 && digits.length <= 15 ? digits : null;
}

/* Template parameters may not contain new lines, tabs or 4+ spaces. */
const clean = (v) => String(v ?? "").replace(/[\r\n\t]+/g, " ").replace(/ {4,}/g, "   ").trim().slice(0, 500) || "-";

/**
 * Sends one template message. Never throws: a reminder that cannot go out
 * must not break the sweep that sends it.
 */
async function sendTemplate(mobile, key, params = []) {
  const c = cfg();
  const to = toWaNumber(mobile);
  const name = TEMPLATES[key] ? TEMPLATES[key]() : key;
  if (!to) return { delivered: false, reason: "no_number" };

  if (c.provider === "console") {
    logger.info(`[whatsapp:${name}] → +${to}: ${params.map(clean).join(" | ")}`);
    return { delivered: false, reason: "console" };
  }
  if (c.provider !== "meta") {
    logger.error(`WhatsApp provider "${c.provider}" is not supported. Use console or meta.`);
    return { delivered: false, reason: "bad_provider" };
  }
  if (!c.token || !c.phoneNumberId) {
    logger.error("WhatsApp is set to meta but WHATSAPP_TOKEN or WHATSAPP_PHONE_NUMBER_ID is missing.");
    return { delivered: false, reason: "not_configured" };
  }

  try {
    const r = await fetch(`https://graph.facebook.com/${c.version}/${c.phoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${c.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: {
          name,
          language: { code: c.lang },
          components: params.length ? [{ type: "body", parameters: params.map((p) => ({ type: "text", text: clean(p) })) }] : [],
        },
      }),
      signal: AbortSignal.timeout(10000),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      logger.error(`WhatsApp "${name}" to +${to} failed: ${data?.error?.message || r.status}`);
      return { delivered: false, reason: "api_error", error: data?.error?.message };
    }
    return { delivered: true, id: data?.messages?.[0]?.id };
  } catch (err) {
    logger.error(`WhatsApp "${name}" to +${to} failed: ${err.message}`);
    return { delivered: false, reason: "network" };
  }
}

/** For the boot log and the admin: is WhatsApp actually going out? */
function status() {
  const c = cfg();
  return { provider: c.provider, ready: c.provider === "meta" && Boolean(c.token && c.phoneNumberId), template: TEMPLATES.reminder(), lang: c.lang };
}

module.exports = { sendTemplate, toWaNumber, status };
