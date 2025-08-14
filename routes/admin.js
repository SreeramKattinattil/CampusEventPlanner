const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const Faculty = require("../models/faculty");

// Middleware to protect admin routes
function isAdmin(req, res, next) {
  if (req.session.user && req.session.user.role === "admin") {
    return next();
  }
  return res.status(403).send("Access denied");
}

// Admin Dashboard
router.get("/adminDashboard", isAdmin, (req, res) => {
  res.render("admin/adminDashboard", { user: req.session.user });
});

// Add Faculty
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
    console.error("Error adding faculty:", err);
    res.send("Error adding faculty");
  }
});

// View all faculties
router.get("/facultyList", isAdmin, async (req, res) => {
  try {
    const facultyList = await Faculty.find({});
    res.render("admin/facultyList", { facultyList });
  } catch (err) {
    console.error(err);
    res.send("Error fetching faculties");
  }
});

module.exports = router;
