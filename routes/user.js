const express = require("express");
const router = express.Router();
const Razorpay = require("razorpay");
const crypto = require("crypto");

const Event = require("../models/Event");
const Registration = require("../models/Registration");

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
    res.render("user/userDashboard", { user, events });
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
    if (!event || event.status !== "approved") {
      return res.status(404).send("Event not found");
    }

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
   REGISTER FOR EVENT → Save as pending
=========================================================== */
router.post("/event/:id/register", isUser, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event || event.status !== "approved") {
      return res.status(404).send("Event not found");
    }

    const userId = req.session.user._id;

    // Prevent duplicate registrations
    const existingReg = await Registration.findOne({
      eventId: event._id,
      userId,
    });
    if (existingReg) {
      return res.redirect(`/user/event/${event._id}/payment`);
    }

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

    const registration = new Registration({
      eventId: event._id,
      userId,
      participants,
      paymentStatus: "pending",
    });

    await registration.save();

    if (!req.session.registrations) req.session.registrations = {};
    req.session.registrations[event._id] = registration._id;

    res.redirect(`/user/event/${event._id}/payment`);
  } catch (err) {
    console.error("Registration error:", err);
    res.status(500).send("Error submitting registration.");
  }
});

/* ===========================================================
   PAYMENT PAGE → Create Razorpay order and render checkout
=========================================================== */
router.get("/event/:id/payment", isUser, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event || event.status !== "approved")
      return res.status(404).send("Event not found");

    const registrationId = req.session.registrations?.[event._id];
    if (!registrationId) return res.redirect(`/user/event/${event._id}`);

    const registration = await Registration.findById(registrationId);

    // Create Razorpay order
    const options = {
      amount: event.regFee * 100, // in paise
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
   PAYMENT SUCCESS → verify signature & update status
=========================================================== */
router.post("/event/:id/payment-success", isUser, async (req, res) => {
  try {
    const registrationId = req.session.registrations?.[req.params.id];
    if (!registrationId)
      return res.status(400).send("No registration found in session");

    const { razorpayPaymentId, razorpayOrderId, razorpaySignature } = req.body;

    // Verify signature
    const hmac = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET);
    hmac.update(razorpayOrderId + "|" + razorpayPaymentId);
    const generatedSignature = hmac.digest("hex");

    if (generatedSignature !== razorpaySignature) {
      return res.status(400).send("Payment verification failed");
    }

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
   VIEW MY REGISTRATIONS (ALL, including unpaid)
=========================================================== */
router.get("/my-registrations", isUser, async (req, res) => {
  try {
    const registrations = await Registration.find({
      userId: req.session.user._id,
    })
      .populate("eventId") // include event details
      .sort({ createdAt: -1 });

    if (!registrations.length) {
      return res.render("user/myRegistrations", {
        user: req.session.user,
        registrations: [],
        message: "You have no registrations yet.",
      });
    }

    res.render("user/myRegistrations", {
      user: req.session.user,
      registrations,
    });
  } catch (err) {
    console.error("My Registrations error:", err);
    res.status(500).send("Server Error");
  }
});

module.exports = router;
