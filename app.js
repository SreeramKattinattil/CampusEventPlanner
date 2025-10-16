require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const session = require("express-session");
const MongoStore = require("connect-mongo");

// Routes
const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/user");
const adminRoutes = require("./routes/admin");
const facultyRoutes = require("./routes/faculty");
const eventCoordinatorRoutes = require("./routes/eventCoordinator");
const paymentRoutes = require("./routes/payment");
const dashboardRoutes = require("./routes/dashboard");

// Utilities
const createDefaultAdmin = require("./hash");

// Initialize Express
const app = express();
const PORT = process.env.PORT || 3000;

// =========================
// Middleware
// =========================
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Static files
app.use("/uploads", express.static("uploads"));

// View engine
app.set("view engine", "ejs");

// Session setup
app.use(
  session({
    secret: process.env.SESSION_SECRET || "campus-secret-key",
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGO_URI,
      collectionName: "sessions",
    }),
    cookie: { maxAge: 1000 * 60 * 60 * 2 }, // 2 hours
  })
);

// =========================
// Routes
// =========================
app.use("/", authRoutes);
app.use("/user", userRoutes);
app.use("/admin", adminRoutes);
app.use("/faculty", facultyRoutes);
app.use("/event-coordinator", eventCoordinatorRoutes);
app.use("/payment", paymentRoutes);
app.use("/dashboard", dashboardRoutes);

// Default redirect to login
app.get("/", (req, res) => res.redirect("/login"));

// =========================
// MongoDB Connection
// =========================
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("✅ MongoDB connected");

    // Create default admin if not exists
    createDefaultAdmin();

    // Start server
    app.listen(PORT, () => {
      console.log(`🚀 Server running at http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err);
  });

// =========================
// Optional: Start background jobs
// =========================
require("./reminderJob"); // Reminder system cron job
