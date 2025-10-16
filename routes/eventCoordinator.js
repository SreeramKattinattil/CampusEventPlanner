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
  if (req.session.user && req.session.user.role === "eventCoordinator")
    return next();
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
// Helper: Format Event Dates
// =====================
function formatEvents(events) {
  return events.map((e) => ({
    ...e._doc,
    dateFormatted: new Date(e.date).toDateString(),
  }));
}

// =====================
// Dashboard
// =====================
router.get("/dashboard", isEventCoordinator, async (req, res) => {
  try {
    const coordinator = await EventCoordinator.findById(req.session.user._id);
    if (!coordinator) return res.status(404).send("Coordinator not found");

    // Fetch events assigned to this coordinator
    const allEvents = await Event.find({ coordinator: coordinator._id }).sort({
      date: 1,
    });

    const approvedEvents = allEvents.filter((e) => e.status === "approved");
    const pendingEvents = allEvents.filter((e) => e.status === "pending");
    const rejectedEvents = allEvents.filter((e) => e.status === "rejected");

    const formatEvents = (events) =>
      events.map((e) => ({
        ...e._doc,
        dateFormatted: new Date(e.date).toDateString(),
      }));

    res.render("eventCoordinator/eventCoordinatorDashboard", {
      coordinator,
      approvedEvents: formatEvents(approvedEvents),
      pendingEvents: formatEvents(pendingEvents),
      rejectedEvents: formatEvents(rejectedEvents),
    });
  } catch (err) {
    console.error("Dashboard error:", err);
    res.status(500).send("Error loading dashboard");
  }
});

// =====================
// Create Event Page (GET)
// =====================
router.get("/create-event", isEventCoordinator, async (req, res) => {
  try {
    const coordinator = await EventCoordinator.findById(
      req.session.user._id
    ).lean();
    if (!coordinator) return res.status(404).send("Coordinator not found");

    res.render("eventCoordinator/createEvent", { coordinator });
  } catch (err) {
    console.error("Error loading create event page:", err);
    res.status(500).send("Error loading create event page");
  }
});

// =====================
// Create Event (POST)
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
        adminStatus: "Pending", // Admin now approves events
        media: req.files.map((file) => file.filename),
      });

      const savedEvent = await newEvent.save();

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
// Event Details
// =====================
router.get("/eventDetails/:id", isEventCoordinator, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).send("Event not found");

    const registrations = await Registration.find({ eventId: event._id })
      .populate("userId", "name email")
      .sort({ createdAt: -1 });

    res.render("eventCoordinator/eventDetails", {
      event,
      registrations,
      coordinator: req.session.user,
      showFeedback: true,
    });
  } catch (err) {
    console.error("Error loading event details:", err);
    res.status(500).send("Error loading event details");
  }
});

// =====================
// Scan QR (GET) - Admin Approved Events Only
// =====================
// =====================
// Scan QR Page - Only Approved Events
// =====================
router.get("/scan-qr", isEventCoordinator, async (req, res) => {
  try {
    const coordinator = await EventCoordinator.findById(req.session.user._id);
    if (!coordinator) return res.status(404).send("Coordinator not found");

    // Fetch events assigned to this coordinator that are approved by admin
    const approvedEvents = await Event.find({
      coordinator: coordinator._id,
      status: "approved", // or adminStatus: "Approved" depending on your schema
    })
      .sort({ date: 1 })
      .lean();

    // Format dates for display
    const formattedEvents = approvedEvents.map((e) => ({
      ...e,
      dateFormatted: new Date(e.date).toDateString(),
    }));

    res.render("eventCoordinator/scanAttendance", {
      coordinator,
      createdEvents: formattedEvents,
    });
  } catch (err) {
    console.error("Scan QR page error:", err);
    res.status(500).send("Failed to load scan QR page");
  }
});

// =====================
// Scan QR (POST) - Mark Attendance
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

    if (!registration)
      return res.status(404).json({
        success: false,
        message: "Registration not found for this event",
      });

    if (registration.paymentStatus !== "paid")
      return res.json({
        success: false,
        message: `${registration.userId.name} has not paid registration fee`,
        status: "unpaid",
      });

    if (registration.status === "attended")
      return res.json({
        success: true,
        message: `${registration.userId.name} already marked as attended`,
      });

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

    const registrations = await Registration.find({ eventId: event._id })
      .populate("userId", "name email")
      .sort({ createdAt: -1 });

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
      adminStatus: "Pending",
    })
      .sort({ date: 1 })
      .lean();

    res.render("eventCoordinator/pendingEvents", {
      coordinator,
      pendingEvents: formatEvents(pendingEvents),
    });
  } catch (err) {
    console.error("Error fetching pending events:", err);
    res.status(500).send("Error loading pending events");
  }
});

// =====================
// Transactions
// // =====================
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

router.post("/markPaid/:registrationId", async (req, res) => {
  try {
    const registrationId = req.params.registrationId;

    const registration = await Registration.findById(registrationId).populate(
      "userId eventId"
    );
    if (!registration) return res.status(404).send("Registration not found");

    // Update payment status
    registration.paymentStatus = "paid";
    await registration.save();

    // Check if a transaction already exists for this registration/user/event
    let transaction = await Transaction.findOne({
      event: registration.eventId._id,
      user: registration.userId ? registration.userId._id : null,
    });

    if (transaction) {
      // Update existing transaction
      transaction.status = "success";
      transaction.amount = registration.eventId.fee || transaction.amount;
      transaction.paymentMethod = "offline";
      await transaction.save();
    } else {
      // Create new transaction
      transaction = new Transaction({
        event: registration.eventId._id,
        coordinator: registration.eventId.coordinator,
        user: registration.userId ? registration.userId._id : null,
        amount: registration.eventId.fee || 0,
        paymentMethod: "offline",
        status: "success",
      });
      await transaction.save();
    }

    // Redirect back to the event details page
    res.redirect(`/event-coordinator/event/${registration.eventId._id}`);
  } catch (err) {
    console.error(err);
    res.status(500).send("Something went wrong");
  }
});

module.exports = router;
