const express = require("express");
const router = express.Router();
const Event = require("../models/Event");

// Middleware to protect route (optional)
function isAuthenticated(req, res, next) {
  if (req.session.user) {
    return next();
  }
  res.redirect("/login");
}

router.get("/", isAuthenticated, async (req, res) => {
  try {
    const events = await Event.find();
    res.render("user/dashboard", {
      events,
      user: req.session.user, // 👈 pass user here
    });
  } catch (err) {
    console.error(err);
    res.redirect("/");
  }
});

module.exports = router;
