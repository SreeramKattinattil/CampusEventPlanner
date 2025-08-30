const mongoose = require("mongoose");

const eventSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },
  date: { type: String, required: true },
  time: { type: String, required: true },
  venue: { type: String, required: true },
  regFee: { type: Number, required: true },
  participants: { type: Number, required: true },
  contactInfo: { type: String, required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "EventCoordinator" },
  status: {
    type: String,
    enum: ["draft", "approved", "rejected"],
    default: "draft",
  },
  media: [{ type: String }],
});

module.exports = mongoose.model("Event", eventSchema);
