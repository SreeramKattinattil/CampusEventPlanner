const express = require("express");
const router = express.Router();
const Razorpay = require("razorpay");
const crypto = require("crypto");
const bcrypt = require("bcrypt");
const User = require("../models/User");
const Event = require("../models/Event");
const Registration = require("../models/Registration");
const QRCode = require("qrcode");
const Transaction = require("../models/Transaction");

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
    const events = await Event.find({ status: "approved" })
      .populate("createdBy", "name")
      .populate("coordinator", "name")
      .sort({ date: 1 });

    const registeredCount = await Registration.countDocuments({
      userId: user._id,
    });
    const today = new Date();
    const upcomingCount = await Event.countDocuments({
      status: "approved",
      date: { $gte: today },
    });
    const feedbackCount = await Registration.countDocuments({
      userId: user._id,
      "feedback.comment": { $exists: true },
    });

    res.render("user/dashboard", {
      user,
      events,
      registeredCount,
      upcomingCount,
      feedbackCount,
      admin: { name: "Admin" },
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
   REGISTER FOR EVENT + CREATE TRANSACTION
=========================================================== */
router.post("/event/:id/register", isUser, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event || event.status !== "approved")
      return res.status(404).send("Event not found");

    const userId = req.session.user._id;
    const existingReg = await Registration.findOne({
      eventId: event._id,
      userId,
    });
    if (existingReg) return res.redirect(`/user/event/${event._id}/payment`);

    let participants = req.body.participants;
    if (!Array.isArray(participants)) participants = [participants];

    participants = participants.map((p) => ({
      name: p.name?.trim(),
      email: p.email?.trim(),
      mobNo: p.mobNo?.trim(),
      altMobNo: p.altMobNo?.trim() || "",
      college: p.college?.trim(),
      branch: p.branch?.trim(),
      semester: p.semester?.trim(),
    }));

    // Create registration
    const registration = new Registration({
      eventId: event._id,
      userId,
      participants,
      paymentStatus: "pending",
    });

    const qrData = {
      registrationId: registration._id,
      eventId: event._id,
      userId,
      participants: participants.map((p) => ({ name: p.name, email: p.email })),
    };
    registration.qrCode = await QRCode.toDataURL(JSON.stringify(qrData));
    await registration.save();

    // Create transaction
    await Transaction.create({
      event: event._id,
      coordinator: event.coordinator || event.createdBy,
      user: userId,
      amount: event.regFee,
      paymentMethod: "online",
      status: "pending",
      createdAt: new Date(),
    });

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

    const registration = await Registration.findByIdAndUpdate(
      registrationId,
      {
        paymentStatus: "paid",
        razorpayPaymentId,
        razorpayOrderId,
        razorpaySignature,
      },
      { new: true }
    );

    // Update corresponding transaction to success
    await Transaction.findOneAndUpdate(
      { user: registration.userId, event: registration.eventId },
      { status: "success", paymentMethod: "online", updatedAt: new Date() }
    );

    delete req.session.registrations[req.params.id];
    res.redirect("/user/dashboard");
  } catch (err) {
    console.error("Payment update error:", err);
    res.status(500).send("Error updating payment status.");
  }
});

/* ===========================================================
   VIEW MY REGISTRATIONS + FEEDBACK
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

// Feedback submission
router.post("/registration/:id/feedback", isUser, async (req, res) => {
  try {
    const { comment } = req.body;
    const registration = await Registration.findById(req.params.id).populate(
      "eventId"
    );
    if (!registration) return res.status(404).send("Registration not found");

    if (
      registration.userId.toString() !== req.session.user._id.toString() ||
      registration.paymentStatus !== "paid" ||
      registration.status !== "attended"
    ) {
      return res.status(403).send("You are not authorized to submit feedback.");
    }

    registration.feedback = { comment: comment.trim() };
    await registration.save();
    res.redirect("/user/my-registrations");
  } catch (err) {
    console.error("Feedback submission error:", err);
    res.status(500).send("Error submitting feedback");
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
    const registrations = await Registration.find({
      userId: req.session.user._id,
    }).populate("eventId");
    res.render("user/myEvents", { user: req.session.user, registrations });
  } catch (err) {
    console.error("My Events error:", err);
    res.status(500).send("Server Error");
  }
});

// ============================
/// ============================
// Upcoming Events / Reminders
// ============================
router.get("/reminders", isUser, async (req, res) => {
  try {
    const userId = req.session.user._id;
    const registrations = await Registration.find({ userId })
      .populate("eventId")
      .lean();

    const now = new Date();
    const upcomingEvents = registrations
      .filter((reg) => reg.eventId && reg.eventId.date)
      .map((reg) => {
        const event = reg.eventId;
        const eventTime = new Date(event.date);
        const diffMs = eventTime - now;
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

        let reminderMessages = [];

        if (diffDays > 1) {
          reminderMessages.push(
            `Your event "${event.name}" is in ${diffDays} days!`
          );
        } else if (diffDays === 1) {
          reminderMessages.push(`Your event "${event.name}" is tomorrow!`);
        } else if (diffHours > 1) {
          reminderMessages.push(
            `Your event "${event.name}" will start in ${diffHours} hours!`
          );
        } else if (diffHours <= 1 && diffHours > 0) {
          reminderMessages.push(`Your event "${event.name}" is starting soon!`);
        } else if (diffHours <= 0) {
          reminderMessages.push(
            `Your event "${event.name}" has already started or ended.`
          );
        }

        return {
          eventName: event.name,
          eventDate: eventTime.toLocaleString(),
          reminderMessages,
          status: reg.status || "registered",
        };
      });

    res.render("user/reminders", { user: req.session.user, upcomingEvents });
  } catch (err) {
    console.error("Error fetching reminders:", err);
    res.status(500).send("Failed to fetch reminders");
  }
});

/* ===========================================================
   MEMORIES PAGE (User view)
=========================================================== */
const Media = require("../models/Media");
// GET: Memories Page
router.get("/memories", isUser, async (req, res) => {
  try {
    const mediaList = await Media.find()
      .populate("event", "name")
      .populate("coordinator", "name")
      .sort({ createdAt: -1 })
      .lean();

    res.render("user/memories", {
      user: req.session.user,
      mediaList,
    });
  } catch (err) {
    console.error("Error loading memories:", err);
    res.status(500).send("Failed to load memories");
  }
});

module.exports = router;

// Reminder thresholds
