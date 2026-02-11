const express = require("express");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const nodemailer = require("nodemailer");
const Admin = require("../models/Admin");

const router = express.Router();

function sha256(input) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

/* =========================
   Seed admin if missing
   ========================= */
async function ensureAdminSeed() {
  const email = String(process.env.ADMIN_EMAIL || "").toLowerCase().trim();
  const password = String(process.env.ADMIN_PASSWORD || "").trim();

  if (!email || !password) {
    console.log("⚠️ ADMIN_EMAIL / ADMIN_PASSWORD missing. Admin seed skipped.");
    return;
  }

  const exists = await Admin.findOne({ email });
  if (exists) {
    console.log("✅ Admin exists:", email);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await Admin.create({ email, passwordHash });
  console.log("✅ Admin seeded:", email);
}

/* =========================
   Cookie helpers
   ========================= */
function cookieOptions() {
  const isProd = process.env.NODE_ENV === "production";

  // For production:
  // - secure: true (HTTPS)
  // - sameSite: "none" (so frontend+backend on different domains can still send cookie)
  // For local dev:
  // - secure: false
  // - sameSite: "lax"
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  };
}

function setAdminCookie(res) {
  res.cookie("TMAN_ADMIN", "ok", cookieOptions());
}

function clearAdminCookie(res) {
  res.clearCookie("TMAN_ADMIN", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax"
  });
}

/* =========================
   Admin auth middleware
   ========================= */
function adminAuth(req, res, next) {
  if (req.cookies?.TMAN_ADMIN === "ok") return next();
  return res.status(401).json({ message: "Unauthorized" });
}

/* =========================
   ME (session check)
   ========================= */
router.get("/me", (req, res) => {
  if (req.cookies?.TMAN_ADMIN === "ok") return res.json({ ok: true });
  return res.status(401).json({ message: "Unauthorized" });
});

/* =========================
   LOGIN
   ========================= */
router.post("/login", async (req, res) => {
  try {
    const email = String(req.body.email || "").toLowerCase().trim();
    const password = String(req.body.password || "");

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password required" });
    }

    const admin = await Admin.findOne({ email });
    if (!admin) return res.status(401).json({ message: "Invalid credentials" });

    const ok = await bcrypt.compare(password, admin.passwordHash);
    if (!ok) return res.status(401).json({ message: "Invalid credentials" });

    setAdminCookie(res);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

/* =========================
   LOGOUT
   ========================= */
router.post("/logout", async (req, res) => {
  clearAdminCookie(res);
  res.json({ ok: true });
});

/* =========================
   FORGOT PASSWORD
   ========================= */
router.post("/forgot", async (req, res) => {
  try {
    const email = String(req.body.email || "").toLowerCase().trim();
    if (!email) return res.status(400).json({ message: "Email required" });

    const admin = await Admin.findOne({ email });

    // Always return ok (do not leak whether admin exists)
    if (!admin) return res.json({ ok: true });

    const rawToken = crypto.randomBytes(32).toString("hex");
    admin.resetTokenHash = sha256(rawToken);
    admin.resetTokenExpires = new Date(Date.now() + 30 * 60 * 1000); // 30 mins
    await admin.save();

    // SMTP config check
    const host = process.env.SMTP_HOST;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    // If SMTP not configured: log token (dev), but still return ok
    if (!host || !user || !pass) {
      console.log("⚠️ SMTP not configured. Reset token (dev):", rawToken);
      return res.json({ ok: true });
    }

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 465),
      secure: String(process.env.SMTP_SECURE || "true") === "true",
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    });

    const clientOrigin = process.env.CLIENT_ORIGIN || "http://localhost:3000";
    const resetLink = `${clientOrigin}/admin/reset?token=${rawToken}&email=${encodeURIComponent(
      email
    )}`;

    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: email,
      subject: "TMan Origins Admin Password Reset",
      text: `Reset your password: ${resetLink}`,
      html: `<p>Reset your password:</p><p><a href="${resetLink}">${resetLink}</a></p>`
    });

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

/* =========================
   RESET PASSWORD
   body: { email, token, newPassword }
   ========================= */
router.post("/reset", async (req, res) => {
  try {
    const email = String(req.body.email || "").toLowerCase().trim();
    const token = String(req.body.token || "").trim();
    const newPassword = String(req.body.newPassword || "").trim();

    if (!email || !token || !newPassword) {
      return res
        .status(400)
        .json({ message: "email, token, newPassword required" });
    }

    // basic strength rule (you can make stricter later)
    if (newPassword.length < 8) {
      return res.status(400).json({ message: "Password must be at least 8 characters" });
    }

    const admin = await Admin.findOne({ email });
    if (!admin) return res.status(400).json({ message: "Invalid reset request" });

    if (!admin.resetTokenHash || !admin.resetTokenExpires) {
      return res.status(400).json({ message: "Reset not requested" });
    }

    if (admin.resetTokenExpires.getTime() < Date.now()) {
      return res.status(400).json({ message: "Reset token expired" });
    }

    if (sha256(token) !== admin.resetTokenHash) {
      return res.status(400).json({ message: "Invalid reset token" });
    }

    admin.passwordHash = await bcrypt.hash(newPassword, 12);
    admin.resetTokenHash = "";
    admin.resetTokenExpires = null;
    await admin.save();

    // Auto-login after reset
    setAdminCookie(res);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

module.exports = { router, ensureAdminSeed, adminAuth };
