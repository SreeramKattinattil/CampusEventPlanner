const express = require("express");
const bcrypt = require("bcrypt");
const router = express.Router();

const User = require("../models/user");
const Admin = require("../models/admin");
const Faculty = require("../models/faculty");
const EventCoordinator = require("../models/eventCoordinator");

// -------------------- LOGIN & REGISTER --------------------

// Render login page
router.get("/login", (req, res) => {
  res.render("login");
});

// Render register page (for regular students/users)
router.get("/register", (req, res) => {
  res.render("register");
});

// Handle user registration
router.post("/register", async (req, res) => {
  const {
    name,
    email,
    password,
    confirmPassword,
    semester,
    department,
    isCollegeStudent,
    college,
  } = req.body;

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.send("User already exists");
    }

    if (password !== confirmPassword) {
      return res.send("Passwords do not match");
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Decide college name based on selection
    const belongsToCollege =
      isCollegeStudent === "yes" ? "SNGCE" : college || "Unknown";

    await User.create({
      name,
      email,
      password: hashedPassword,
      semester,
      department,
      belongsToCollege,
      role: "user",
    });

    res.redirect("/login");
  } catch (err) {
    console.error("Registration error:", err);
    res.send("Registration failed");
  }
});

// -------------------- LOGIN FOR ALL ROLES --------------------
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    // Admin Login
    const admin = await Admin.findOne({ email });
    if (admin && (await bcrypt.compare(password, admin.password))) {
      req.session.user = {
        _id: admin._id,
        name: admin.name,
        email: admin.email,
        role: "admin",
      };
      return res.redirect("/admin/adminDashboard");
    }

    // Faculty Login
    const faculty = await Faculty.findOne({ email });
    if (faculty && (await bcrypt.compare(password, faculty.password))) {
      req.session.user = {
        _id: faculty._id,
        name: faculty.name,
        email: faculty.email,
        role: "faculty",
      };
      return res.redirect("/faculty/dashboard");
    }

    // Event Coordinator Login
    const coordinator = await EventCoordinator.findOne({ email });
    if (coordinator && (await bcrypt.compare(password, coordinator.password))) {
      req.session.user = {
        _id: coordinator._id,
        name: coordinator.name,
        email: coordinator.email,
        role: "eventCoordinator",
      };
      return res.redirect("/event-coordinator/dashboard");
    }

    // User Login
    const user = await User.findOne({ email });
    if (user && (await bcrypt.compare(password, user.password))) {
      req.session.user = {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: "user",
      };
      return res.redirect("/user/dashboard");
    }

    // No match found
    res.send("Invalid email or password");
  } catch (err) {
    console.error("Login error:", err);
    res.send("Login failed");
  }
});

// -------------------- LOGOUT --------------------
router.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/login");
  });
});

module.exports = router;
