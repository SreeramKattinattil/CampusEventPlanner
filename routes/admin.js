const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const Faculty = require("../models/faculty");
const User = require("../models/user");
const Event = require("../models/Event");

// Middleware to protect admin routes
function isAdmin(req, res, next) {
  if (req.session.user && req.session.user.role === "admin") return next();
  return res.status(403).send("Access denied");
}

// ====================== DASHBOARD ======================
router.get("/adminDashboard", isAdmin, async (req, res) => {
  try {
    const search = req.query.search || "";
    let filter = {};

    if (search.trim() !== "") {
      filter = {
        $or: [
          { name: { $regex: search, $options: "i" } },
          { venue: { $regex: search, $options: "i" } },
          { description: { $regex: search, $options: "i" } },
        ],
      };
    }

    const events = await Event.find(filter).sort({ date: 1 });

    const stats = {
      totalUsers: await User.countDocuments({ role: "user" }),
      totalFaculty: await Faculty.countDocuments(),
      totalEvents: await Event.countDocuments(),
    };

    res.render("admin/adminDashboard", {
      user: req.session.user,
      events,
      stats,
      searchQuery: search,
    });
  } catch (error) {
    console.error("Error loading admin dashboard:", error);
    res.status(500).send("Server error");
  }
});

// ====================== FACULTY ======================
router.get("/addFaculty", isAdmin, (req, res) => {
  res.render("admin/addFaculty");
});

router.post("/add-faculty", isAdmin, async (req, res) => {
  const { name, email, password, department } = req.body;
  try {
    const existingFaculty = await Faculty.findOne({ email });
    if (existingFaculty)
      return res.send("Faculty with this email already exists.");

    const hashedPassword = await bcrypt.hash(password, 10);
    await Faculty.create({ name, email, password: hashedPassword, department });

    res.redirect("/admin/adminDashboard");
  } catch (err) {
    console.error(err);
    res.send("Error adding faculty");
  }
});

router.get("/facultyList", isAdmin, async (req, res) => {
  try {
    const facultyList = await Faculty.find({});
    res.render("admin/facultyList", { facultyList });
  } catch (err) {
    console.error(err);
    res.send("Error fetching faculties");
  }
});

// ====================== STUDENTS ======================
router.get("/students", isAdmin, async (req, res) => {
  try {
    const search = req.query.search || "";
    let filter = {};

    if (search.trim() !== "") {
      filter = {
        $or: [
          { name: { $regex: search, $options: "i" } },
          { department: { $regex: search, $options: "i" } },
          { belongsToCollege: { $regex: search, $options: "i" } },
        ],
      };
    }

    const studentList = await User.find({ role: "user", ...filter });
    res.render("admin/students", { studentList, search });
  } catch (error) {
    console.error(error);
    res.status(500).send("Error fetching students");
  }
});

router.get("/edit-student/:id", isAdmin, async (req, res) => {
  try {
    const student = await User.findById(req.params.id);
    if (!student) return res.status(404).send("Student not found");
    res.render("admin/editStudent", { student });
  } catch (error) {
    console.error(error);
    res.status(500).send("Error fetching student");
  }
});

router.post("/edit-student/:id", isAdmin, async (req, res) => {
  try {
    const {
      name,
      email,
      belongsToCollege,
      otherCollegeName,
      department,
      semester,
    } = req.body;

    await User.findByIdAndUpdate(req.params.id, {
      name,
      email,
      belongsToCollege,
      otherCollegeName: belongsToCollege === "Yes" ? null : otherCollegeName,
      department,
      semester,
    });

    res.redirect("/admin/students");
  } catch (error) {
    console.error(error);
    res.status(500).send("Error updating student");
  }
});

router.post("/delete-student/:id", isAdmin, async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.redirect("/admin/students");
  } catch (error) {
    console.error(error);
    res.status(500).send("Error deleting student");
  }
});

// ====================== EVENTS ======================
router.get("/events", isAdmin, async (req, res) => {
  try {
    const search = req.query.search || "";
    let filter = {};

    if (search.trim() !== "") {
      filter = {
        $or: [
          { name: { $regex: search, $options: "i" } },
          { venue: { $regex: search, $options: "i" } },
          { department: { $regex: search, $options: "i" } },
        ],
      };
    }

    const events = await Event.find(filter).sort({ date: 1 });

    const stats = {
      totalUsers: await User.countDocuments({ role: "user" }),
      totalFaculty: await Faculty.countDocuments(),
      totalEvents: await Event.countDocuments(),
    };

    res.render("admin/adminDashboard", {
      // render adminDashboard.ejs
      user: req.session.user,
      events,
      stats,
      searchQuery: search,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Error fetching events");
  }
});

// ====================== EVENT DETAILS ======================
router.get("/eventDetails/:id", isAdmin, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).send("Event not found");

    res.render("admin/eventDetails", {
      user: req.session.user,
      event,
      role: "admin",
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Error fetching event details");
  }
});

// ====================== EVENT EDIT ======================
router.get("/edit-event/:id", isAdmin, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).send("Event not found");
    res.render("admin/editEvent", { event });
  } catch (error) {
    console.error(error);
    res.status(500).send("Error fetching event");
  }
});

router.post("/edit-event/:id", isAdmin, async (req, res) => {
  try {
    const { name, description, date, time, venue, regFee } = req.body;
    await Event.findByIdAndUpdate(req.params.id, {
      name,
      description,
      date,
      time,
      venue,
      regFee,
    });
    res.redirect(`/admin/eventDetails/${req.params.id}`);
  } catch (error) {
    console.error(error);
    res.status(500).send("Error updating event");
  }
});

// ====================== EVENT DELETE ======================
router.post("/delete-event/:id", isAdmin, async (req, res) => {
  try {
    await Event.findByIdAndDelete(req.params.id);
    res.redirect("/admin/adminDashboard");
  } catch (error) {
    console.error(error);
    res.status(500).send("Error deleting event");
  }
});

module.exports = router;
