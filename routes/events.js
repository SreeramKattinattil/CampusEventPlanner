// routes/events.js
const express = require("express");
const router = express.Router();
const Event = require("../models/Event");

// Middleware: protect routes for any logged-in user
function isLoggedIn(req, res, next) {
  if (req.session.user) return next();
  res.redirect("/login");
}

router.get("/events/:id", isLoggedIn, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).send("Event not found");

    res.render("events/eventDetail", { user: req.session.user, event });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error loading event details.");
  }
});

module.exports = router;
