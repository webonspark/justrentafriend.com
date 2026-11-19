# Just Rent a Friend

A paid companionship platform for Bengaluru — book a friend for platonic time in public
places. Three roles: **Customers** book a friend and pay for the time; **Companions** offer
their time at an hourly rate they set and are paid after each meet; **Admins** handle
moderation, KYC, payouts and disputes. Membership is compulsory for both member types, every
booking is paid separately, and the company keeps an admin-settable commission (18% by
default) out of the Companion's price.

Adults only, 18+. Bookings are for social time; sexual services and solicitation are banned
and enforced through chat filtering, reporting, moderation and bans.

> **Change the brand in two places.** `BRAND_NAME` and `LAUNCH_CITY` in `server/.env`, and
> the same two in `client/.env`. Nothing else hard-codes the name.

---

## What is built

- **Accounts:** sign-up as Customer or Companion with Terms/Privacy consent, email OTP and
  mobile OTP (SMS), login by email or mobile with a password or by mobile OTP, forgot/reset
  password, optional Google sign-in, 18+ gate from the
  date of birth, account deletion with a 30-day grace period then erasure.
- **Verification:** Companion KYC (Aadhaar/PAN, only the last 4 digits stored), selfie matched
  to the profile photo, the Verified badge, and admin approval before a Companion goes live.
  Photos are moderated.
- **Companion profiles:** photos, bio, languages, interests, area, service categories, hourly
  rate, weekly availability calendar, ratings, reviews and completed-meet count.
- **Search:** city/area, "near me" geolocation and distance, filters (service, price, gender,
  age, language, rating, available date, verified), sort by rating, price or distance.
- **Bookings:** date, free time slot, duration, service and a public meeting place (private
  places are refused). Request → Companion accepts/rejects → Customer pays. Statuses: pending,
  accepted, rejected, confirmed, completed, cancelled, disputed, expired. History for both sides.
- **Payments:** Razorpay checkout (UPI, cards) behind an adapter, with a built-in mock gateway.
  Escrow: money is held until the meet completes (the Customer confirms, or 24 hours pass with no
  dispute), then the Companion's payout is released. Commission, GST invoices, time-based
  cancellation refunds, and a Companion payout dashboard with UPI/bank payout accounts.
- **Messaging:** Socket.IO chat that opens only after payment, masks phone numbers, emails, UPI
  IDs and social handles, flags messages that break the platonic-only policy, and supports
  report and block from the thread.
- **Notifications:** in-app (live), email, SMS/WhatsApp and push for requests, confirmations,
  reminders (2 hours before) and payments.
- **Safety:** report and block, an SOS button during a meet that sends live location to an
  emergency contact (and a public live-location page for them), check-in/check-out, the
  public-place rule.
- **Reviews:** two-way, only after a completed booking.
- **Admin panel** at `/admin`: dashboard and analytics (users, bookings, revenue by city),
  members (approve, warn, suspend, ban), Companion approvals, KYC and selfie queue, photo
  moderation, bookings, payments, refunds, payouts, disputes, reports and audited chat review,
  SOS alerts, reviews, settings (commission, GST, cancellation windows), service categories,
  membership plans, audit log and staff with roles (super admin, moderator, finance, support).
- **Legal pages:** Terms, Privacy, Refunds, Safety, Child safety, Community guidelines, Account
  deletion, Contact and Grievance Officer, plus How it works, Pricing, Help and About.

**Paid services run in mock mode until you add keys.** Each sits behind one adapter and one
`.env` switch in `server/.env`: `PAYMENT_GATEWAY` (Razorpay), `PAYOUT_PROVIDER` (Razorpay Route
/ Cashfree Payouts), `KYC_PROVIDER` (DigiLocker / IDfy / Signzy), `MESSAGING_PROVIDER` (SMS,
WhatsApp, push) and `GOOGLE_CLIENT_ID`. In mock mode the whole flow works locally and every SMS,
push and payout is printed to the server console.

---

## Running it

You need Node 18+ and MySQL (XAMPP, Docker or MySQL Community — all free).

### 1. The database

```sql
CREATE DATABASE kindred CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 2. The server

```bash
cd server
npm install
cp .env.example .env
```

Open `.env` and set `DB_USER`, `DB_PASSWORD`, and two different secrets. Generate each with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Then build the tables and fill them:

```bash
npm run db:migrate     # creates every table
npm run db:seed        # 1 admin, 10 Companions, 10 Customers, sample bookings
# or, for a real database with no sample members:
ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='…' npm run db:seed -- --base
npm run dev            # http://localhost:5000
```

### 3. The client

```bash
cd client
npm install
cp .env.example .env
npm run dev            # http://localhost:5173
```

Leave `VITE_API_URL` empty. Vite proxies `/api` to port 5000, so the browser talks to one
origin and the refresh cookie behaves exactly as it will in production.

### Signing in

Every seeded account uses the password **`Password123`**.

| Who | Email |
| --- | --- |
| Super Admin (at `/admin`) | `admin@kindred.example` |
| A Companion | `meera.iyer@example.com` |
| A Customer | `aditya.sharma@example.com` |

**Email goes to your terminal.** `MAIL_TRANSPORT=console` prints OTPs to the server console
instead of sending them, so the whole sign-up and reset flow works with no account anywhere.
The code is also shown on the screen in development.

### No MySQL to hand?

Set `DB_DIALECT=sqlite` in `server/.env` and everything runs on a file. Fine for trying it
out; use MySQL for anything real.

---

## How it is laid out

```
server/src/
  config/      env (validated once) and the Sequelize connection
  models/      every table; index.js wires every relationship
  middleware/  auth guards, the error shape, rate limits, validation
  modules/     one folder per domain: auth, profiles, discover, bookings, payments,
               earnings, chat, safety, notifications, account, admin
  lib/         money, time (IST), tokens, OTP, mail, audit, settings, uploads, chat filter,
               and the adapters: payments, payouts, kyc, messaging, notify, realtime
  routes/      everything mounts here
  seed/        migrate.js and seed.js

client/src/
  components/ui/      Button, Card, Field, Badge, Price, Avatar, Skeleton…
  components/layout/  Navbar, Footer, BottomNav, NotificationBell, route guards
  components/shared/  Checkout, CompanionCard, ReportModal, SosButton, GoogleButton
  pages/              discover, bookings, messages, profile, settings, membership, earnings,
                      payments, notifications, safety, info (legal), admin, auth, system
  context/            who is signed in, and the black/white theme
  lib/                formatting (₹, IST dates) and the socket
  services/api.js     the only place that talks to the server (members and admin)
  styles/             tokens.css (every colour, both themes) and index.css
```

---

## Decisions worth knowing

**Money is always paise.** ₹2,000 is `200000`, an integer, everywhere. Floats are never used
for money — `0.1 + 0.2` is not `0.3`, and a marketplace splitting every payment three ways
cannot absorb that. Rupees appear only in what someone types and what they are shown.

**The commission is written onto the booking.** The percentage and all three amounts are
copied onto the row when the booking is made and never recalculated, so changing the
commission next month cannot alter terms already agreed. A `Booking` refuses to save unless
commission + payout equals exactly what the Customer pays.

**Refresh tokens rotate.** Spending one retires it and issues a replacement in the same
family. Presenting a retired token means two copies exist, so the whole family is revoked and
that person is signed out everywhere. The token lives in an httpOnly cookie; the access token
stays in memory, never in `localStorage`.

**Every colour is a token.** Colours live only in `client/src/styles/tokens.css`, as CSS
variables, with a black set (the default) and a white set under `[data-theme="light"]`.
Tailwind's colour classes (`bg-ink`, `text-paper`, `text-rose`…) read those variables, so one
class works in both themes. Never write a hex or rgba value in a component — add a token. The
sun/moon button in the navbar switches theme; a saved choice wins, otherwise the device's setting.

**Tailwind's preflight is off.** Bootstrap's reset wins, so React Bootstrap's components keep
working. The three declarations Tailwind's preflight supplies that we still need —
`border-width`, `border-style`, `border-color` — are re-added at the top of `index.css`.
Without them every `border-*` utility sets a width against a style of `none` and draws nothing.

**Nothing trusts the browser.** The 18+ check, the membership gate, role checks and ownership
are all enforced server-side. Hiding a button is a courtesy; refusing the request is the rule.

---

## Assumptions made

Listed because the brief asked for them.

1. Both Customers and Companions pay for membership.
2. The 18% commission is **deducted** from the Companion's price. The Customer pays exactly the
   price shown (plus GST on the platform fee only if `gst_on_commission` is switched on).
3. GST on the commission is a setting (`gst_on_commission`), off by default. **Confirm with a
   chartered accountant.**
4. Cancellation windows are settings: free up to 24 hours before, 50% inside that.
5. Payments start on the built-in mock gateway; Razorpay sits behind the same adapter and is
   a config change away. The same is true of payouts, KYC and SMS/WhatsApp/push.
6. Admins can read a private chat only where a report exists, and every such view is written
   to the audit log.
7. The brand name and city are placeholders — change them in the two `.env` files.
8. Mobile numbers are verified by an SMS code before search, booking and chat open. SMS is
   printed to the server console until a provider is wired into `lib/messaging.js`.
9. A Companion must be approved by an admin (after KYC, selfie and photo checks) before they
   appear in search. Payouts are held until KYC is approved and a payout account is added.
10. A booking request expires if the Companion does not answer within 24 hours; an accepted
    booking expires if it is not paid within 12 hours.

---

## Still to come

| What | Notes |
| --- | --- |
| Real provider keys | Razorpay, payouts, KYC, SMS/WhatsApp, push, Google — see the `.env` switches above |
| Automated tests | Not written yet |
| Deployment guide | Hosting, MySQL, HTTPS, backups |

### Future upgrades (all cost money — deliberately not built)

Paid SMS OTP, Razorpay live mode, Cloudinary beyond the free tier, Redis for caching and
queues, a managed MySQL host, paid monitoring, push notifications, a paid maps API.

---

## Before launch

The legal text in the app is a starting point, not advice. **Have a lawyer review the Terms,
Privacy policy, Refund policy, Community guidelines and Child safety policy** against the DPDP
Act 2023 and the IT Act intermediary rules before this goes live, and have a chartered
accountant confirm the GST treatment.
