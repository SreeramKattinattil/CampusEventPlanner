const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const Faculty = require("../models/faculty");
const User = require("../models/user");

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

// View & Search Students
router.get("/students", async (req, res) => {
  try {
    const search = req.query.search || "";
    let filter = {};

    if (search.trim() !== "") {
      filter = {
        $or: [
          { name: { $regex: search, $options: "i" } },
          { department: { $regex: search, $options: "i" } },
          { belongsToCollege: { $regex: search, $options: "i" } }, // make sure collegeName exists in your schema
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

// Edit Student - Form
router.get("/edit-student/:id", isAdmin, async (req, res) => {
  try {
    const student = await User.findById(req.params.id);
    if (!student) {
      return res.status(404).send("Student not found");
    }
    res.render("admin/editStudent", { student });
  } catch (error) {
    console.error(error);
    res.status(500).send("Error fetching student");
  }
});
// Update student (save changes)
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

// Delete single student
router.post("/delete-student/:id", isAdmin, async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.redirect("/admin/students");
  } catch (error) {
    console.error(error);
    res.status(500).send("Error deleting student");
  }
});
// Bulk delete students
// Bulk delete students
router.post("/bulk-delete-students", isAdmin, async (req, res) => {
  try {
    const ids = req.body.selectedStudents; // ✅ from checkboxes

    if (!ids || ids.length === 0) {
      return res.redirect("/admin/students");
    }

    await User.deleteMany({ _id: { $in: ids }, role: "user" }); // ✅ use ids

    res.redirect("/admin/students");
  } catch (error) {
    console.error(error);
    res.status(500).send("Server error");
  }
});

module.exports = router;
