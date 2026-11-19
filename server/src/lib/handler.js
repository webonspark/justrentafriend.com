/** Lets a route handler be a plain async function: errors go to next(). */
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/** Page/limit from a query string, clamped. */
function paging(query, { max = 50, def = 20 } = {}) {
  const limit = Math.min(Math.max(Number.parseInt(query.limit, 10) || def, 1), max);
  const page = Math.max(Number.parseInt(query.page, 10) || 1, 1);
  return { limit, page, offset: (page - 1) * limit };
}

module.exports = { wrap, paging };
