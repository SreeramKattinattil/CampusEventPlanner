const express = require("express");
const bcrypt = require("bcrypt");
const router = express.Router();

const User = require("../models/User");
const Admin = require("../models/Admin");
const Faculty = require("../models/Faculty");
const EventCoordinator = require("../models/eventCoordinator");

// =========================
// Render Pages
// =========================
router.get("/login", (req, res) => res.render("login"));
router.get("/register", (req, res) => res.render("register"));

// =========================
// Student Registration
// =========================
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
    college, // only used if external student
  } = req.body;

  if (password !== confirmPassword) {
    return res.send("Passwords do not match");
  }

  try {
    // Check duplicate email
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.send("User already exists");

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Decide college name
    let collegeName = "SNGCE"; // default
    let belongsToCollege = "yes";
    let otherCollegeName = null;

    if (isCollegeStudent === "no") {
      belongsToCollege = "no";
      collegeName = college; // take input if external
      otherCollegeName = college;
    }

    // Create new user
    await User.create({
      name,
      email,
      password: hashedPassword,
      mobile,
      alternateMobile: alternateMobile || null,
      semester,
      department,
      belongsToCollege,
      college: collegeName, // 🔹 always filled
      otherCollegeName, // 🔹 only for external students
      role: "user",
    });

    res.redirect("/login");
  } catch (err) {
    console.error("Registration error:", err);
    res.send("Registration failed");
  }
});

// =========================
// Login → role-based redirect
// =========================
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const users = [
      { model: Admin, role: "admin" },
      { model: Faculty, role: "faculty" },
      { model: EventCoordinator, role: "eventCoordinator" },
      { model: User, role: "user" },
    ];

    for (const u of users) {
      const user = await u.model.findOne({ email });
      if (user && (await bcrypt.compare(password, user.password))) {
        // Save session
        req.session.user = {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: u.role,
          department: u.role === "faculty" ? user.department : undefined,
        };

        // Redirect by role
        let redirectUrl = "/login";
        switch (u.role) {
          case "admin":
            redirectUrl = "/admin/adminDashboard";
            break;
          case "faculty":
            redirectUrl = "/faculty/dashboard";
            break;
          case "eventCoordinator":
            redirectUrl = "/event-coordinator/dashboard";
            break;
          case "user":
            redirectUrl = "/user/dashboard";
            break;
        }

        return req.session.save(() => res.redirect(redirectUrl));
      }
    }

    // Invalid login
    res.send("Invalid email or password");
  } catch (err) {
    console.error("Login error:", err);
    res.send("Login failed");
  }
});

// =========================
// Logout
// =========================
router.get("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/login"));
});

module.exports = router;
