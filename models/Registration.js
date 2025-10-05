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

// Feedback Schema
const feedbackSchema = new mongoose.Schema({
  rating: { type: Number, min: 1, max: 5 },
  comment: { type: String, trim: true },
  createdAt: { type: Date, default: Date.now },
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
    qrCode: { type: String, default: null }, // ✅ QR code generated before payment
    status: {
      type: String,
      enum: ["registered", "attended"],
      default: "registered",
    },
    feedback: {
      type: feedbackSchema,
      default: null, // ✅ Ensure feedback is null by default
    },
  },
  { timestamps: true }
);

// Helper method: single participant
registrationSchema.methods.isSingleParticipant = function () {
  return this.participants.length === 1;
};

// Helper method: mark attendance
registrationSchema.methods.markAttended = function () {
  this.status = "attended";
  return this.save();
};

module.exports = mongoose.model("Registration", registrationSchema);
