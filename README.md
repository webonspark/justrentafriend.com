# Kindred

A paid connection platform for Bengaluru. Two member types — **Customers**, who are listed
and set a fixed price per hour, and **Users**, who pay to connect. Membership is compulsory
for both, every connection is paid separately, and the company keeps an admin-settable
commission (18% by default) out of the Customer's price.

Adults only, 18+. Bookings are for social time; sexual services and solicitation are banned
and enforced through reporting, moderation and bans.

> **Change the brand in two places.** `BRAND_NAME` and `LAUNCH_CITY` in `server/.env`, and
> the same two in `client/.env`. Nothing else hard-codes the name.

---

## What is built

**Phase 1 — Foundation. Done.**

- Express + Sequelize + MySQL, with the full schema for every later phase
- Sign up with a role, email OTP, login by email or mobile, forgot and reset password
- The 18+ gate, enforced on the server from the date of birth
- JWT access tokens (15 min) with rotating refresh tokens (30 days)
- The design system: React Bootstrap and Tailwind together, one red accent, black and white themes
- Home page, auth pages, navigation, mobile tab bar, and the 404 / 403 / 500 / maintenance pages

Phases 2 to 8 have their routes in place already, each pointing at a placeholder that names
the phase, so the navigation works end to end from today.

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
npm run db:seed        # 1 admin, 10 Customers, 10 Users, sample bookings
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
| Super Admin | `admin@kindred.example` |
| A Customer | `meera.iyer@example.com` |
| A User | `aditya.sharma@example.com` |

**Email goes to your terminal.** `MAIL_TRANSPORT=console` prints OTPs to the server console
instead of sending them, so the whole sign-up and reset flow works with no account anywhere.
The code is also shown on the screen in development.

### No MySQL to hand?

Set `DB_DIALECT=sqlite` in `server/.env` and everything runs on a file. Fine for trying it
out; distance search in Phase 2 needs real MySQL.

---

## How it is laid out

```
server/src/
  config/      env (validated once) and the Sequelize connection
  models/      23 tables; index.js wires every relationship
  middleware/  auth guards, the error shape, rate limits, validation
  modules/     one folder per domain — auth is built, the rest follow
  lib/         money, tokens, OTP, mail, audit, the age gate
  routes/      everything mounts here
  seed/        migrate.js and seed.js

client/src/
  components/ui/      Button, Card, Field, Badge, Price, Avatar, Skeleton…
  components/layout/  Navbar, Footer, BottomNav, route guards
  pages/              Home, auth pages, system pages
  context/            who is signed in, and the black/white theme
  services/api.js     the only place that talks to the server
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
commission + payout equals exactly what the User pays.

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

1. Both Customers and Users pay for membership.
2. The 18% commission is **deducted** from the Customer's price. The User pays exactly the
   price shown.
3. GST on the commission is a setting (`gst_on_commission`), off by default. **Confirm with a
   chartered accountant.**
4. Cancellation windows are settings: free up to 24 hours before, 50% inside that.
5. Payments start on the built-in mock gateway; Razorpay test mode sits behind the same
   adapter and is a config change away.
6. Admins can read a private chat only where a report exists, and every such view is written
   to the audit log.
7. The brand name and city are placeholders — change them in the two `.env` files.
8. Mobile OTP is email-only in this version. Real SMS costs money; the brief says free tools
   only.

---

## Still to come

| Phase | What |
| --- | --- |
| 2 | Profiles, photo upload with moderation, Discover with distance search |
| 3 | Membership plans, checkout with GST, payment adapter, webhooks, invoices |
| 4 | Bookings, the commission split, completion, refunds, payouts, Earnings |
| 5 | Socket.IO chat after payment, report and block, contact-detail filtering |
| 6 | The admin panel — dashboard, member tables and detail pages, KYC, CMS, audit log |
| 7 | Safety centre and all legal pages |
| 8 | Tests, security pass, performance, deployment guide |

### Future upgrades (all cost money — deliberately not built)

Paid SMS OTP, Razorpay live mode, Cloudinary beyond the free tier, Redis for caching and
queues, a managed MySQL host, paid monitoring, push notifications, a paid maps API.

---

## Before launch

The legal text in Phase 7 is a starting point, not advice. **Have a lawyer review the Terms,
Privacy policy, Refund policy, Community guidelines and Child safety policy** against the DPDP
Act 2023 and the IT Act intermediary rules before this goes live, and have a chartered
accountant confirm the GST treatment.
