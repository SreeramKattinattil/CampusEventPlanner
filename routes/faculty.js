const express = require("express");
const bcrypt = require("bcrypt");
const multer = require("multer");
const path = require("path");
const mongoose = require("mongoose");
const Faculty = require("../models/Faculty"); // <-- adjust path if needed

const router = express.Router();
const Event = require("../models/Event");
const EventCoordinator = require("../models/EventCoordinator");
const Registration = require("../models/Registration");

const Transaction = require("../models/Transaction"); // make sure to import your Transaction model
// ====================== Middleware ======================
function isFaculty(req, res, next) {
  if (req.session.user?.role === "faculty") return next();
  res.redirect("/login");
}

// ====================== Multer Setup ======================
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) =>
    cb(
      null,
      `${file.fieldname}-${Date.now()}${path.extname(file.originalname)}`
    ),
});
const upload = multer({ storage });

// ====================== Helper: Get Faculty Stats ======================
async function getFacultyStats(facultyId) {
  const [approvedCount, pendingCount, rejectedCount, upcomingCount] =
    await Promise.all([
      Event.countDocuments({ createdBy: facultyId, status: "approved" }),
      Event.countDocuments({ createdBy: facultyId, status: "pending" }),
      Event.countDocuments({ createdBy: facultyId, status: "rejected" }),
      Event.countDocuments({
        createdBy: facultyId,
        status: "approved",
        date: { $gte: new Date() },
      }),
    ]);
  return { approvedCount, pendingCount, rejectedCount, upcomingCount };
}

// ====================== Dashboard ======================
router.get("/dashboard", isFaculty, async (req, res) => {
  try {
    const facultyId = req.session.user._id;
    const events = await Event.find({ createdBy: facultyId })
      .populate("coordinator", "name email")
      .sort({ date: 1 });

    const stats = await getFacultyStats(facultyId);
    res.render("faculty/facultyDashboard", {
      faculty: req.session.user,
      events,
      stats,
    });
  } catch (err) {
    console.error("Dashboard error:", err);
    res.status(500).send("Error loading dashboard");
  }
});

// ====================== Create Event ======================
router.get("/create-event", isFaculty, async (req, res) => {
  try {
    const facultyId = req.session.user._id;
    const coordinators = await EventCoordinator.find({ createdBy: facultyId });
    const stats = await getFacultyStats(facultyId);

    res.render("faculty/createEvent", {
      faculty: req.session.user,
      coordinators,
      stats,
    });
  } catch (err) {
    console.error("Create Event page error:", err);
    res.status(500).send("Error loading create event page");
  }
});

router.post(
  "/create-event",
  isFaculty,
  upload.array("media", 10),
  async (req, res) => {
    try {
      const faculty = req.session.user;
      const {
        name,
        description,
        date,
        time,
        venue,
        regFee,
        participants,
        contactInfo,
        department,
        coordinatorId,
      } = req.body;

      const newEvent = new Event({
        name,
        description,
        date,
        time,
        venue,
        regFee,
        participants,
        contactInfo,
        department,
        createdBy: faculty._id,
        coordinator: coordinatorId
          ? new mongoose.Types.ObjectId(coordinatorId)
          : null,
        status: "pending",
        media: req.files.map((f) => f.filename),
      });

      await newEvent.save();
      res.redirect("/faculty/dashboard");
    } catch (err) {
      console.error("Create Event error:", err);
      res.status(500).send("Error creating event");
    }
  }
);

// ====================== Pending Events ======================
router.get("/pending-events", isFaculty, async (req, res) => {
  try {
    const facultyId = req.session.user._id;
    const events = await Event.find({ createdBy: facultyId, status: "pending" })
      .populate("coordinator", "name email")
      .sort({ date: -1 });

    const stats = await getFacultyStats(facultyId);
    res.render("faculty/pendingEvents", {
      faculty: req.session.user,
      events,
      stats,
    });
  } catch (err) {
    console.error("Pending Events error:", err);
    res.status(500).send("Error fetching pending events");
  }
});

// ====================== Rejected Events ======================
router.get("/rejected-events", isFaculty, async (req, res) => {
  try {
    const facultyId = req.session.user._id;
    const events = await Event.find({
      createdBy: facultyId,
      status: "rejected",
    })
      .populate("coordinator", "name email")
      .sort({ date: -1 });

    const stats = await getFacultyStats(facultyId);
    res.render("faculty/rejectedEvents", {
      faculty: req.session.user,
      events,
      stats,
    });
  } catch (err) {
    console.error("Rejected Events error:", err);
    res.status(500).send("Error fetching rejected events");
  }
});

// ====================== Event Coordinators ======================
router.get("/add-event-coordinator", isFaculty, async (req, res) => {
  const stats = await getFacultyStats(req.session.user._id);
  res.render("faculty/addEventCoordinator", {
    faculty: req.session.user,
    stats,
  });
});

router.post("/add-event-coordinator", isFaculty, async (req, res) => {
  try {
    const { name, email, department, password } = req.body;
    if (await EventCoordinator.findOne({ email }))
      return res.send("Coordinator already exists");

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
    console.error("Add Coordinator error:", err);
    res.status(500).send("Error adding coordinator");
  }
});

router.get("/event-coordinators", isFaculty, async (req, res) => {
  try {
    const facultyId = req.session.user._id;
    const coordinators = await EventCoordinator.find({ createdBy: facultyId });
    const stats = await getFacultyStats(facultyId);

    res.render("faculty/eventCoordinatorList", {
      faculty: req.session.user,
      coordinators,
      stats,
    });
  } catch (err) {
    console.error("List Coordinators error:", err);
    res.status(500).send("Error fetching coordinators");
  }
});

// ====================== View Feedbacks ======================
router.get("/feedbacks", isFaculty, async (req, res) => {
  try {
    const facultyId = req.session.user._id;
    const events = await Event.find({ createdBy: facultyId });
    const eventIds = events.map((e) => e._id);

    const registrations = await Registration.find({
      eventId: { $in: eventIds },
      "feedback.comment": { $exists: true, $ne: null },
    })
      .populate("eventId", "name")
      .populate("userId", "name email")
      .lean();

    res.render("faculty/feedbacks", {
      faculty: req.session.user,
      registrations,
    });
  } catch (err) {
    console.error("Error loading feedbacks:", err);
    res.status(500).send("Error loading feedbacks");
  }
});

// ====================== Approved Events ======================
router.get("/approved-events", isFaculty, async (req, res) => {
  try {
    const facultyId = req.session.user._id;
    const events = await Event.find({
      createdBy: facultyId,
      status: "approved",
    })
      .populate("coordinator", "name email")
      .sort({ date: 1 });

    const stats = await getFacultyStats(facultyId);
    res.render("faculty/approvedEvents", {
      faculty: req.session.user,
      events,
      stats,
    });
  } catch (err) {
    console.error("Approved Events error:", err);
    res.status(500).send("Error fetching approved events");
  }
});

// ====================== View Registrations for Approved Event ======================
router.get(
  "/approved-events/:eventId/registrations",
  isFaculty,
  async (req, res) => {
    try {
      const { eventId } = req.params;

      const event = await Event.findById(eventId);
      if (!event) return res.status(404).send("Event not found");

      const registrations = await Registration.find({ eventId })
        .populate("userId", "name email mobile")
        .lean();

      const formattedRegs = registrations.map((reg) => ({
        user: reg.userId,
        participants: reg.participants || [],
        paymentStatus: reg.paymentStatus || "not paid",
        feedback: reg.feedback || {},
        registeredAt: reg.createdAt,
      }));

      res.render("faculty/viewRegistrations", {
        faculty: req.session.user,
        event,
        registrations: formattedRegs,
      });
    } catch (err) {
      console.error("View Registrations Error:", err);
      res.status(500).send("Error loading registrations");
    }
  }
);

router.get(
  "/approved-events/:eventId/registrations",
  isFaculty,
  async (req, res) => {
    try {
      const { eventId } = req.params;

      // Fetch event
      const event = await Event.findById(eventId);
      if (!event) return res.status(404).send("Event not found");

      // Fetch registrations
      const registrations = await Registration.find({ eventId })
        .populate("userId", "name email mobile")
        .lean();

      // Fetch transactions related to this event
      const transactions = await Transaction.find({ event: eventId }).lean();

      // Map registrations to include participants, feedback, paymentStatus, and transaction info
      const formattedRegs = registrations.map((reg) => {
        // Find corresponding transaction for the user (if any)
        const transaction = transactions.find(
          (t) => t.user?.toString() === reg.userId?._id.toString()
        );

        return {
          user: reg.userId,
          participants: reg.participants || [],
          paymentStatus: reg.paymentStatus || "not paid",
          feedback: reg.feedback || {},
          registeredAt: reg.createdAt,
          transaction: transaction
            ? {
                amount: transaction.amount,
                status: transaction.status,
                paymentMethod: transaction.paymentMethod,
                createdAt: transaction.createdAt,
              }
            : null,
        };
      });

      res.render("faculty/viewRegistrations", {
        faculty: req.session.user,
        event,
        registrations: formattedRegs,
      });
    } catch (err) {
      console.error("View Registrations Error:", err);
      res.status(500).send("Error loading registrations");
    }
  }
);

// =============================
// Faculty - View & Filter Transactions
// =============================
router.get("/transactions", isFaculty, async (req, res) => {
  try {
    const faculty = await Faculty.findById(req.session.user._id).lean();
    if (!faculty) return res.status(404).send("Faculty not found");

    // 1. Fetch events created by this faculty
    const events = await Event.find({ createdBy: faculty._id }).lean();
    const eventIds = events.map((e) => e._id);

    // 2. Get filter values from query
    let {
      event: eventId,
      status,
      paymentMethod,
      startDate,
      endDate,
    } = req.query;

    // 3. Build query
    let query = { event: { $in: eventIds } };

    if (eventId && eventId !== "all") query.event = eventId;
    if (status && status !== "all") query.status = status;
    if (paymentMethod && paymentMethod !== "all") {
      if (paymentMethod === "offline") {
        // map offline to cash for offline payments
        query.paymentMethod = { $in: ["cash"] };
      } else {
        query.paymentMethod = paymentMethod;
      }
    }

    if (startDate)
      query.createdAt = { ...query.createdAt, $gte: new Date(startDate) };
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      query.createdAt = { ...query.createdAt, $lte: end };
    }

    // 4. Fetch transactions
    const transactions = await Transaction.find(query)
      .populate("event", "name fee")
      .populate("user", "name email")
      .sort({ createdAt: -1 })
      .lean();

    // 5. Ensure amount is properly set for offline transactions
    transactions.forEach((t) => {
      if (!t.amount && t.paymentMethod === "cash" && t.event && t.event.fee) {
        t.amount = t.event.fee;
      }
    });

    res.render("faculty/transactions", {
      faculty,
      events,
      transactions,
      filters: {
        event: eventId || "all",
        status: status || "all",
        paymentMethod: paymentMethod || "all",
        startDate: startDate || "",
        endDate: endDate || "",
      },
      selectedEventId: eventId || "all",
      selectedPaymentMethod: paymentMethod || "all",
      selectedStatus: status || "all",
    });
  } catch (err) {
    console.error("Error loading transactions:", err);
    res.status(500).send("Error loading transactions");
  }
});

module.exports = router;
