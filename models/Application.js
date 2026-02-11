const mongoose = require("mongoose");

const ApplicationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    instagram: { type: String, required: true, trim: true },
    niche: { type: String, required: true, trim: true },

    status: {
      type: String,
      enum: ["new", "reviewing", "approved", "rejected"],
      default: "new"
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Application", ApplicationSchema);
