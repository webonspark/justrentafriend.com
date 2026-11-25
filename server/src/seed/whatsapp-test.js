/**
 * Sends one test reminder on WhatsApp, to check the Meta setup.
 *
 *   npm run whatsapp:test -- 9876543210
 *
 * The number must have messaged the business number, or be added as a test
 * recipient in Meta, until the business is verified.
 */
require("../config/env");
const whatsapp = require("../lib/whatsapp");

(async () => {
  const to = process.argv[2];
  if (!to) {
    console.error("Usage: npm run whatsapp:test -- <mobile number>");
    process.exit(2);
  }
  console.log("WhatsApp setup:", whatsapp.status());
  const r = await whatsapp.sendTemplate(to, "reminder", ["Ravi", "Test Companion", "tomorrow at 6:00 pm", "Third Wave Coffee, Indiranagar", "https://test.webonspark.com/bookings/1"]);
  console.log(r.delivered ? `Sent (message id ${r.id}). Check WhatsApp on ${to}.` : `Not sent: ${r.reason}${r.error ? ` — ${r.error}` : ""}`);
  process.exit(r.delivered || r.reason === "console" ? 0 : 1);
})();
