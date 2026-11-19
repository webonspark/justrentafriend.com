const express = require("express");
const service = require("./discover.service");
const { wrap } = require("../../lib/handler");
const { requireAuth, requireActiveMembership } = require("../../middleware/auth");

/**
 *   GET /discover        search live Companions (membership required)
 *   GET /discover/areas  areas with listed Companions, for the filter
 */
const router = express.Router();

router.get("/", requireAuth, requireActiveMembership, wrap(async (req, res) => res.json(await service.search(req.user, req.query))));
router.get("/areas", wrap(async (req, res) => res.json({ areas: await service.areas(req.query.city) })));

module.exports = router;
