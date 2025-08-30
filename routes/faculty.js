const express = require("express");
const bcrypt = require("bcrypt");
const router = express.Router();

const EventCoordinator = require("../models/eventCoordinator");
const Event = require("../models/Event");

// Middleware: check faculty login
function isFaculty(req, res, next) {
  if (req.session.user && req.session.user.role === "faculty") return next();
  res.redirect("/login");
}

// Helper: get event stats
async function getStats() {
  const draftCount = await Event.countDocuments({ status: "draft" });
  const approvedCount = await Event.countDocuments({ status: "approved" });
  const rejectedCount = await Event.countDocuments({ status: "rejected" });
  return { draftCount, approvedCount, rejectedCount };
}

// Dashboard
router.get("/dashboard", isFaculty, async (req, res) => {
  try {
    const stats = await getStats();
    res.render("faculty/facultyDashboard", {
      faculty: req.session.user,
      stats,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error loading dashboard");
  }
});

// GET: Pending events
router.get("/pending-events", isFaculty, async (req, res) => {
  try {
    const events = await Event.find({ status: "draft" });
    const stats = await getStats(); // pass stats to header
    res.render("faculty/pendingEvents", {
      faculty: req.session.user,
      events,
      stats,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching pending events.");
  }
});

// POST Approve Event
router.post("/approve/:id", isFaculty, async (req, res) => {
  try {
    await Event.findByIdAndUpdate(req.params.id, { status: "approved" });
    res.redirect("/faculty/pending-events");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error approving event.");
  }
});

// POST Reject Event
router.post("/reject/:id", isFaculty, async (req, res) => {
  try {
    await Event.findByIdAndUpdate(req.params.id, { status: "rejected" });
    res.redirect("/faculty/pending-events");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error rejecting event.");
  }
});

// Event Coordinator routes...
router.get("/add-event-coordinator", isFaculty, (req, res) => {
  res.render("faculty/addEventCoordinator", {
    faculty: req.session.user,
    stats: {},
  });
});

router.post("/add-event-coordinator", isFaculty, async (req, res) => {
  const { name, email, department, password } = req.body;
  if (!password) return res.send("Password is required");
  try {
    const exists = await EventCoordinator.findOne({ email });
    if (exists)
      return res.send("Event coordinator with this email already exists.");
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
    console.error(err);
    res.status(500).send("Error adding coordinator.");
  }
});

router.get("/event-coordinators", isFaculty, async (req, res) => {
  try {
    const coordinators = await EventCoordinator.find({
      createdBy: req.session.user._id,
    });
    res.render("faculty/eventCoordinatorList", {
      faculty: req.session.user,
      coordinators,
      stats: {},
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error loading coordinators.");
  }
});

module.exports = router;
