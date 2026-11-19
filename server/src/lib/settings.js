const { Setting } = require("../models");

/**
 * Admin-editable settings, read through a short cache.
 *
 * Commission, cancellation windows and GST flags live in the settings table
 * so an admin can change them without a deploy. A 30-second cache keeps a
 * busy booking page from reading the table on every request; saving a
 * setting clears it at once.
 */

let cache = null;
let loadedAt = 0;
const TTL_MS = 30 * 1000;

async function all() {
  if (cache && Date.now() - loadedAt < TTL_MS) return cache;
  const rows = await Setting.findAll();
  cache = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  loadedAt = Date.now();
  return cache;
}

async function get(key, fallback) {
  const values = await all();
  return values[key] === undefined ? fallback : values[key];
}

function clear() {
  cache = null;
}

module.exports = { all, get, clear };
