const nodemailer = require("nodemailer");
const axios = require("axios");
const sgMail = require("@sendgrid/mail");
const { readConfig } = require("./configStore");

const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5177";

let transporter = null;
if (process.env.SMTP_HOST) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === "true",
    auth: process.env.SMTP_USER
      ? {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        }
      : undefined,
  });
}

// configure sendgrid from config file if present
try {
  const cfg = readConfig();
  const sgKey = (process.env.SENDGRID_API_KEY) || (cfg?.smtp?.pass && cfg?.smtp?.user === 'apikey' ? cfg.smtp.pass : undefined);
  if (sgKey) {
    sgMail.setApiKey(sgKey);
  }
} catch (err) {
  // ignore
}

async function sendEmail({ to, subject, text, html }) {
  // Prefer SendGrid if configured
  try {
    if (sgMail && sgMail.send) {
      const cfg = readConfig();
      const from = (process.env.EMAIL_FROM) || (cfg?.smtp?.from) || 'no-reply@example.com';
      const res = await sgMail.send({ to, from, subject, text, html });
      console.log('SendGrid send response', Array.isArray(res) ? res.map(r => ({ statusCode: r.statusCode, headers: r.headers })) : res);
      return;
    }
  } catch (err) {
    console.error('SendGrid send failed, falling back to SMTP', err?.response || err.message || err);
  }

  if (!transporter) {
    console.log("Email not sent (no SMTP configured).", { to, subject, text });
    return;
  }

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || 'no-reply@example.com',
      to,
      subject,
      text,
      html,
    });
  } catch (err) {
    console.error("Error sending email via SMTP", err);
  }
}

// Teams support removed — system now uses email only.

function buildGoalDeepLink(goalId, role = 'manager') {
  // deep link to manager view with goal focused
  return `${CLIENT_URL}/${role === 'manager' ? 'manager' : ''}?goalId=${goalId}`;
}

module.exports = { sendEmail, buildGoalDeepLink };
