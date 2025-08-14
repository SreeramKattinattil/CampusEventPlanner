const mongoose = require("mongoose");

const eventCoordinatorSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  department: { type: String, required: true },
  role: { type: String, default: "eventCoordinator" },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Faculty" },
});

module.exports = mongoose.model("EventCoordinator", eventCoordinatorSchema);
