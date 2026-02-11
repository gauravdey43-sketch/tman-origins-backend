const mongoose = require("mongoose");

const AdminSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },

    resetTokenHash: { type: String, default: "" },
    resetTokenExpires: { type: Date, default: null }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Admin", AdminSchema);
