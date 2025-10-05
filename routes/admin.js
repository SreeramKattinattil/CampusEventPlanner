const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const Faculty = require("../models/Faculty");
const User = require("../models/User");
const Event = require("../models/Event");
const Registration = require("../models/Registration");

const Transaction = require("../models/Transaction");
// ================= Middleware =================
function isAdmin(req, res, next) {
  if (req.session.user && req.session.user.role === "admin") return next();
  return res.status(403).send("Access denied");
}

// ================= Utility =================
async function getAdminHeaderData() {
  const [totalUsers, totalFaculty, totalEvents, liveEvents, events] =
    await Promise.all([
      User.countDocuments({ role: "user" }),
      Faculty.countDocuments(),
      Event.countDocuments(),
      Event.countDocuments({ status: "approved" }),
      Event.find().sort({ date: 1 }),
    ]);
  const stats = { totalUsers, totalFaculty, totalEvents, liveEvents };
  return { stats, events };
}

router.get("/adminDashboard", isAdmin, async (req, res) => {
  try {
    const { stats, events } = await getAdminHeaderData();

    // Latest 5 feedbacks from registrations (only proper objects)
    const feedbacks = await Registration.find({
      feedback: { $exists: true, $type: "object" },
    })
      .populate("userId", "name")
      .populate("eventId", "name")
      .sort({ createdAt: -1 })
      .limit(5);

    // All transactions for chart
    const transactions = await Transaction.find().sort({ createdAt: 1 });

    res.render("admin/adminDashboard", {
      admin: req.session.user,
      stats,
      events,
      feedbacks,
      transactions,
      searchQuery: req.query.search || "",
    });
  } catch (err) {
    console.error("Dashboard Error:", err);
    res.status(500).send("Error loading dashboard");
  }
});

// ================= FACULTY =================
router.get("/addFaculty", isAdmin, async (req, res) => {
  try {
    const { stats, events } = await getAdminHeaderData();
    res.render("admin/addFaculty", { admin: req.session.user, stats, events });
  } catch (err) {
    console.error(err);
    res.send("Error loading Add Faculty page");
  }
});

router.post("/add-faculty", isAdmin, async (req, res) => {
  try {
    const { name, email, password, department } = req.body;
    const existingFaculty = await Faculty.findOne({ email });
    if (existingFaculty)
      return res.send("Faculty with this email already exists.");

    const hashedPassword = await bcrypt.hash(password, 10);
    await Faculty.create({ name, email, password: hashedPassword, department });

    res.redirect("/admin/adminDashboard");
  } catch (err) {
    console.error("Add Faculty Error:", err);
    res.send("Error adding faculty");
  }
});

router.get("/facultyList", isAdmin, async (req, res) => {
  try {
    const search = (req.query.search || "").trim();
    const filter = search
      ? {
          $or: [
            { name: { $regex: search, $options: "i" } },
            { department: { $regex: search, $options: "i" } },
          ],
        }
      : {};

    const [facultyList, { stats, events }] = await Promise.all([
      Faculty.find(filter).sort({ name: 1 }),
      getAdminHeaderData(),
    ]);

    res.render("admin/facultyList", {
      admin: req.session.user,
      stats,
      events,
      facultyList,
      search,
    });
  } catch (err) {
    console.error("Fetch Faculty Error:", err);
    res.send("Error fetching faculties");
  }
});

router.get("/edit-faculty/:id", isAdmin, async (req, res) => {
  try {
    const faculty = await Faculty.findById(req.params.id);
    if (!faculty) return res.status(404).send("Faculty not found");
    const { stats, events } = await getAdminHeaderData();
    res.render("admin/editFaculty", {
      admin: req.session.user,
      faculty,
      stats,
      events,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching faculty");
  }
});

router.post("/edit-faculty/:id", isAdmin, async (req, res) => {
  try {
    const { name, email, department } = req.body;
    await Faculty.findByIdAndUpdate(req.params.id, { name, email, department });
    res.redirect("/admin/facultyList");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error updating faculty");
  }
});

router.post("/delete-faculty/:id", isAdmin, async (req, res) => {
  try {
    await Faculty.findByIdAndDelete(req.params.id);
    res.redirect("/admin/facultyList");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error deleting faculty");
  }
});

// ================= STUDENTS =================
router.get("/students", isAdmin, async (req, res) => {
  try {
    const search = (req.query.search || "").trim();
    const filter = search
      ? {
          $or: [
            { name: { $regex: search, $options: "i" } },
            { department: { $regex: search, $options: "i" } },
          ],
        }
      : {};
    const studentList = await User.find({ role: "user", ...filter });
    const { stats, events } = await getAdminHeaderData();
    res.render("admin/students", {
      admin: req.session.user,
      studentList,
      stats,
      events,
      search,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching students");
  }
});

// ================= EVENTS =================
// ================= EVENTS =================
// ================= EVENTS =================
router.get("/events", isAdmin, async (req, res) => {
  try {
    const search = (req.query.search || "").trim();

    // Filter for searching by event name or venue
    const filter = search
      ? {
          $or: [
            { name: { $regex: search, $options: "i" } },
            { venue: { $regex: search, $options: "i" } },
          ],
        }
      : {};

    // Fetch events based on filter
    const eventList = await Event.find(filter).sort({ date: 1 });

    // Get admin dashboard stats and all events for header
    const { stats, events: headerEvents } = await getAdminHeaderData();

    // Render the admin events page
    res.render("admin/events", {
      admin: req.session.user,
      stats,
      events: headerEvents, // used for header partial
      eventList, // used for table display
      searchQuery: search,
    });
  } catch (err) {
    console.error("Error fetching events:", err);
    res.status(500).send("Error fetching events");
  }
});

// ================= EVENT DETAILS =================
router.get("/eventDetails/:id", isAdmin, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id)
      .populate("createdBy", "name")
      .populate("assignedFaculty", "name");

    if (!event) return res.status(404).send("Event not found");

    const { stats, events } = await getAdminHeaderData();

    res.render("admin/eventDetails", {
      admin: req.session.user,
      event,
      stats,
      events,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching event details");
  }
});

module.exports = router;
