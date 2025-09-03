const express = require("express");
const router = express.Router();
const Event = require("../models/Event");
const User = require("../models/user");
const Faculty = require("../models/faculty");

// Middleware to check login
function isLoggedIn(req, res, next) {
  if (req.session.user) return next();
  return res.redirect("/login");
}

// GET /dashboard
router.get("/", isLoggedIn, async (req, res) => {
  try {
    const user = req.session.user;

    if (user.role === "user") {
      const events = await Event.find({ status: "approved" }).sort({ date: 1 });
      return res.render("user/dashboard", { user, events });
    }

    if (user.role === "faculty") {
      const events = await Event.find({ status: "approved" }).sort({ date: 1 });
      const stats = {
        draftCount: await Event.countDocuments({ status: "draft" }),
        approvedCount: await Event.countDocuments({ status: "approved" }),
        rejectedCount: await Event.countDocuments({ status: "rejected" }),
      };
      // 👇 EJS expects faculty + stats
      return res.render("faculty/facultyDashboard", {
        faculty: user,
        events,
        stats,
      });
    }

    if (user.role === "eventCoordinator") {
      const events = await Event.find({ status: "approved" }).sort({ date: 1 });
      return res.render("eventCoordinator/eventCoordinatorDashboard", {
        eventCoordinator: user, // 👈 pass as eventCoordinator
        events,
      });
    }

    if (user.role === "admin") {
      const search = (req.query.search || "").trim();
      const filter = search
        ? {
            $or: [
              { name: { $regex: search, $options: "i" } },
              { venue: { $regex: search, $options: "i" } },
              { description: { $regex: search, $options: "i" } },
            ],
          }
        : {};

      const [events, totalUsers, totalFaculty, totalEvents] = await Promise.all(
        [
          Event.find(filter).sort({ date: 1 }),
          User.countDocuments({ role: "user" }),
          Faculty.countDocuments(),
          Event.countDocuments(),
        ]
      );

      const stats = { totalUsers, totalFaculty, totalEvents };

      return res.render("admin/adminDashboard", {
        admin: user, // 👈 pass as admin
        events,
        stats,
        searchQuery: search,
      });
    }

    return res.status(403).send("Role not recognized");
  } catch (err) {
    console.error("Dashboard error:", err);
    return res.status(500).send("Error loading dashboard.");
  }
});

// GET /dashboard/eventDetails/:id
router.get("/eventDetails/:id", isLoggedIn, async (req, res) => {
  try {
    const user = req.session.user;
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).send("Event not found");

    if (user.role === "user") {
      return res.render("user/eventDetails", { user, event });
    }
    if (user.role === "faculty") {
      return res.render("faculty/eventDetails", { faculty: user, event });
    }
    if (user.role === "eventCoordinator") {
      return res.render("eventCoordinator/eventDetails", {
        eventCoordinator: user,
        event,
      });
    }
    if (user.role === "admin") {
      return res.render("admin/eventDetails", { admin: user, event });
    }
    return res.status(403).send("Access denied");
  } catch (err) {
    console.error(err);
    return res.status(500).send("Error loading event details.");
  }
});

module.exports = router;
