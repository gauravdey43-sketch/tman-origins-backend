const express = require("express");
const Application = require("../models/Application");
const adminAuth = require("../middleware/adminAuth");

const router = express.Router();

/* =========================
   PUBLIC: Submit application
   POST /api/applications
   ========================= */
router.post("/", async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    const email = String(req.body.email || "").toLowerCase().trim();
    const instagram = String(req.body.instagram || "").trim();
    const niche = String(req.body.niche || "").trim();

    if (!name || !email || !instagram || !niche) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // basic instagram validation (soft)
    if (!instagram.includes("instagram.com")) {
      // don't block hard, but you can if you want
      // return res.status(400).json({ message: "Instagram link must include instagram.com" });
    }

    const created = await Application.create({
      name,
      email,
      instagram,
      niche
    });

    res.status(201).json(created);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

/* =========================
   ADMIN: List applications
   GET /api/applications
   ========================= */
router.get("/", adminAuth, async (req, res) => {
  try {
    const items = await Application.find().sort({ createdAt: -1 });
    res.json(items);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

/* =========================
   ADMIN: Update status
   PUT /api/applications/:id/status
   body: { status }
   ========================= */
router.put("/:id/status", adminAuth, async (req, res) => {
  try {
    const status = String(req.body.status || "").trim();

    const allowed = ["new", "reviewing", "approved", "rejected"];
    if (!allowed.includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const app = await Application.findById(req.params.id);
    if (!app) return res.status(404).json({ message: "Application not found" });

    app.status = status;
    await app.save();

    res.json(app);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

/* =========================
   ADMIN: Delete application
   DELETE /api/applications/:id
   ========================= */
router.delete("/:id", adminAuth, async (req, res) => {
  try {
    const app = await Application.findById(req.params.id);
    if (!app) return res.status(404).json({ message: "Application not found" });

    await app.deleteOne();
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

module.exports = router;
