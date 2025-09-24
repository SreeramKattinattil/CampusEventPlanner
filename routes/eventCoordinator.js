const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");

// Models
const Event = require("../models/Event");
const EventCoordinator = require("../models/eventCoordinator");
const Registration = require("../models/Registration");
const Transaction = require("../models/Transaction");

// =====================
// Middleware: Protect Event Coordinator Routes
// =====================
function isEventCoordinator(req, res, next) {
  if (req.session.user && req.session.user.role === "eventCoordinator") {
    return next();
  }
  res.redirect("/login");
}

// =====================
// Multer Storage Config for Media Upload
// =====================
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) =>
    cb(
      null,
      `${file.fieldname}-${Date.now()}${path.extname(file.originalname)}`
    ),
});
const upload = multer({ storage });

// =====================
// Dashboard
// =====================
router.get("/dashboard", isEventCoordinator, async (req, res) => {
  try {
    const coordinator = await EventCoordinator.findById(req.session.user._id);
    if (!coordinator) return res.status(404).send("Coordinator not found");

    const createdEvents = await Event.find({ createdBy: coordinator._id }).sort(
      { date: 1 }
    );
    const facultyApprovedEvents = await Event.find({
      assignedFaculty: coordinator.createdBy,
      status: "approved",
    }).sort({ date: 1 });

    const formatEvents = (events) =>
      events.map((e) => ({
        ...e._doc,
        date: new Date(e.date),
        dateFormatted: new Date(e.date).toDateString(),
      }));

    res.render("eventCoordinator/eventCoordinatorDashboard", {
      coordinator,
      createdEvents: formatEvents(createdEvents),
      facultyApprovedEvents: formatEvents(facultyApprovedEvents),
    });
  } catch (err) {
    console.error("Error loading dashboard:", err);
    res.status(500).send("Error loading dashboard");
  }
});

// =====================
// Create Event POST
// =====================
router.post(
  "/create-event",
  isEventCoordinator,
  upload.array("media", 10),
  async (req, res) => {
    try {
      const coordinator = await EventCoordinator.findById(req.session.user._id);
      if (!coordinator) return res.status(404).send("Coordinator not found");

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
        createdBy: coordinator._id,
        assignedFaculty: coordinator.createdBy,
        status: "pending",
        media: req.files.map((file) => file.filename),
      });

      const savedEvent = await newEvent.save();

      // ✅ Create transaction after event is saved
      await Transaction.create({
        event: savedEvent._id,
        coordinator: coordinator._id,
        amount: regFee || 0,
        paymentMethod: "N/A",
        status: "success",
        createdAt: new Date(),
      });

      res.redirect("/event-coordinator/dashboard");
    } catch (err) {
      console.error("Error creating event:", err);
      res.status(500).send("Error creating event");
    }
  }
);

// =====================
// Event Details (Registrations)
// =====================
router.get("/eventDetails/:id", isEventCoordinator, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).send("Event not found");

    const registrations = await Registration.find({
      eventId: event._id,
    }).populate("userId", "name email");

    res.render("eventCoordinator/eventDetails", {
      event,
      registrations,
      coordinator: req.session.user,
    });
  } catch (err) {
    console.error("Error loading event details:", err);
    res.status(500).send("Error loading event details");
  }
});

// =====================
// QR Scanner Page
// =====================
router.get("/scan-qr", isEventCoordinator, async (req, res) => {
  try {
    const coordinator = await EventCoordinator.findById(req.session.user._id);
    if (!coordinator) return res.status(404).send("Coordinator not found");

    const createdEvents = await Event.find({ createdBy: coordinator._id }).sort(
      { date: 1 }
    );

    const eventsWithFormattedDate = createdEvents.map((e) => ({
      ...e._doc,
      dateFormatted: new Date(e.date).toDateString(),
    }));

    res.render("eventCoordinator/scanAttendance", {
      coordinator,
      createdEvents: eventsWithFormattedDate,
    });
  } catch (err) {
    console.error("Scan QR page error:", err);
    res.status(500).send("Failed to load scan QR page");
  }
});

// =====================
// Process Scanned QR
// =====================
router.post("/scan-qr", isEventCoordinator, async (req, res) => {
  try {
    const { qrData, eventId } = req.body;
    const parsedData = JSON.parse(qrData);
    const registrationId = parsedData.registrationId;

    const registration = await Registration.findOne({
      _id: registrationId,
      eventId,
    }).populate("userId", "name email");

    if (!registration) {
      return res
        .status(404)
        .json({
          success: false,
          message: "Registration not found for this event",
        });
    }

    if (registration.paymentStatus !== "paid") {
      return res.json({
        success: false,
        message: `${registration.userId.name} has not paid registration fee`,
        status: "unpaid",
      });
    }

    if (registration.status === "attended") {
      return res.json({
        success: true,
        message: `${registration.userId.name} already marked as attended`,
      });
    }

    registration.status = "attended";
    await registration.save();

    res.json({
      success: true,
      message: `${registration.userId.name} marked present!`,
    });
  } catch (err) {
    console.error("QR scan error:", err);
    res
      .status(500)
      .json({ success: false, message: "Failed to mark attendance" });
  }
});

// =====================
// Event Attendance (AJAX)
// =====================
router.get("/event-attendance/:id", isEventCoordinator, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event)
      return res
        .status(404)
        .json({ success: false, message: "Event not found" });

    const registrations = await Registration.find({
      eventId: event._id,
    }).populate("userId", "name email");
    res.json({ success: true, registrations });
  } catch (err) {
    console.error("Attendance fetch error:", err);
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch attendance" });
  }
});

// =====================
// Pending Events
// =====================
router.get("/pending-events", isEventCoordinator, async (req, res) => {
  try {
    const coordinator = await EventCoordinator.findById(req.session.user._id);
    if (!coordinator) return res.status(404).send("Coordinator not found");

    const pendingEvents = await Event.find({
      createdBy: coordinator._id,
      status: { $in: ["draft", "pending", "rejected"] },
    }).sort({ date: 1 });

    const formattedEvents = pendingEvents.map((e) => ({
      ...e._doc,
      dateFormatted: new Date(e.date).toDateString(),
    }));

    res.render("eventCoordinator/pendingEvents", {
      coordinator,
      pendingEvents: formattedEvents,
    });
  } catch (err) {
    console.error("Error fetching pending events:", err);
    res.status(500).send("Error loading pending events");
  }
});

// =====================
// Transactions page
// =====================
router.get("/transactions", isEventCoordinator, async (req, res) => {
  try {
    const coordinatorId = req.session.user._id;

    const transactions = await Transaction.find({ coordinator: coordinatorId })
      .populate("event", "name")
      .populate("user", "name email")
      .sort({ createdAt: -1 });

    res.render("eventCoordinator/transactions", {
      coordinator: req.session.user,
      transactions,
    });
  } catch (err) {
    console.error("Error loading transactions:", err);
    res.status(500).send("Error loading transactions");
  }
});

module.exports = router;
