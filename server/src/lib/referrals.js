const crypto = require("crypto");
const { Op } = require("sequelize");
const { sequelize, User } = require("../models");
const settings = require("./settings");
const wallet = require("./wallet");
const { notify } = require("./notify");
const { formatINR } = require("./money");
const { logger } = require("./logger");

/**
 * Refer a friend.
 *
 * Everyone gets a short code. A new member who signs up with it is linked to
 * whoever invited them. Once the new member's first meet is over and the
 * complaint window has passed with no dispute, both get wallet credit — once.
 * Waiting for that, rather than paying at sign-up, is what stops fake
 * accounts farming the reward.
 */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O, 1/I

async function ensureCode(user) {
  if (user.referralCode) return user.referralCode;
  const stem = String(user.fullName || "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4) || "JRAF";
  for (let i = 0; i < 8; i += 1) {
    const tail = Array.from({ length: 4 }, () => ALPHABET[crypto.randomInt(ALPHABET.length)]).join("");
    const code = `${stem}${tail}`;
    if (!(await User.findOne({ where: { referralCode: code }, attributes: ["id"] }))) {
      await user.update({ referralCode: code });
      return code;
    }
  }
  throw new Error("Could not make a referral code.");
}

/** At sign-up: link the new member to the referrer, if the code is real. */
async function attach(newUser, code, t) {
  const c = String(code || "").trim().toUpperCase();
  if (!c) return null;
  const referrer = await User.findOne({ where: { referralCode: c, status: { [Op.notIn]: ["banned", "deleted"] } }, transaction: t });
  if (!referrer || referrer.id === newUser.id) return null;
  await newUser.update({ referredById: referrer.id }, { transaction: t });
  return referrer;
}

/**
 * Pays the reward for a member whose meet just cleared, if it is due.
 * Safe to call for anyone, any number of times.
 */
async function rewardIfDue(userId) {
  const amount = Number(await settings.get("referral_reward_paise", 10000));
  const cap = Number(await settings.get("referral_max_rewards", 50));
  if (!amount) return false;

  return sequelize.transaction(async (t) => {
    const u = await User.findByPk(userId, { transaction: t, lock: t.LOCK?.UPDATE });
    if (!u || !u.referredById || u.referralRewardedAt) return false;
    const referrer = await User.findByPk(u.referredById, { transaction: t });
    if (!referrer || ["banned", "deleted"].includes(referrer.status)) return false;

    await u.update({ referralRewardedAt: new Date() }, { transaction: t });
    await wallet.credit(u.id, amount, { kind: "referral", note: `Welcome reward — invited by ${referrer.fullName.split(" ")[0]}` }, t);

    const paidSoFar = await User.count({ where: { referredById: referrer.id, referralRewardedAt: { [Op.ne]: null }, id: { [Op.ne]: u.id } }, transaction: t });
    const referrerPaid = paidSoFar < cap;
    if (referrerPaid) {
      await wallet.credit(referrer.id, amount, { kind: "referral", note: `Referral reward — ${u.fullName.split(" ")[0]} completed their first meet` }, t);
    }
    t.afterCommit(async () => {
      await notify(u.id, { type: "referral_reward", title: `${formatINR(amount)} added to your wallet`, body: "Thanks for joining through a friend. Use it on your next booking.", link: "/wallet" });
      if (referrerPaid) await notify(referrer.id, { type: "referral_reward", title: `${formatINR(amount)} referral reward`, body: `${u.fullName.split(" ")[0]} completed their first meet. The credit is in your wallet.`, link: "/wallet" });
    });
    logger.info(`Referral reward: user ${u.id}${referrerPaid ? ` and referrer ${referrer.id}` : " (referrer at cap)"}.`);
    return true;
  });
}

async function summary(user) {
  const code = await ensureCode(user);
  const invited = await User.findAll({ where: { referredById: user.id }, attributes: ["fullName", "createdAt", "referralRewardedAt"], order: [["id", "DESC"]], limit: 50 });
  return {
    code,
    rewardPaise: Number(await settings.get("referral_reward_paise", 10000)),
    invited: invited.map((i) => ({ name: i.fullName.split(" ")[0], joinedAt: i.createdAt, rewarded: Boolean(i.referralRewardedAt) })),
  };
}

module.exports = { ensureCode, attach, rewardIfDue, summary };
