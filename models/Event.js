const mongoose = require("mongoose");

const eventSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: { type: String },
    date: { type: Date, required: true },
    time: { type: String, required: true },
    venue: { type: String, required: true },
    regFee: { type: Number, required: true },
    participants: { type: Number, required: true },
    contactInfo: { type: String, required: true },

    // Relationships
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Faculty",
      required: true,
    }, // Faculty who created the event
    coordinator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "EventCoordinator",
    }, // Assigned coordinator

    // Status and department
    status: {
      type: String,
      enum: ["draft", "pending", "approved", "rejected"],
      default: "pending",
    },
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

    // Media and notes
    media: [{ type: String }],
    rejectionNote: { type: String },

    // Notifications
    notifications: [
      {
        message: String,
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  {
    timestamps: true, // adds createdAt and updatedAt automatically
  }
);

module.exports = mongoose.model("Event", eventSchema);
