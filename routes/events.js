const express = require("express");
const router = express.Router();
const Event = require("../models/Event");
const QRCode = require("qrcode");
const EventRegistration = require("../models/EventRegistration");

// Middleware: protect routes for any logged-in user
function isLoggedIn(req, res, next) {
  if (req.session.user) return next();
  res.redirect("/login");
}

// Event details page
router.get("/events/:id", isLoggedIn, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).send("Event not found");

    res.render("events/eventDetail", { user: req.session.user, event });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error loading event details.");
  }
});

// Event registration route
router.post("/register/:id", isLoggedIn, async (req, res) => {
  try {
    const userId = req.session.user._id;
    const eventId = req.params.id;

    // Check if already registered
    const existing = await EventRegistration.findOne({
      user: userId,
      event: eventId,
    });
    if (existing) return res.send("Already registered");

    // Create registration
    const registration = await EventRegistration.create({
      user: userId,
      event: eventId,
      attendanceStatus: "registered", // new field
    });

    // Generate QR code (Data URL)
    const qrData = registration._id.toString();
    const qrCodeUrl = await QRCode.toDataURL(qrData);
    registration.qrCode = qrCodeUrl;
    await registration.save();

    res.redirect("/user/myEvents"); // Show QR in user account
  } catch (err) {
    console.error(err);
    res.status(500).send("Error registering for event");
  }
});

// User view all registrations with QR
router.get("/myEvents", isLoggedIn, async (req, res) => {
  try {
    const registrations = await EventRegistration.find({
      user: req.session.user._id,
    })
      .populate("event")
      .sort({ createdAt: -1 });

    res.render("user/myEvents", { user: req.session.user, registrations });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching your events");
  }
});

module.exports = router;
