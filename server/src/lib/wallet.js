const { sequelize, User, WalletTxn } = require("../models");
const { badRequest } = require("./errors");

/**
 * The only way a wallet balance changes.
 *
 * Each change locks the member's row, moves the balance and writes a
 * wallet_txns line with the balance after it — all in one transaction, so
 * two checkouts at once cannot spend the same rupee twice and the statement
 * always adds up to the balance.
 *
 * Amounts are paise: positive adds, negative spends. Spending more than the
 * balance is refused.
 */
async function change(userId, amountPaise, { kind, bookingId = null, paymentId = null, note = null, adminId = null }, outer = null) {
  const amount = Math.round(Number(amountPaise));
  if (!Number.isFinite(amount) || amount === 0) return null;

  const run = async (t) => {
    const user = await User.findByPk(userId, { transaction: t, lock: t.LOCK?.UPDATE });
    if (!user) throw badRequest("That account does not exist.");
    const next = Number(user.walletPaise || 0) + amount;
    if (next < 0) throw badRequest("There is not enough in the wallet for that.");
    await user.update({ walletPaise: next }, { transaction: t });
    return WalletTxn.create({ userId, kind, amountPaise: amount, balanceAfterPaise: next, bookingId, paymentId, note, adminId }, { transaction: t });
  };
  return outer ? run(outer) : sequelize.transaction(run);
}

const credit = (userId, amountPaise, meta, t) => change(userId, Math.abs(amountPaise), meta, t);
const debit = (userId, amountPaise, meta, t) => change(userId, -Math.abs(amountPaise), meta, t);

async function balance(userId) {
  const u = await User.findByPk(userId, { attributes: ["walletPaise"] });
  return Number(u?.walletPaise || 0);
}

async function statement(userId, { limit = 100 } = {}) {
  const rows = await WalletTxn.findAll({ where: { userId }, order: [["id", "DESC"]], limit });
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    amountPaise: Number(r.amountPaise),
    balanceAfterPaise: Number(r.balanceAfterPaise),
    bookingId: r.bookingId,
    note: r.note,
    at: r.createdAt,
  }));
}

module.exports = { credit, debit, balance, statement };
