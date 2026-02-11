const express = require("express");
const fs = require("fs");
const path = require("path");
const Creator = require("../models/Creator");
const upload = require("../middleware/upload");
const adminAuth = require("../middleware/adminAuth");

const router = express.Router();

const MAX_IMAGES_TOTAL = 20; // gallery cap per creator
const MAX_UPLOAD_PER_REQ = 8; // must match upload.array("images", 8)

/* =========================
   Helpers
   ========================= */
function safeDeleteUploadFile(imagePath) {
  try {
    if (!imagePath) return;
    if (!imagePath.startsWith("/uploads/")) return;

    const filename = path.basename(imagePath);
    const fullPath = path.join(__dirname, "..", "uploads", filename);

    if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
  } catch (err) {
    console.log("⚠️ Image delete failed:", err.message);
  }
}

function uniq(arr) {
  return Array.from(new Set((arr || []).filter(Boolean)));
}

function normalizeSlug(slug) {
  return String(slug || "").toLowerCase().trim();
}

function trimStr(v) {
  return String(v ?? "").trim();
}

/* =========================
   GET all creators (PUBLIC)
   ========================= */
router.get("/", async (req, res) => {
  try {
    const creators = await Creator.find().sort({ featured: -1, createdAt: -1 });
    res.json(creators);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

/* =========================
   GET creator by slug (PUBLIC)
   ========================= */
router.get("/slug/:slug", async (req, res) => {
  try {
    const slug = normalizeSlug(req.params.slug);
    const creator = await Creator.findOne({ slug });
    if (!creator) return res.status(404).json({ message: "Creator not found" });
    res.json(creator);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

/* =========================
   POST create creator (ADMIN)
   field name: images
   ========================= */
router.post("/", adminAuth, upload.array("images", MAX_UPLOAD_PER_REQ), async (req, res) => {
  try {
    const name = trimStr(req.body.name);
    const slug = normalizeSlug(req.body.slug);
    const bio = trimStr(req.body.bio);

    const instagram = trimStr(req.body.instagram);
    const handle = trimStr(req.body.handle);
    const emailSlug = trimStr(req.body.emailSlug);

    const featured = req.body.featured === true || req.body.featured === "true";

    if (!name || !slug || !bio) {
      return res.status(400).json({ message: "name, slug, bio are required" });
    }

    const exists = await Creator.findOne({ slug });
    if (exists) return res.status(409).json({ message: "Slug already exists" });

    const uploaded = (req.files || []).map((f) => `/uploads/${f.filename}`);
    const images = uniq(uploaded).slice(0, MAX_IMAGES_TOTAL);

    const created = await Creator.create({
      name,
      slug,
      bio,
      instagram,
      handle,
      featured,
      emailSlug,
      images,
      image: images[0] || "" // cover
    });

    res.status(201).json(created);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

/* =========================
   PUT update creator (ADMIN)
   - Append images (up to MAX_IMAGES_TOTAL)
   - Update fields
   ========================= */
router.put("/:id", adminAuth, upload.array("images", MAX_UPLOAD_PER_REQ), async (req, res) => {
  try {
    const creator = await Creator.findById(req.params.id);
    if (!creator) return res.status(404).json({ message: "Creator not found" });

    // 1) append new images
    const newImages = (req.files || []).map((f) => `/uploads/${f.filename}`);
    if (newImages.length) {
      const combined = uniq([...(creator.images || []), ...newImages]);

      // cap total
      creator.images = combined.slice(0, MAX_IMAGES_TOTAL);

      // if no cover, set it
      if (!creator.image) creator.image = creator.images[0] || "";

      // ensure cover is in gallery
      if (creator.image) creator.images = uniq([creator.image, ...(creator.images || [])]).slice(
        0,
        MAX_IMAGES_TOTAL
      );
    }

    // 2) update text fields
    if (req.body.name !== undefined) {
      const v = trimStr(req.body.name);
      if (!v) return res.status(400).json({ message: "name cannot be empty" });
      creator.name = v;
    }

    if (req.body.slug !== undefined) {
      const nextSlug = normalizeSlug(req.body.slug);
      if (!nextSlug) return res.status(400).json({ message: "slug cannot be empty" });

      // slug uniqueness check (exclude self)
      const exists = await Creator.findOne({ slug: nextSlug, _id: { $ne: creator._id } });
      if (exists) return res.status(409).json({ message: "Slug already exists" });

      creator.slug = nextSlug;
    }

    if (req.body.bio !== undefined) {
      const v = trimStr(req.body.bio);
      if (!v) return res.status(400).json({ message: "bio cannot be empty" });
      creator.bio = v;
    }

    if (req.body.instagram !== undefined) creator.instagram = trimStr(req.body.instagram);
    if (req.body.handle !== undefined) creator.handle = trimStr(req.body.handle);
    if (req.body.emailSlug !== undefined) creator.emailSlug = trimStr(req.body.emailSlug);

    if (req.body.featured !== undefined) {
      creator.featured = req.body.featured === true || req.body.featured === "true";
    }

    await creator.save();
    res.json(creator);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

/* =========================
   PUT set cover image (ADMIN)
   body: { image: "/uploads/..." }
   ========================= */
router.put("/:id/cover", adminAuth, express.json(), async (req, res) => {
  try {
    const creator = await Creator.findById(req.params.id);
    if (!creator) return res.status(404).json({ message: "Creator not found" });

    const img = trimStr(req.body.image);
    if (!img.startsWith("/uploads/")) {
      return res.status(400).json({ message: "Invalid image path" });
    }

    const all = uniq([...(creator.images || []), creator.image].filter(Boolean));
    if (!all.includes(img)) {
      return res.status(400).json({ message: "Image not found in this creator gallery" });
    }

    creator.image = img;
    creator.images = uniq([img, ...(creator.images || [])]).slice(0, MAX_IMAGES_TOTAL);

    await creator.save();
    res.json(creator);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

/* =========================
   DELETE one image (ADMIN)
   body: { image: "/uploads/..." }
   If deleting cover -> cover becomes first remaining
   ========================= */
router.delete("/:id/images", adminAuth, express.json(), async (req, res) => {
  try {
    const creator = await Creator.findById(req.params.id);
    if (!creator) return res.status(404).json({ message: "Creator not found" });

    const img = trimStr(req.body.image);
    if (!img.startsWith("/uploads/")) {
      return res.status(400).json({ message: "Invalid image path" });
    }

    // must exist in gallery or as cover
    const all = uniq([...(creator.images || []), creator.image].filter(Boolean));
    if (!all.includes(img)) {
      return res.status(400).json({ message: "Image not found in this creator gallery" });
    }

    // remove from images list
    creator.images = (creator.images || []).filter((p) => p !== img);

    // delete file (simple)
    safeDeleteUploadFile(img);

    // if cover removed -> set new cover
    if (creator.image === img) {
      creator.image = creator.images[0] || "";
    }

    // ensure cover in gallery
    if (creator.image) {
      creator.images = uniq([creator.image, ...(creator.images || [])]).slice(0, MAX_IMAGES_TOTAL);
    }

    await creator.save();
    res.json(creator);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

/* =========================
   DELETE creator (ADMIN)
   ========================= */
router.delete("/:id", adminAuth, async (req, res) => {
  try {
    const creator = await Creator.findById(req.params.id);
    if (!creator) return res.status(404).json({ message: "Creator not found" });

    // delete cover + gallery files
    safeDeleteUploadFile(creator.image);
    (creator.images || []).forEach(safeDeleteUploadFile);

    await creator.deleteOne();
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

module.exports = router;
