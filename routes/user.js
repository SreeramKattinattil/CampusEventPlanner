// D:\MiniProject\CampusEventPlanner\routes\user.js

const express = require("express");
const router = express.Router();

router.get("/dashboard", (req, res) => {
  if (req.session.role !== "user") {
    return res.status(403).send("Access denied");
  }

  const user = req.session.user;
  if (!user) {
    return res
      .status(400)
      .send("User data not found in session. Please log in again.");
  }

  // Pass the user object to the EJS template
  res.render("user/dashboard", { user: user });
});

module.exports = router;
