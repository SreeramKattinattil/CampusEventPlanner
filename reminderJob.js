const cron = require("node-cron");
const Registration = require("./models/Registration");
const Event = require("./models/Event");
const nodemailer = require("nodemailer");

// Configure email transporter
const transporter = nodemailer.createTransport({
  service: "gmail", // or another SMTP service
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Reminder schedule in milliseconds
const REMINDER_TIMES = {
  "2days": 2 * 24 * 60 * 60 * 1000, // 2 days
  "1day": 24 * 60 * 60 * 1000, // 1 day
  "12hours": 12 * 60 * 60 * 1000, // 12 hours
  "1hour": 1 * 60 * 60 * 1000, // 1 hour
};

// Cron job runs every 30 minutes
cron.schedule("*/30 * * * *", async () => {
  try {
    console.log("✅ Running event reminder job...");

    const now = new Date();

    // Fetch all registrations with upcoming events
    const registrations = await Registration.find()
      .populate("eventId")
      .populate("userId");

    for (const reg of registrations) {
      const eventTime = new Date(reg.eventId.date);

      for (const [key, ms] of Object.entries(REMINDER_TIMES)) {
        const diff = eventTime - now;

        // Check if this reminder is due and not already sent
        if (diff > 0 && diff <= ms && !reg.remindersSent.includes(key)) {
          // Send email
          await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: reg.userId.email,
            subject: `Reminder: Event "${reg.eventId.name}" is coming soon!`,
            text: `Hi ${reg.userId.name},\n\nYour event "${
              reg.eventId.name
            }" is scheduled on ${eventTime.toLocaleString()}.\n\nThis is your ${key.replace(
              /\d+/g,
              ""
            )} reminder.\n\n- Team`,
          });

          console.log(
            `✉️ Sent ${key} reminder to ${reg.userId.email} for event ${reg.eventId.name}`
          );

          // Mark reminder as sent
          reg.remindersSent.push(key);
          await reg.save();
        }
      }
    }
  } catch (err) {
    console.error("❌ Error in reminder job:", err);
  }
});
