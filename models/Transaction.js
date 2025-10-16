const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema({
  event: { type: mongoose.Schema.Types.ObjectId, ref: "Event", required: true },
  coordinator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "EventCoordinator",
    required: true,
  },
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // optional for event creation
  amount: { type: Number, required: true },
  paymentMethod: {
    type: String,
    enum: ["online", "cash", "offline", "N/A"], // added "offline"
    default: "online",
  },

  status: {
    type: String,
    enum: ["success", "failed", "pending"],
    default: "success",
  },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Transaction", transactionSchema);
