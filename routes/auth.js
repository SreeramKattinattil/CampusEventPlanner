const express = require("express");
const bcrypt = require("bcrypt");
const router = express.Router();

const User = require("../models/user");
const Admin = require("../models/admin");
const Faculty = require("../models/faculty");
const EventCoordinator = require("../models/eventCoordinator");

// Render login page
router.get("/login", (req, res) => res.render("login"));

// Render register page for students
router.get("/register", (req, res) => res.render("register"));

// Handle student registration
router.post("/register", async (req, res) => {
  const {
    name,
    email,
    password,
    confirmPassword,
    mobile,
    alternateMobile,
    semester,
    department,
    isCollegeStudent,
    college,
  } = req.body;

  if (password !== confirmPassword) return res.send("Passwords do not match");

  try {
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.send("User already exists");

    const hashedPassword = await bcrypt.hash(password, 10);

    // Normalize belongsToCollege & collegeName
    const belongsToCollege = isCollegeStudent === "yes" ? "yes" : "no";
    const otherCollegeName = isCollegeStudent === "no" ? college : null;

    // Create user
    await User.create({
      name,
      email,
      password: hashedPassword,
      mobile,
      alternateMobile: alternateMobile || null,
      semester,
      department,
      belongsToCollege,
      otherCollegeName,
      role: "user",
    });

    res.redirect("/login");
  } catch (err) {
    console.error("Registration error:", err);
    res.send("Registration failed");
  }
});

// Login for all roles → role-based redirect
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const users = [
      { model: Admin, role: "admin" },
      { model: Faculty, role: "faculty" },
      { model: EventCoordinator, role: "eventCoordinator" }, // 👈 camelCase
      { model: User, role: "user" },
    ];

    for (const u of users) {
      const user = await u.model.findOne({ email });
      if (user && (await bcrypt.compare(password, user.password))) {
        req.session.user = {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: u.role,
        };
        return req.session.save(() => res.redirect("/dashboard")); // 👈 single entry point
      }
    }

    res.send("Invalid email or password");
  } catch (err) {
    console.error("Login error:", err);
    res.send("Login failed");
  }
});

// Logout
router.get("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/login"));
});

module.exports = router;
