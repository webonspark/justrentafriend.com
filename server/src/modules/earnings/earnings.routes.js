const express = require("express");
const { Op } = require("sequelize");
const { Payout, Booking, PayoutAccount, User } = require("../../models");
const { wrap } = require("../../lib/handler");
const { requireAuth, requireRole } = require("../../middleware/auth");
const { releasePayout } = require("../bookings/booking.service");

/**
 * The Companion's payout dashboard.
 *
 *   GET /earnings   totals (held in escrow, on hold, paid) and every payout
 */
const router = express.Router();
router.use(requireAuth, requireRole("companion"));

router.get(
  "/",
  wrap(async (req, res) => {
    const id = req.user.id;
    // Payouts that were held for a missing account or KYC go out now if fixed.
    const held = await Payout.findAll({ where: { companionId: id, status: "on_hold", amountPaise: { [Op.gt]: 0 }, note: { [Op.notIn]: ["Disputed", "Refunded to Customer after dispute"] } } });
    for (const p of held) await releasePayout(p.bookingId);

    const [payouts, escrow, account, me] = await Promise.all([
      Payout.findAll({
        where: { companionId: id },
        include: [{ model: Booking, as: "booking", attributes: ["id", "startAt", "hours", "amountPaise", "commissionPaise", "status"] }],
        order: [["createdAt", "DESC"]],
      }),
      Booking.findAll({ where: { companionId: id, status: { [Op.in]: ["confirmed", "in_progress", "disputed"] } }, attributes: ["payoutPaise"] }),
      PayoutAccount.findOne({ where: { companionId: id } }),
      User.findByPk(id, { attributes: ["kycStatus"] }),
    ]);
    const sum = (rows, f = "amountPaise") => rows.reduce((n, r) => n + Number(r[f]), 0);
    res.json({
      totals: {
        inEscrowPaise: sum(escrow, "payoutPaise"),
        onHoldPaise: sum(payouts.filter((p) => ["on_hold", "pending", "approved", "failed"].includes(p.status))),
        paidPaise: sum(payouts.filter((p) => p.status === "paid")),
        thisMonthPaise: sum(payouts.filter((p) => p.status === "paid" && new Date(p.paidAt).getMonth() === new Date().getMonth() && new Date(p.paidAt).getFullYear() === new Date().getFullYear())),
      },
      payoutAccount: account ? { method: account.method, upiId: account.upiId, accountLast4: account.accountLast4, ifsc: account.ifsc } : null,
      kycStatus: me.kycStatus,
      payouts: payouts.map((p) => ({
        id: p.id,
        bookingId: p.bookingId,
        amountPaise: Number(p.amountPaise),
        status: p.status,
        reference: p.bankReference,
        note: p.note,
        paidAt: p.paidAt,
        createdAt: p.createdAt,
        booking: p.booking ? { startAt: p.booking.startAt, hours: Number(p.booking.hours), amountPaise: Number(p.booking.amountPaise), commissionPaise: Number(p.booking.commissionPaise) } : null,
      })),
    });
  })
);

module.exports = router;
