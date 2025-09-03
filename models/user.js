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
    default: null, // optional
  },

  belongsToCollege: {
    type: String, // Yes / No (instead of boolean)
    required: true,
  },

  otherCollegeName: {
    type: String,
    default: null,
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
