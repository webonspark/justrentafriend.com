const sequelize = require("../config/db");
require("../models");
const { logger } = require("../lib/logger");

/**
 * Creates the tables, and brings an existing database up to date.
 *
 *   npm run db:migrate            add anything missing, touch nothing else
 *   npm run db:migrate -- --force drop every table and build them again
 *
 * Without --force this never drops or renames anything. On top of creating
 * missing tables it:
 *   - adds columns a model has but the table does not
 *   - widens ENUM columns that gained new values (e.g. a new booking status)
 *   - adds any new admin setting, keeping the values already saved
 * Existing rows and values are left exactly as they are.
 *
 * `--force` destroys data. It refuses to run in production.
 */

const force = process.argv.includes("--force");

/** The quoted values of a MySQL ENUM type string: ENUM('a','b') → ["a","b"]. */
function enumValues(typeString) {
  const out = [];
  const re = /'((?:[^']|'')*)'/g;
  let m;
  while ((m = re.exec(String(typeString)))) out.push(m[1].replace(/''/g, "'"));
  return out;
}

async function upgrade() {
  const qi = sequelize.getQueryInterface();
  const isMySql = sequelize.getDialect() === "mysql";
  const changes = [];

  for (const model of Object.values(sequelize.models)) {
    const table = model.getTableName();
    const columns = await qi.describeTable(table);

    for (const attr of Object.values(model.rawAttributes)) {
      const field = attr.field;
      const definition = { type: attr.type, allowNull: attr.allowNull !== false };
      if (attr.defaultValue !== undefined) definition.defaultValue = attr.defaultValue;

      if (!columns[field]) {
        await qi.addColumn(table, field, definition);
        changes.push(`${table}.${field} added`);
        continue;
      }

      if (isMySql && attr.type.key === "ENUM") {
        const have = enumValues(columns[field].type);
        const want = attr.type.values;
        const missing = want.filter((v) => !have.includes(v));
        if (missing.length) {
          // Keep any value the database has that the model dropped, so no
          // existing row becomes invalid.
          const values = [...want, ...have.filter((v) => !want.includes(v))];
          await qi.changeColumn(table, field, { ...definition, type: sequelize.Sequelize.ENUM(...values) });
          changes.push(`${table}.${field} now allows ${missing.join(", ")}`);
        }
      }
    }
  }
  return changes;
}

(async () => {
  try {
    if (force && process.env.NODE_ENV === "production") {
      throw new Error("--force will not run in production.");
    }

    await sequelize.authenticate();
    logger.info(`Connected (${sequelize.getDialect()}). Building the schema…`);

    await sequelize.sync({ force });
    const changes = force ? [] : await upgrade();
    const newSettings = await require("../lib/settings").ensureDefaults();
    if (newSettings.length) changes.push(`settings added: ${newSettings.join(", ")}`);

    const message = force
      ? "Every table was dropped and rebuilt."
      : changes.length
        ? `The schema is up to date. Changes: ${changes.join("; ")}.`
        : "The schema is up to date. Nothing needed changing.";
    logger.info(message);
    console.log(message);
    process.exit(0);
  } catch (err) {
    logger.error(`Migration failed: ${err.message}`);
    console.error(`Migration failed: ${err.message}`);
    process.exit(1);
  }
})();
