const nodemailer = require("nodemailer");
const env = require("../config/env");
const { logger } = require("./logger");

/**
 * Email, with no account needed to develop against.
 *
 * MAIL_TRANSPORT=console prints the message to the terminal instead of
 * sending it, so a fresh clone can run the whole sign-up and password-reset
 * flow offline. Set it to "smtp" with Gmail or a free Brevo plan to send for
 * real; nothing else in the app changes.
 */

let transport = null;

function getTransport() {
  if (env.mail.transport !== "smtp") return null;
  if (transport) return transport;

  transport = nodemailer.createTransport({
    host: env.mail.host,
    port: env.mail.port,
    secure: env.mail.port === 465,
    auth: env.mail.user ? { user: env.mail.user, pass: env.mail.pass } : undefined,
  });
  return transport;
}

async function sendMail({ to, subject, text, html }) {
  if (env.mail.transport !== "smtp") {
    logger.info(
      `\n──────── email (not sent, console transport) ────────\n` +
        `To:      ${to}\n` +
        `Subject: ${subject}\n\n${text}\n` +
        `─────────────────────────────────────────────────────\n`
    );
    return { delivered: false, preview: text };
  }

  await getTransport().sendMail({ from: env.mail.from, to, subject, text, html });
  return { delivered: true };
}

/* ---- the messages this app sends ---- */

const shell = (title, body) => `
  <div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#0B0B0F;color:#EDEAF2;border-radius:20px">
    <p style="margin:0 0 24px;font-weight:800;font-size:18px;letter-spacing:-0.02em">${env.brand.name}</p>
    <h1 style="margin:0 0 12px;font-size:20px;font-weight:700">${title}</h1>
    ${body}
    <p style="margin:28px 0 0;font-size:12px;color:#8D8A9B">
      If you did not ask for this, you can ignore it — nothing has changed.
    </p>
  </div>`;

const codeBlock = (code) => `
  <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#B9B5C6">
    Your code is below. It works for the next ${env.otp.ttlMinutes} minutes.
  </p>
  <p style="margin:0;font-size:32px;font-weight:800;letter-spacing:8px;color:#F0567A">${code}</p>`;

function sendVerifyEmail(to, name, code) {
  return sendMail({
    to,
    subject: `${code} is your ${env.brand.name} verification code`,
    text: `Hi ${name},\n\nYour ${env.brand.name} verification code is ${code}.\nIt expires in ${env.otp.ttlMinutes} minutes.\n\nIf you did not sign up, ignore this email.`,
    html: shell(`Confirm your email`, codeBlock(code)),
  });
}

function sendResetEmail(to, name, code) {
  return sendMail({
    to,
    subject: `${code} is your ${env.brand.name} password reset code`,
    text: `Hi ${name},\n\nUse ${code} to set a new ${env.brand.name} password.\nIt expires in ${env.otp.ttlMinutes} minutes.\n\nIf you did not ask to reset it, ignore this email and your password stays as it is.`,
    html: shell("Set a new password", codeBlock(code)),
  });
}

module.exports = { sendMail, sendVerifyEmail, sendResetEmail };
