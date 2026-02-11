const mongoose = require("mongoose");

const CreatorSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    bio: { type: String, required: true },

    instagram: { type: String, default: "" },
    handle: { type: String, default: "" },
    featured: { type: Boolean, default: false },

    // cover image (shown on cards/home)
    image: { type: String, default: "" },

    // gallery images
    images: { type: [String], default: [] },

    emailSlug: { type: String, default: "" }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Creator", CreatorSchema);
