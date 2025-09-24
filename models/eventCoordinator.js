const mongoose = require("mongoose");

const eventCoordinatorSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    department: { type: String, required: true },
    role: { type: String, default: "eventCoordinator" },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Faculty",
      required: true,
    },

    events: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Event",
      },
    ],

    media: [
      {
        url: { type: String, required: true },
        type: { type: String, enum: ["image", "video"], required: true },
        uploadedAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

// ✅ Use existing model if already compiled
module.exports =
  mongoose.models.EventCoordinator ||
  mongoose.model("EventCoordinator", eventCoordinatorSchema);
