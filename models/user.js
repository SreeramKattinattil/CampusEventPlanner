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

  belongsToCollege: {
    type: String, // Changed from Boolean to String
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

module.exports = mongoose.model("User", userSchema);
