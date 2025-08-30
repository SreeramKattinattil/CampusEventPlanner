const express = require("express");
const router = express.Router();
const Event = require("../models/Event"); // ✅ Import Event model

// Middleware: protect user routes
function isUser(req, res, next) {
  if (req.session.user && req.session.user.role === "user") return next();
  res.status(403).send("Access denied");
}

// User Dashboard with Upcoming Events
router.get("/dashboard", isUser, async (req, res) => {
  try {
    const user = req.session.user;
    if (!user) return res.send("User session not found. Please log in again.");

    // Fetch only approved events and sort by date
    const events = await Event.find({ status: "approved" }).sort({ date: 1 });

    // Render dashboard with events
    res.render("user/userDashboard", { user, events });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error loading dashboard.");
  }
});

// Show full event details when clicked
router.get("/event/:id", isUser, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event || event.status !== "approved") {
      return res.status(404).send("Event not found");
    }
    res.render("user/eventDetails", { user: req.session.user, event });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error loading event details.");
  }
});

// Optional: keep separate /events route if needed
router.get("/events", isUser, async (req, res) => {
  try {
    const events = await Event.find({ status: "approved" }).sort({ date: 1 });
    res.render("user/userDashboard", { user: req.session.user, events });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error loading events.");
  }
});

module.exports = router;
