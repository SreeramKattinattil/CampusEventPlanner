const express = require("express");
const router = express.Router();

// Middleware to protect user routes
function isUser(req, res, next) {
  if (req.session.user && req.session.user.role === "user") return next();
  res.status(403).send("Access denied");
}

// User Dashboard
router.get("/dashboard", isUser, (req, res) => {
  const user = req.session.user;
  if (!user) return res.send("User session not found. Please log in again.");

  res.render("user/dashboard", { user });
});

module.exports = router;
