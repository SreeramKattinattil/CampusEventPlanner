const express = require("express");
const bcrypt = require("bcrypt");
const router = express.Router();

const EventCoordinator = require("../models/eventCoordinator");

// Inline middleware to check faculty login
function isFaculty(req, res, next) {
  if (req.session.user && req.session.user.role === "faculty") {
    return next();
  }
  res.redirect("/login");
}

// Faculty Dashboard
router.get("/dashboard", isFaculty, (req, res) => {
  res.render("faculty/facultyDashboard", { faculty: req.session.user });
});

// GET: Add Event Coordinator form
router.get("/add-event-coordinator", isFaculty, (req, res) => {
  res.render("faculty/addEventCoordinator", { faculty: req.session.user });
});

// POST: Add Event Coordinator
router.post("/add-event-coordinator", isFaculty, async (req, res) => {
  const { name, email, department, password } = req.body;

  if (!password) return res.send("Password is required");

  try {
    const exists = await EventCoordinator.findOne({ email });
    if (exists) {
      return res.send("Event coordinator with this email already exists.");
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await EventCoordinator.create({
      name,
      email,
      password: hashedPassword,
      department,
      createdBy: req.session.user._id,
    });

    res.redirect("/faculty/event-coordinators");
  } catch (err) {
    console.error("Error adding coordinator:", err);
    res.status(500).send("Error adding coordinator.");
  }
});

// GET: List coordinators created by this faculty
router.get("/event-coordinators", isFaculty, async (req, res) => {
  try {
    const coordinators = await EventCoordinator.find({
      createdBy: req.session.user._id,
    });
    res.render("faculty/eventCoordinatorList", {
      faculty: req.session.user,
      coordinators,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error loading coordinators.");
  }
});

module.exports = router;
