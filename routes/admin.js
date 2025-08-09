const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");

const Faculty = require("../models/faculty"); // Make sure this model exists

// Middleware to protect admin routes
function isAdmin(req, res, next) {
  if (req.session && req.session.role === "admin") {
    return next();
  }
  return res.status(403).send("Access denied");
}

// Admin Dashboard
router.get("/adminDashboard", isAdmin, (req, res) => {
  res.render("admin/adminDashboard", { user: req.session.user });
});

// GET: Add Faculty Form
router.get("/addFaculty", isAdmin, (req, res) => {
  res.render("admin/addFaculty"); // Make sure views/admin/addFaculty.ejs exists
});

// POST: Handle Faculty Form Submission
router.post("/add-faculty", isAdmin, async (req, res) => {
  const { name, email, password, department } = req.body;

  try {
    const existingFaculty = await Faculty.findOne({ email });
    if (existingFaculty) {
      return res.send("Faculty with this email already exists.");
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await Faculty.create({
      name,
      email,
      password: hashedPassword,
      department,
    });

    res.redirect("/admin/adminDashboard"); // update with your faculty list route
  } catch (err) {
    console.error("Error adding faculty:", err);
    res.send("Error adding faculty");
  }
});

// View All Faculties
router.get("/facultyList", isAdmin, async (req, res) => {
  try {
    const facultyList = await Faculty.find({});
    res.render("admin/facultyList", { facultyList });
  } catch (err) {
    console.error("Error fetching faculties:", err);
    res.send("Error fetching faculties");
  }
});

// GET /admin/faculty
router.get("/faculty", isAdmin, async (req, res) => {
  const search = req.query.search || "";
  const query = {
    $or: [
      { name: { $regex: search, $options: "i" } },
      { department: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
    ],
  };

  try {
    const facultyList = await Faculty.find(search ? query : {});
    res.render("admin/facultyList", { facultyList, search });
  } catch (err) {
    console.error("Error fetching faculty:", err);
    res.send("Error loading faculty list.");
  }
});

// POST /admin/faculty/delete/:id
router.post("/faculty/delete/:id", isAdmin, async (req, res) => {
  try {
    await Faculty.findByIdAndDelete(req.params.id);
    res.redirect("/admin/faculty");
  } catch (err) {
    console.error("Delete error:", err);
    res.send("Error deleting faculty.");
  }
});
router.post("/delete-faculty/:id", isAdmin, async (req, res) => {
  try {
    await Faculty.findByIdAndDelete(req.params.id);
    res.redirect("/admin/faculty");
  } catch (err) {
    console.error("Delete error:", err);
    res.send("Error deleting faculty.");
  }
});

// POST /admin/faculty/edit/:id
router.get("/edit-faculty/:id", isAdmin, async (req, res) => {
  try {
    const faculty = await Faculty.findById(req.params.id);
    if (!faculty) {
      return res.status(404).send("Faculty not found");
    }
    res.render("admin/editFaculty", { faculty }); // <-- Make sure this EJS file exists
  } catch (err) {
    console.error("Error fetching faculty:", err);
    res.status(500).send("Internal Server Error");
  }
});

router.post("/edit-faculty/:id", isAdmin, async (req, res) => {
  const { name, email, department } = req.body;

  try {
    await Faculty.findByIdAndUpdate(req.params.id, {
      name,
      email,
      department,
    });
    res.redirect("/admin/faculty");
  } catch (err) {
    console.error("Update error:", err);
    res.status(500).send("Error updating faculty.");
  }
});

module.exports = router;
