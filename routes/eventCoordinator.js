// routes/eventCoordinator.js
const express = require("express");
const router = express.Router();

// Middleware to protect Event Coordinator routes
function isEventCoordinator(req, res, next) {
  if (req.session.user && req.session.user.role === "eventCoordinator") {
    return next();
  }
  res.redirect("/login");
}

// Event Coordinator Dashboard
router.get("/dashboard", isEventCoordinator, (req, res) => {
  // Pass session user to template
  res.render("eventCoordinator/eventCoordinatorDashboard", {
    coordinator: req.session.user,
  });
});

// Example: You can add more event coordinator routes here
// router.get("/my-events", isEventCoordinator, ...)

module.exports = router;
