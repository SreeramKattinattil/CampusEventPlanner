const mongoose = require("mongoose");

// Participant Schema
const participantSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, trim: true },
  mobNo: { type: String, required: true, trim: true },
  altMobNo: { type: String, default: "" },
  college: { type: String, required: true, trim: true },
  branch: { type: String, required: true, trim: true },
  semester: { type: String, required: true, trim: true },
});

// Registration Schema
const registrationSchema = new mongoose.Schema(
  {
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    participants: {
      type: [participantSchema],
      required: true,
      validate: {
        validator: (v) => Array.isArray(v) && v.length > 0,
        message: "There must be at least one participant",
      },
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid"],
      default: "pending",
    },
    razorpayOrderId: { type: String, default: null },
    razorpayPaymentId: { type: String, default: null },
    razorpaySignature: { type: String, default: null },
  },
  { timestamps: true }
);

// Optional: helper method to check if registration is single-participant
registrationSchema.methods.isSingleParticipant = function () {
  return this.participants.length === 1;
};

module.exports = mongoose.model("Registration", registrationSchema);
