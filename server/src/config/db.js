const { Sequelize } = require("sequelize");
const env = require("./env");

/**
 * One Sequelize connection for the whole server.
 *
 * MySQL is the real target — distance search uses ST_Distance_Sphere, which
 * only MySQL has. DB_DIALECT=sqlite is a convenience for trying the app out
 * with nothing installed; Discovery falls back to the Haversine formula
 * there, so the rest of the app still works.
 */

const common = {
  logging: env.isProd ? false : (sql) => {
    // One line per statement in development, without the parameter dump.
    if (process.env.DB_LOG === "1") console.log(sql);
  },
  define: {
    underscored: true,     // created_at, not createdAt, in the database
    freezeTableName: false,
    charset: "utf8mb4",
    collate: "utf8mb4_unicode_ci",
  },
  pool: { max: 10, min: 0, acquire: 30000, idle: 10000 },
};

const sequelize =
  env.db.dialect === "sqlite"
    ? new Sequelize({ dialect: "sqlite", storage: env.db.storage, ...common })
    : new Sequelize(env.db.name, env.db.user, env.db.password, {
        host: env.db.host,
        port: env.db.port,
        dialect: "mysql",
        dialectOptions: { dateStrings: true, typeCast: true },
        timezone: "+05:30", // India, so stored times read correctly in MySQL
        ...common,
      });

/** True when the server is talking to real MySQL, not the SQLite stand-in. */
sequelize.isMySql = env.db.dialect !== "sqlite";

module.exports = sequelize;
