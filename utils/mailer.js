const nodemailer = require("nodemailer");

function getTransporter() {
  const port = Number(process.env.SMTP_PORT || 465);
  const secure =
    process.env.SMTP_SECURE === "true" || port === 465;

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
}

async function sendMail({ to, subject, html }) {
  const transporter = getTransporter();

  const from =
    process.env.SMTP_USER
      ? `TMan Origins <${process.env.SMTP_USER}>`
      : "TMan Origins";

  await transporter.sendMail({ from, to, subject, html });
}

module.exports = { sendMail };
