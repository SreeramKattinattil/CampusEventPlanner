const mongoose = require("mongoose");

const mediaSchema = new mongoose.Schema({
  event: { type: mongoose.Schema.Types.ObjectId, ref: "Event", required: true },
  coordinator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "EventCoordinator",
    required: true,
  }, // <-- Fix this
  caption: { type: String },
  files: [
    {
      mediaUrl: { type: String },
      mediaType: { type: String, enum: ["image", "video"] },
    },
  ],
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Media", mediaSchema);
