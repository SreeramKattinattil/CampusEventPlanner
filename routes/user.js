// D:\MiniProject\CampusEventPlanner\routes\user.js

const express = require("express");
const router = express.Router();

router.get("/dashboard", (req, res) => {
  // Check if the user is logged in and has the correct role
  if (req.session.role !== "user") {
    return res.status(403).send("Access denied");
  }

  // Check if the user data exists in the session
  // This assumes you saved user information to the session during login
  const user = req.session.user;
  if (!user) {
    // Handle the case where user data is missing in the session
    return res
      .status(400)
      .send("User data not found in session. Please log in again.");
  }

  // Pass the user object to the EJS template
  res.render("user/dashboard", { user: user });
});

module.exports = router;
