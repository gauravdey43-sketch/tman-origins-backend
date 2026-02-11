const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");
const cookieParser = require("cookie-parser");

dotenv.config();

const connectDB = require("./config/db");
const creatorsRoute = require("./routes/creators");
const applicationsRoute = require("./routes/applications");
const { router: adminRoute, ensureAdminSeed } = require("./routes/admin");

const app = express();

app.set("trust proxy", 1);

app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || "http://localhost:3000",
    credentials: true
  })
);

app.use(express.json());
app.use(cookieParser());

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use("/api/creators", creatorsRoute);
app.use("/api/applications", applicationsRoute);
app.use("/api/admin", adminRoute);

app.get("/", (req, res) => res.send("✅ TMan Origins API running"));

const PORT = process.env.PORT || 5000;

console.log("DEBUG MONGODB_URI =", process.env.MONGODB_URI);

connectDB(process.env.MONGODB_URI).then(async () => {
  await ensureAdminSeed();
  app.listen(PORT, () => console.log(`✅ Backend running: http://localhost:${PORT}`));
});
