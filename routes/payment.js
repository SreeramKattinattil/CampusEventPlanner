// routes/payment.js
const express = require("express");
const router = express.Router();
const Razorpay = require("razorpay");
const crypto = require("crypto");
const Registration = require("../models/Registration");
const Event = require("../models/Event");

// Initialize Razorpay instance
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Create Razorpay order and save registration
router.post("/create-order", async (req, res) => {
  try {
    const { eventId, participants } = req.body;

    // Validate participants
    if (!Array.isArray(participants) || participants.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "Participants are required" });
    }

    const event = await Event.findById(eventId);
    if (!event)
      return res
        .status(404)
        .json({ success: false, message: "Event not found" });

    const amountInPaise = event.regFee * 100 * participants.length;

    // Create Razorpay order
    const order = await razorpay.orders.create({
      amount: amountInPaise,
      currency: "INR",
      receipt: `receipt_${Date.now()}`,
    });

    // Save registration in DB with pending status
    const registration = new Registration({
      eventId,
      userId: req.session.user._id,
      participants: participants.map((p) => ({
        name: p.name,
        email: p.email,
        mobNo: p.mobNo,
        altMobNo: p.altMobNo || "",
        college: p.college,
        branch: p.branch,
        semester: p.semester,
      })),
      paymentStatus: "pending",
      razorpayOrderId: order.id,
    });

    await registration.save();

    res.json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      registrationId: registration._id,
    });
  } catch (err) {
    console.error("Order creation error:", err);
    res.status(500).json({ success: false, message: "Order creation failed" });
  }
});
// Verify payment
router.post("/verify", async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      registrationId,
    } = req.body;

    const hmac = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET);
    hmac.update(razorpay_order_id + "|" + razorpay_payment_id);
    const generatedSignature = hmac.digest("hex");

    if (generatedSignature === razorpay_signature) {
      // ✅ Update registration
      const registration = await Registration.findByIdAndUpdate(
        registrationId,
        {
          paymentStatus: "paid",
          razorpayPaymentId: razorpay_payment_id,
          razorpaySignature: razorpay_signature,
        },
        { new: true }
      ).populate("eventId userId");

      // ✅ Create a Transaction entry
      const Transaction = require("../models/Transaction");
      const Event = require("../models/Event");

      const event = await Event.findById(registration.eventId).populate(
        "createdBy"
      );

      if (event) {
        await Transaction.create({
          event: event._id,
          coordinator: event.createdBy?._id || null, // ensure ID exists
          user: registration.userId?._id || req.session.user._id, // fallback
          amount: event.regFee,
          paymentMethod: "online",
          status: "success",
        });
      }

      return res.json({
        success: true,
        message: "Payment verified and transaction recorded",
      });
    } else {
      return res
        .status(400)
        .json({ success: false, message: "Invalid signature" });
    }
  } catch (err) {
    console.error("Payment verification error:", err);
    res
      .status(500)
      .json({ success: false, message: "Payment verification failed" });
  }
});

module.exports = router;
