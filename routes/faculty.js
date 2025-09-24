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
async function getStats(facultyId) {
  const draftCount = await Event.countDocuments({
    status: "draft",
    assignedFaculty: facultyId,
  });
  const approvedCount = await Event.countDocuments({
    status: "approved",
    assignedFaculty: facultyId,
  });
  const rejectedCount = await Event.countDocuments({
    status: "rejected",
    assignedFaculty: facultyId,
  });
  return { draftCount, approvedCount, rejectedCount };
}

/* ===========================================================
   FACULTY DASHBOARD
=========================================================== */
router.get("/dashboard", isFaculty, async (req, res) => {
  try {
    const faculty = req.session.user;
    if (!faculty) return res.redirect("/login");

    const events = await Event.find({
      status: "approved",
      assignedFaculty: faculty._id,
    }).sort({ date: 1 });

    const stats = await getStats(faculty._id);

    res.render("faculty/facultyDashboard", { faculty, stats, events });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

/* ===========================================================
   PENDING EVENTS
=========================================================== */
router.get("/pending-events", isFaculty, async (req, res) => {
  try {
    const faculty = req.session.user;
    if (!faculty) return res.redirect("/login");

    const events = await Event.find({
      status: { $in: ["draft", "pending"] },
      assignedFaculty: faculty._id,
    }).sort({ date: 1 });

    const stats = await getStats(faculty._id);

    res.render("faculty/pendingEvents", {
      faculty,
      events,
      stats,
    });
  } catch (err) {
    console.error("Error fetching pending events:", err);
    res.status(500).send("Error fetching pending events.");
  }
});

/* ===========================================================
   APPROVE EVENT
=========================================================== */
router.post("/approve/:id", isFaculty, async (req, res) => {
  try {
    const faculty = req.session.user;

    await Event.findByIdAndUpdate(req.params.id, {
      status: "approved",
      $push: {
        notifications: {
          message: `✅ Event approved successfully by ${faculty.name}`,
          createdAt: new Date(),
        },
      },
    });

    res.redirect("/faculty/pending-events");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error approving event.");
  }
});

/* ===========================================================
   REJECT EVENT (with reason)
=========================================================== */
router.post("/reject/:id", isFaculty, async (req, res) => {
  try {
    const faculty = req.session.user;
    const { reason } = req.body; // reason comes from form

    if (!reason || reason.trim() === "") {
      return res.send("Rejection reason is required.");
    }

    await Event.findByIdAndUpdate(req.params.id, {
      status: "rejected",
      rejectionNote: reason, // ✅ match schema field
      $push: {
        notifications: {
          message: `❌ Event rejected by ${faculty.name}. Reason: ${reason}`,
          createdAt: new Date(),
        },
      },
    });

    res.redirect("/faculty/pending-events");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error rejecting event.");
  }
});

/* ===========================================================
   ADD EVENT COORDINATOR
=========================================================== */
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

/* ===========================================================
   LIST EVENT COORDINATORS
=========================================================== */
router.get("/event-coordinators", isFaculty, async (req, res) => {
  try {
    const coordinators = await EventCoordinator.find({
      createdBy: req.session.user._id,
    });

    res.render("faculty/eventCoordinatorList", {
      user: req.session.user,
      coordinators,
      stats: {},
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error loading coordinators.");
  }
});

module.exports = router;
