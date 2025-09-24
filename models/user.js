const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },

  email: {
    type: String,
    required: true,
    unique: true,
  },

  password: {
    type: String,
    required: true,
  },

  mobile: {
    type: String,
    required: true,
  },

  alternateMobile: {
    type: String,
    default: null,
  },

  // ✅ Replace belongsToCollege + otherCollegeName with a single college field
  college: {
    type: String,
    required: true,
    default: "SNGCE",
  },

  department: {
    type: String,
    required: true,
  },

  semester: {
    type: String,
    required: true,
  },

  role: {
    type: String,
    enum: ["user", "event-coordinator", "faculty", "admin"],
    default: "user",
  },
});

module.exports = mongoose.models.User || mongoose.model("User", userSchema);
