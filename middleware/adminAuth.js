module.exports = function adminAuth(req, res, next) {
  try {
    if (req.cookies?.TMAN_ADMIN === "ok") return next();
    return res.status(401).json({ message: "Unauthorized (admin login required)" });
  } catch {
    return res.status(401).json({ message: "Unauthorized" });
  }
};
