const sequelize = require("../config/db");
require("../models");
const { logger } = require("../lib/logger");

/**
 * Creates the tables.
 *
 *   npm run db:migrate            add anything missing, touch nothing else
 *   npm run db:migrate -- --force drop every table and build them again
 *
 * `--force` destroys data. It refuses to run in production.
 */

const force = process.argv.includes("--force");

(async () => {
  try {
    if (force && process.env.NODE_ENV === "production") {
      throw new Error("--force will not run in production.");
    }

    await sequelize.authenticate();
    logger.info(`Connected (${sequelize.getDialect()}). Building the schema…`);

    await sequelize.sync({ force });

    logger.info(
      force
        ? "Every table was dropped and rebuilt."
        : "The schema is up to date. Nothing existing was altered."
    );
    process.exit(0);
  } catch (err) {
    logger.error(`Migration failed: ${err.message}`);
    process.exit(1);
  }
})();
