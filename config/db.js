const mongoose = require("mongoose");

async function connectDB(uri) {
  try {
    mongoose.set("strictQuery", true);
    await mongoose.connect(uri);
    console.log("✅ MongoDB connected");
  } catch (err) {
    console.error("❌ MongoDB connect error:", err.message);
    process.exit(1);
  }
}

module.exports = connectDB;
