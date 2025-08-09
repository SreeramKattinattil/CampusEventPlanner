const express = require("express");
const router = express.Router();

// Middleware to protect faculty routes
function facultyAuth(req, res, next) {
  if (req.session.role === "faculty") {
    next();
  } else {
    res.redirect("/login");
  }
}

// Faculty Dashboard
router.get("/dashboard", facultyAuth, (req, res) => {
  res.render("faculty/facultyDashboard", { faculty: req.session.user });
});

module.exports = router;
