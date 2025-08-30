const mongoose = require("mongoose");

const eventCoordinatorSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  department: { type: String, required: true },
  role: { type: String, default: "eventCoordinator" },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Faculty" },

  // New field for storing multiple media (images/videos)
  media: [
    {
      url: { type: String, required: true }, // file path or cloud URL
      type: { type: String, enum: ["image", "video"], required: true }, // media type
      uploadedAt: { type: Date, default: Date.now },
    },
  ],
});

module.exports = mongoose.model("EventCoordinator", eventCoordinatorSchema);
