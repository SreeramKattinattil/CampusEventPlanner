const express = require("express");
const router = express.Router();
const Event = require("../models/Event");
const Registration = require("../models/Registration");
const User = require("../models/user");
let Feedback;

try {
  Feedback = require("../models/Feedback");
} catch (err) {
  console.warn("Feedback model not found, skipping feedback count");
}

// Middleware: ensure logged in
function isLoggedIn(req, res, next) {
  if (req.session.user) return next();
  res.redirect("/login");
}

// Render User Dashboard logic
async function renderUserDashboard(req, res) {
  try {
    const user = req.session.user;
    const events = await Event.find({ status: "approved" }).sort({ date: 1 });

    const registeredCount = await Registration.countDocuments({
      userId: user._id,
    });
    const today = new Date();
    const upcomingCount = await Event.countDocuments({
      status: "approved",
      date: { $gte: today },
    });

    let feedbackCount = 0;
    if (Feedback)
      feedbackCount = await Feedback.countDocuments({ userId: user._id });

    res.render("user/dashboard", {
      user,
      events,
      registeredCount,
      upcomingCount,
      feedbackCount,
    });
  } catch (err) {
    console.error("User dashboard error:", err);
    res.status(500).send("Error loading dashboard");
  }
}

// MAIN DASHBOARD ROUTE
router.get("/", isLoggedIn, async (req, res) => {
  try {
    const sessionUser = req.session.user;
    const user = await User.findById(sessionUser._id);

    if (!user && sessionUser.role !== "admin") return res.redirect("/login");

    // ---------- Admin ----------
    if (sessionUser.role === "admin") {
      const events = await Event.find().sort({ date: -1 });
      return res.render("admin/adminDashboard", { admin: sessionUser, events });
    }

    // ---------- Faculty ----------
    if (sessionUser.role === "faculty") {
      const events = await Event.find({
        department: sessionUser.department,
      }).sort({
        date: -1,
      });
      return res.render("faculty/dashboard", { user: sessionUser, events });
    }

    // ---------- Event Coordinator ----------
    if (sessionUser.role === "eventCoordinator") {
      const events = await Event.find({ coordinator: sessionUser._id }).sort({
        date: -1,
      });
      return res.render("eventCoordinator/dashboard", {
        user: sessionUser,
        events,
      });
    }

    // ---------- Normal User ----------
    if (sessionUser.role === "user") {
      return renderUserDashboard(req, res);
    }
  } catch (err) {
    console.error("Dashboard error:", err);
    res.status(500).send("Server error");
  }
});

module.exports = router;
