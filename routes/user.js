const express = require("express");
const router = express.Router();
const Razorpay = require("razorpay");
const crypto = require("crypto");
const bcrypt = require("bcrypt");
const User = require("../models/User");
const Event = require("../models/Event");
const Registration = require("../models/Registration");
const EventRegistration = require("../models/EventRegistration");
const QRCode = require("qrcode");
// Razorpay instance
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Middleware: allow only logged-in users
function isUser(req, res, next) {
  const role = req.session.user?.role;
  if (["user", "faculty", "admin", "eventCoordinator"].includes(role)) {
    return next();
  }
  return res.status(403).send("Access denied");
}

/* ===========================================================
   USER DASHBOARD
=========================================================== */
router.get("/dashboard", isUser, async (req, res) => {
  try {
    const user = req.session.user;
    const events = await Event.find({ status: "approved" }).sort({ date: 1 });

    const registeredCount = await Registration.countDocuments({
      userId: user._id,
    });
    const today = new Date();
    const upcomingCount = await Event.countDocuments({
      status: "approved",
      date: { $gte: today },
    });

    let feedbackCount = 0;
    try {
      const Feedback = require("../models/Feedback");
      feedbackCount = await Feedback.countDocuments({ userId: user._id });
    } catch (err) {
      console.warn("Feedback model not found, skipping feedback count");
    }

    res.render("user/dashboard", {
      user,
      events,
      registeredCount,
      upcomingCount,
      feedbackCount,
    });
  } catch (err) {
    console.error("Dashboard error:", err);
    res.status(500).send("Error loading dashboard.");
  }
});

/* ===========================================================
   EVENT DETAILS
=========================================================== */
router.get("/event/:id", isUser, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event || event.status !== "approved")
      return res.status(404).send("Event not found");

    const existingReg = await Registration.findOne({
      eventId: event._id,
      userId: req.session.user._id,
    });

    res.render("user/eventDetails", {
      event,
      user: req.session.user,
      registration: existingReg,
    });
  } catch (err) {
    console.error("Event details error:", err);
    res.status(500).send("Server Error");
  }
});

/* ===========================================================
   REGISTER FOR EVENT
=========================================================== */

router.post("/event/:id/register", isUser, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event || event.status !== "approved")
      return res.status(404).send("Event not found");

    const userId = req.session.user._id;

    // Check if user already registered
    const existingReg = await Registration.findOne({
      eventId: event._id,
      userId,
    });
    if (existingReg) return res.redirect(`/user/event/${event._id}/payment`);

    // Prepare participants data
    let participants = req.body.participants;
    if (!Array.isArray(participants)) participants = [participants];

    participants = participants.map((p, index) => ({
      name: p.name?.trim(),
      email: p.email?.trim(),
      mobNo: p.mobNo?.trim(),
      altMobNo: p.altMobNo?.trim() || "",
      college: p.college?.trim(),
      branch: p.branch?.trim(),
      semester: p.semester?.trim(),
    }));

    // Create new registration
    const registration = new Registration({
      eventId: event._id,
      userId,
      participants,
      paymentStatus: "pending",
    });

    // ✅ Generate QR code for entire registration (could include all participants)
    // If you want individual QR per participant, you can loop over participants
    // Here we generate one QR code for the registration
    const qrData = {
      registrationId: registration._id,
      eventId: event._id,
      userId,
      participants: participants.map((p) => ({ name: p.name, email: p.email })),
    };

    registration.qrCode = await QRCode.toDataURL(JSON.stringify(qrData));

    // Save registration with QR code
    await registration.save();

    // Save registration ID in session for payment
    if (!req.session.registrations) req.session.registrations = {};
    req.session.registrations[event._id] = registration._id;

    res.redirect(`/user/event/${event._id}/payment`);
  } catch (err) {
    console.error("Registration error:", err);
    res.status(500).send("Error submitting registration.");
  }
});

/* ===========================================================
   PAYMENT PAGE
=========================================================== */
router.get("/event/:id/payment", isUser, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event || event.status !== "approved")
      return res.status(404).send("Event not found");

    const registrationId = req.session.registrations?.[event._id];
    if (!registrationId) return res.redirect(`/user/event/${event._id}`);

    const registration = await Registration.findById(registrationId);

    const options = {
      amount: event.regFee * 100,
      currency: "INR",
      receipt: `receipt_${registration._id}`,
      payment_capture: 1,
    };
    const order = await razorpay.orders.create(options);

    res.render("user/paymentPage", {
      event,
      registration,
      user: req.session.user,
      razorpayKey: process.env.RAZORPAY_KEY_ID,
      orderId: order.id,
      amount: options.amount,
    });
  } catch (err) {
    console.error("Payment page error:", err);
    res.status(500).send("Error loading payment page.");
  }
});

/* ===========================================================
   PAYMENT SUCCESS
=========================================================== */
router.post("/event/:id/payment-success", isUser, async (req, res) => {
  try {
    const registrationId = req.session.registrations?.[req.params.id];
    if (!registrationId)
      return res.status(400).send("No registration found in session");

    const { razorpayPaymentId, razorpayOrderId, razorpaySignature } = req.body;

    const hmac = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET);
    hmac.update(razorpayOrderId + "|" + razorpayPaymentId);
    const generatedSignature = hmac.digest("hex");

    if (generatedSignature !== razorpaySignature)
      return res.status(400).send("Payment verification failed");

    await Registration.findByIdAndUpdate(registrationId, {
      paymentStatus: "paid",
      razorpayPaymentId,
      razorpayOrderId,
      razorpaySignature,
    });
    delete req.session.registrations[req.params.id];

    res.redirect("/user/dashboard");
  } catch (err) {
    console.error("Payment update error:", err);
    res.status(500).send("Error updating payment status.");
  }
});

/* ===========================================================
   VIEW MY REGISTRATIONS
=========================================================== */
router.get("/my-registrations", isUser, async (req, res) => {
  try {
    const registrations = await Registration.find({
      userId: req.session.user._id,
    })
      .populate("eventId")
      .sort({ createdAt: -1 });

    res.render("user/myRegistrations", {
      user: req.session.user,
      registrations,
    });
  } catch (err) {
    console.error("My Registrations error:", err);
    res.status(500).send("Server Error");
  }
});

/* ===========================================================
   PROFILE & CHANGE PASSWORD
=========================================================== */
router.get("/profile", isUser, async (req, res) => {
  try {
    const user = await User.findById(req.session.user._id);
    if (!user) return res.redirect("/login");

    const registrations = await Registration.find({ userId: user._id })
      .populate("eventId")
      .sort({ createdAt: -1 });

    res.render("user/profile", {
      user,
      registrations,
      success: null,
      error: null,
    });
  } catch (err) {
    console.error("Profile page error:", err);
    res.status(500).send("Server error");
  }
});

router.post("/profile", isUser, async (req, res) => {
  try {
    const { name, department, semester, mobile } = req.body;
    const user = await User.findById(req.session.user._id);
    if (!user) return res.redirect("/login");

    user.name = name.trim() || user.name;
    user.department = department.trim() || user.department;
    user.semester = semester.trim() || user.semester;
    user.mobile = mobile.trim() || user.mobile;

    await user.save();
    req.session.user = user;

    const registrations = await Registration.find({ userId: user._id })
      .populate("eventId")
      .sort({ createdAt: -1 });

    res.render("user/profile", {
      user,
      registrations,
      success: "✅ Profile updated successfully!",
      error: null,
    });
  } catch (err) {
    console.error("Profile update error:", err);
    const registrations = await Registration.find({
      userId: req.session.user._id,
    })
      .populate("eventId")
      .sort({ createdAt: -1 });

    res.render("user/profile", {
      user: req.session.user,
      registrations,
      success: null,
      error: "⚠️ Something went wrong, try again.",
    });
  }
});

router.get("/change-password", (req, res) => res.render("changePassword"));

router.post("/change-password", async (req, res) => {
  try {
    const { email, newPassword, confirmPassword } = req.body;
    if (newPassword !== confirmPassword)
      return res.render("changePassword", {
        error: "❌ Passwords do not match",
      });

    const user = await User.findOne({ email });
    if (!user)
      return res.render("changePassword", {
        error: "❌ No account found with this email",
      });

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    res.render("changePassword", {
      success:
        "✅ Password changed successfully. You can now login with your new password.",
    });
  } catch (err) {
    console.error("Change password error:", err);
    res.render("changePassword", {
      error: "⚠️ Something went wrong. Try again.",
    });
  }
});

/* ===========================================================
   MY EVENTS (QR tickets)
=========================================================== */
router.get("/myEvents", isUser, async (req, res) => {
  try {
    const registrations = await EventRegistration.find({
      user: req.session.user._id,
    }).populate("event");
    res.render("user/myEvents", { user: req.session.user, registrations });
  } catch (err) {
    console.error("My Events error:", err);
    res.status(500).send("Server Error");
  }
});

module.exports = router;
