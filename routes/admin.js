const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const Faculty = require("../models/Faculty");
const User = require("../models/User");
const Event = require("../models/Event");
const Registration = require("../models/Registration");
const Transaction = require("../models/Transaction");
const EventCoordinator = require("../models/eventCoordinator");

// ================= Middleware =================
function isAdmin(req, res, next) {
  if (req.session.user && req.session.user.role === "admin") return next();
  return res.status(403).send("Access denied");
}

// ================= Utility =================
async function getAdminHeaderData() {
  const [totalUsers, totalFaculty, totalEvents, approvedEvents, events] =
    await Promise.all([
      User.countDocuments({ role: "user" }),
      Faculty.countDocuments(),
      Event.countDocuments(),
      Event.countDocuments({ status: "approved" }),
      Event.find().sort({ date: 1 }),
    ]);

  const stats = { totalUsers, totalFaculty, totalEvents, approvedEvents };
  return { stats, events };
}

// ================= Dashboard =================
router.get("/adminDashboard", isAdmin, async (req, res) => {
  try {
    const { stats, events } = await getAdminHeaderData();

    const feedbacks = await Registration.find({ feedback: { $exists: true } })
      .populate("userId", "name")
      .populate("eventId", "name")
      .sort({ createdAt: -1 })
      .limit(5);

    const transactions = await Transaction.find().sort({ createdAt: -1 });

    res.render("admin/adminDashboard", {
      admin: req.session.user,
      stats,
      events,
      feedbacks,
      transactions,
    });
  } catch (err) {
    console.error("Dashboard Error:", err);
    res.status(500).send("Error loading dashboard");
  }
});

// ================= Pending / Approved / Rejected Events =================
async function renderEventsPage(req, res, status, template) {
  try {
    const searchQuery = req.query.search || "";
    const events = await Event.find({
      status,
      name: { $regex: searchQuery, $options: "i" },
    })
      .populate("createdBy", "name department")
      .populate("coordinator", "name email") // <-- Populate coordinator
      .sort({ date: -1 });

    const { stats } = await getAdminHeaderData();

    // Add registration count for each event
    for (let event of events) {
      event.registrationCount = await Registration.countDocuments({
        eventId: event._id,
      });
    }

    res.render(template, {
      admin: req.session.user,
      stats,
      events,
      searchQuery,
    });
  } catch (err) {
    console.error(`${status} Events Error:`, err);
    res.status(500).send(`Error loading ${status} events`);
  }
}

router.get("/approveEvents", isAdmin, (req, res) =>
  renderEventsPage(req, res, "pending", "admin/approveEvents")
);
router.get("/approvedEvents", isAdmin, (req, res) =>
  renderEventsPage(req, res, "approved", "admin/approvedEvents")
);
router.get("/rejectedEvents", isAdmin, (req, res) =>
  renderEventsPage(req, res, "rejected", "admin/rejectedEvents")
);

// ================= Approve / Reject Event =================
router.post("/approve-event/:id", isAdmin, async (req, res) => {
  try {
    await Event.findByIdAndUpdate(req.params.id, {
      status: "approved",
      $push: {
        notifications: {
          message: "✅ Event approved by Admin",
          createdAt: new Date(),
        },
      },
    });
    res.redirect("/admin/approveEvents");
  } catch (err) {
    console.error("Approve event error:", err);
    res.status(500).send("Error approving event");
  }
});

router.post("/reject-event/:id", isAdmin, async (req, res) => {
  try {
    const { reason } = req.body;
    await Event.findByIdAndUpdate(req.params.id, {
      status: "rejected",
      rejectionNote: reason,
      $push: {
        notifications: {
          message: `❌ Event rejected by Admin. Reason: ${reason}`,
          createdAt: new Date(),
        },
      },
    });
    res.redirect("/admin/approveEvents");
  } catch (err) {
    console.error("Reject event error:", err);
    res.status(500).send("Error rejecting event");
  }
});

// ================= Add Faculty =================
router.get("/addFaculty", isAdmin, async (req, res) => {
  try {
    const { stats, events } = await getAdminHeaderData();
    res.render("admin/adddFaculty", {
      admin: req.session.user,
      stats,
      events,
    });
  } catch (err) {
    console.error("Add Faculty Page Error:", err);
    res.status(500).send("Error loading add faculty page");
  }
});

router.post("/add-faculty", isAdmin, async (req, res) => {
  try {
    const { name, email, password, department } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    await Faculty.create({ name, email, password: hashedPassword, department });
    res.redirect("/admin/addFaculty");
  } catch (err) {
    console.error("Add Faculty Error:", err);
    res.status(500).send("Error adding faculty");
  }
});

// ================= View / Delete Faculty =================
router.get("/viewFaculty", isAdmin, async (req, res) => {
  try {
    const departmentQuery = req.query.department || "";
    let filter = {};
    if (departmentQuery) filter.department = departmentQuery;

    const facultyList = await Faculty.find(filter).sort({ name: 1 });
    const { stats, events } = await getAdminHeaderData();

    res.render("admin/viewFaculty", {
      admin: req.session.user,
      stats,
      events,
      facultyList,
      pageTitle: "Faculty",
      selectedDept: departmentQuery,
    });
  } catch (err) {
    console.error("View Faculty Error:", err);
    res.status(500).send("Error loading faculty list");
  }
});

router.post("/deleteFaculty", isAdmin, async (req, res) => {
  try {
    const { facultyIds } = req.body;
    if (!facultyIds || facultyIds.length === 0)
      return res.redirect("/admin/viewFaculty");
    const idsToDelete = Array.isArray(facultyIds) ? facultyIds : [facultyIds];
    await Faculty.deleteMany({ _id: { $in: idsToDelete } });
    res.redirect("/admin/viewFaculty");
  } catch (err) {
    console.error("Delete Faculty Error:", err);
    res.status(500).send("Error deleting faculty");
  }
});

// ================= View / Delete Users =================
router.get("/viewUsers", isAdmin, async (req, res) => {
  try {
    const users = await User.find({ role: "user" }).sort({ name: 1 });
    const { stats, events } = await getAdminHeaderData();
    res.render("admin/viewUsers", {
      admin: req.session.user,
      stats,
      events,
      users,
      pageTitle: "Registered Users",
    });
  } catch (err) {
    console.error("View Users Error:", err);
    res.status(500).send("Error loading users list");
  }
});

router.post("/deleteUsers", isAdmin, async (req, res) => {
  try {
    const { userIds } = req.body;
    if (!userIds) return res.redirect("/admin/viewUsers");
    const idsToDelete = Array.isArray(userIds) ? userIds : [userIds];
    await User.deleteMany({ _id: { $in: idsToDelete } });
    res.redirect("/admin/viewUsers");
  } catch (err) {
    console.error("Delete Users Error:", err);
    res.status(500).send("Error deleting users");
  }
});

// ================= View / Delete Event Coordinators =================
router.get("/viewEventCoordinators", isAdmin, async (req, res) => {
  try {
    const departmentQuery = req.query.department || "";
    let filter = {};
    if (departmentQuery) filter.department = departmentQuery;

    const eventCoordinators = await EventCoordinator.find(filter).sort({
      name: 1,
    });
    const { stats, events } = await getAdminHeaderData();

    res.render("admin/viewEventCoordinators", {
      admin: req.session.user,
      stats,
      events,
      eventCoordinators,
      pageTitle: "Event Coordinators",
      selectedDept: departmentQuery,
    });
  } catch (err) {
    console.error("View Event Coordinators Error:", err);
    res.status(500).send("Error loading event coordinators");
  }
});

router.post("/deleteEventCoordinators", isAdmin, async (req, res) => {
  try {
    const { coordinatorIds } = req.body;
    if (!coordinatorIds) return res.redirect("/admin/viewEventCoordinators");
    const idsToDelete = Array.isArray(coordinatorIds)
      ? coordinatorIds
      : [coordinatorIds];
    await EventCoordinator.deleteMany({ _id: { $in: idsToDelete } });
    res.redirect("/admin/viewEventCoordinators");
  } catch (err) {
    console.error("Delete Event Coordinators Error:", err);
    res.status(500).send("Error deleting event coordinators");
  }
});

module.exports = router;
