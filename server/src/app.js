const path = require("path");
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const env = require("./config/env");
const routes = require("./routes");
const { apiLimiter } = require("./middleware/rateLimit");
const { notFound, errorHandler } = require("./middleware/errorHandler");

/**
 * The Express app, kept apart from the thing that listens on a port so the
 * test suite can drive it without opening a socket.
 */

const app = express();

// Behind a proxy on a free host, so req.ip is the real caller.
app.set("trust proxy", 1);

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }, // uploads served to the client origin
    contentSecurityPolicy: env.isProd ? undefined : false,
  })
);

app.use(
  cors({
    origin: env.clientUrl,
    credentials: true, // the refresh cookie has to travel
  })
);

// 25mb would be generous; photos go through multer, not JSON.
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(cookieParser());

app.use(`/${env.uploads.dir}`, express.static(path.join(process.cwd(), env.uploads.dir), {
  maxAge: "7d",
}));

app.use("/api", apiLimiter, routes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
