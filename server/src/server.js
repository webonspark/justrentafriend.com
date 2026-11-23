const http = require("http");
const cron = require("node-cron");
const { Server: SocketServer } = require("socket.io");
const { Op } = require("sequelize");
const app = require("./app");
const env = require("./config/env");
const sequelize = require("./config/db");
const { User } = require("./models");
const { purgeExpiredOtps } = require("./lib/otp");
const { logger } = require("./lib/logger");
const realtime = require("./lib/realtime");
const { verifyAccessToken } = require("./lib/tokens");
const { sweep } = require("./modules/bookings/booking.service");
const { purgeDeleted } = require("./modules/account/account.routes");

/**
 * Starts the server, and the handful of jobs that have to run on a clock.
 *
 * node-cron rather than a queue: it needs nothing installed and nothing paid
 * for, which is what this version calls for. If the work ever outgrows one
 * process, these move to a worker without the rest of the app noticing.
 */

/** Hides anybody whose membership ran out while nobody was looking. */
async function expireMemberships() {
  const [count] = await User.update(
    { membershipStatus: "expired" },
    {
      where: {
        membershipStatus: "active",
        membershipExpiresAt: { [Op.lt]: new Date() },
      },
    }
  );
  if (count) logger.info(`${count} membership${count === 1 ? "" : "s"} expired.`);
}

function scheduleJobs() {
  // Every hour, on the hour.
  cron.schedule("0 * * * *", () => {
    expireMemberships().catch((e) => logger.error(`Membership sweep failed: ${e.message}`));
  });

  // Bookings: expiries, reminders, auto-completion and payout release.
  cron.schedule("*/5 * * * *", () => {
    sweep().catch((e) => logger.error(`Booking sweep failed: ${e.message}`));
  });

  // Accounts deleted more than 30 days ago are erased.
  cron.schedule("40 3 * * *", () => {
    purgeDeleted().catch((e) => logger.error(`Deletion purge failed: ${e.message}`));
  });

  // Nightly, well away from the busy hours.
  cron.schedule("20 3 * * *", () => {
    purgeExpiredOtps().catch((e) => logger.error(`OTP purge failed: ${e.message}`));
  });
}

/**
 * Connecting is not the same as being set up.
 *
 * An empty database answers authenticate() perfectly happily, and the first
 * request then dies with "no such table: users" — a 500 that says nothing
 * useful to whoever is standing there. Checking here turns a confusing
 * runtime failure into one line at boot naming the command to run.
 */
async function checkSchema() {
  const tables = await sequelize.getQueryInterface().showAllTables();
  const names = tables.map((t) => String(t.tableName || t).toLowerCase());
  if (!names.includes("users")) {
    throw new Error("no tables");
  }
}

async function start() {
  try {
    await sequelize.authenticate();
    logger.info(`Database ready (${env.db.dialect}).`);
  } catch (err) {
    logger.error(
      `Cannot reach the database: ${err.message}\n` +
        `Check DB_HOST, DB_NAME, DB_USER and DB_PASSWORD in .env, and that MySQL is running.`
    );
    process.exit(1);
  }

  try {
    await checkSchema();
  } catch {
    logger.error(
      `The database "${env.db.name}" has no tables yet.\n` +
        `Run this first:\n` +
        `    npm run db:migrate     create the tables\n` +
        `    npm run db:seed        add the sample admin, members and bookings`
    );
    process.exit(1);
  }

  await expireMemberships().catch(() => {});
  scheduleJobs();

  /* Socket.IO for live chat and notifications. A socket signs in with the
     same access token as the API and joins its own room, user:<id>. */
  const server = http.createServer(app);
  const io = new SocketServer(server, { cors: { origin: env.clientUrl, credentials: true } });
  io.use((socket, next) => {
    try {
      const claims = verifyAccessToken(socket.handshake.auth?.token || "");
      if (claims.kind !== "user" || claims.imp) return next(new Error("unauthorized"));
      socket.data.userId = claims.sub;
      return next();
    } catch {
      return next(new Error("unauthorized"));
    }
  });
  io.on("connection", (socket) => socket.join(`user:${socket.data.userId}`));
  realtime.attach(io);

  await sweep().catch((e) => logger.error(`Booking sweep failed: ${e.message}`));

  server.listen(env.port, () => {
    logger.info(`${env.brand.name} API on http://localhost:${env.port} (${env.nodeEnv})`);
    if (env.mail.transport !== "smtp") {
      logger.info("Email is going to this console — OTPs will print here.");
    }
  });
}

/* A rejected promise nobody caught is a bug; say so loudly rather than
   carrying on in an unknown state. */
process.on("unhandledRejection", (reason) => {
  logger.error(`Unhandled rejection: ${reason?.stack || reason}`);
});

start();
