const mongoose = require("mongoose");

const eventSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },
  date: { type: Date, required: true }, // changed to Date type
  time: { type: String, required: true },
  venue: { type: String, required: true },
  regFee: { type: Number, required: true },
  participants: { type: Number, required: true },
  contactInfo: { type: String, required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "EventCoordinator" },
  status: {
    type: String,
    enum: ["draft", "pending", "approved", "rejected"],
    default: "draft",
  },
  media: [{ type: String }],
  department: {
    type: String,
    enum: [
      "MCA",
      "MBA",
      "iMCA",
      "Btech.NASB",
      "Btech.EEE",
      "Btech.CE",
      "Btech.ME",
      "Btech.CSE",
      "Btech.ECE",
      "All",
    ],
    default: "All",
  },
  assignedFaculty: { type: mongoose.Schema.Types.ObjectId, ref: "Faculty" },
  rejectionNote: { type: String },
  notifications: [
    {
      message: String,
      createdAt: { type: Date, default: Date.now },
    },
  ],
});

module.exports = mongoose.model("Event", eventSchema);
