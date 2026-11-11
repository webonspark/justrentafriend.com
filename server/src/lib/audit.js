const { AuditLog } = require("../models");
const { logger } = require("./logger");

/**
 * Writes down who did what.
 *
 * Called for every admin action, and for every look at something sensitive —
 * a KYC document, a bank detail, a private chat opened because of a report.
 * India's DPDP Act expects that trail to exist and to be complete.
 *
 * An audit write never fails the thing it was recording: if the log cannot
 * be written the request still succeeds and the problem is reported, because
 * losing a refund is worse than losing a log line.
 */
async function record(req, { action, entityType, entityId = null, detail = null, sensitive = false }) {
  try {
    const actor = req.admin || req.user || null;

    await AuditLog.create({
      actorType: req.admin ? "admin" : req.user ? "user" : "system",
      actorId: actor?.id || null,
      actorName: actor?.name || actor?.fullName || null,
      action,
      entityType,
      entityId,
      detail,
      wasSensitive: sensitive,
      ip: req.ip,
      userAgent: String(req.get("user-agent") || "").slice(0, 300),
    });
  } catch (err) {
    logger.error(`Could not write the audit log for "${action}": ${err.message}`);
  }
}

/** Shorthand for recording a look at personal data. */
const recordView = (req, what) => record(req, { ...what, sensitive: true });

module.exports = { record, recordView };
