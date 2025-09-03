const express = require("express");
const router = express.Router();
const Event = require("../models/Event");

<<<<<<< HEAD
// Middleware to check login
function isLoggedIn(req, res, next) {
  if (req.session.user) return next();
  res.redirect("/login");
}

// Dashboard for all roles
router.get("/dashboard", isLoggedIn, async (req, res) => {
  try {
    const user = req.session.user;

    // Fetch approved events
    const events = await Event.find({ status: "approved" }).sort({ date: 1 });

    // Render different dashboard depending on role
    if (user.role === "user") {
      res.render("user/userDashboard", { user, events });
    } else if (user.role === "faculty") {
      res.render("faculty/facultyDashboard", { user, events });
    } else if (user.role === "eventCoordinator") {
      res.render("eventCoordinator/eventCoordinatorDashboard", {
        user,
        events,
      });
    } else if (user.role === "admin") {
      res.render("admin/adminDashboard", { user, events });
    } else {
      res.send("Role not recognized");
    }
  } catch (err) {
    console.error(err);
    res.status(500).send("Error loading dashboard.");
  }
});

// ✅ Event Details route for all roles (including admin)
router.get("/dashboard/eventDetails/:id", isLoggedIn, async (req, res) => {
  try {
    const user = req.session.user;
    const event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).send("Event not found");
    }

    // Render different eventDetails view depending on role
    if (user.role === "user") {
      res.render("user/eventDetails", { user, event });
    } else if (user.role === "faculty") {
      res.render("faculty/eventDetails", { user, event });
    } else if (user.role === "eventCoordinator") {
      res.render("eventCoordinator/eventDetails", { user, event });
    } else if (user.role === "admin") {
      res.render("admin/eventDetails", { user, event });
    } else {
      res.status(403).send("Access denied");
    }
  } catch (err) {
    console.error(err);
    res.status(500).send("Error loading event details.");
=======
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
>>>>>>> 09cfc989681bf89c136db5e13d701d0c58a8b47f
  }
});

module.exports = router;
