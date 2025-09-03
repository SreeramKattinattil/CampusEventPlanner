const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const Event = require("../models/Event");

// Middleware to protect Event Coordinator routes
function isEventCoordinator(req, res, next) {
  if (req.session.user && req.session.user.role === "eventCoordinator") {
    return next();
  }
  res.redirect("/login");
}

// Multer storage config for multiple images/videos
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/"); // make sure /uploads exists
  },
  filename: function (req, file, cb) {
    cb(
      null,
      file.fieldname + "-" + Date.now() + path.extname(file.originalname)
    );
  },
});

const upload = multer({ storage: storage });

// Event Coordinator Dashboard
router.get("/dashboard", isEventCoordinator, async (req, res) => {
  try {
    // Fetch events created by this coordinator
    const events = await Event.find({ createdBy: req.session.user._id });

    res.render("eventCoordinator/eventCoordinatorDashboard", {
      coordinator: req.session.user,
      events, // ✅ pass events to EJS
    });
  } catch (err) {
    console.error("Error loading dashboard:", err);
    res.status(500).send("Error loading dashboard");
  }
});

// Show Create Event form
router.get("/create-event", isEventCoordinator, (req, res) => {
  res.render("eventCoordinator/createEvent", {
    coordinator: req.session.user,
  });
});

// Handle Create Event POST
// Handle Create Event POST
router.post(
  "/create-event",
  isEventCoordinator,
  upload.array("media", 10), // multiple files
  async (req, res) => {
    try {
      const {
        name,
        description,
        date,
        time,
        venue,
        regFee,
        participants,
        contactInfo,
        department, // <-- Add this
      } = req.body;

      const event = new Event({
        name,
        description,
        date,
        time,
        venue,
        regFee,
        participants,
        contactInfo,
        createdBy: req.session.user._id,
        status: "draft", // default status
        media: req.files.map((file) => file.filename),
        department, // <-- Save department
      });

      await event.save();
      res.redirect("/event-coordinator/dashboard");
    } catch (err) {
      console.error("Error creating event:", err);
      res.status(500).send("Error creating event");
    }
  }
);

module.exports = router;
