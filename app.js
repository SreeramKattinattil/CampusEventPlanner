const express = require("express");
const mongoose = require("mongoose");
const session = require("express-session");
const MongoStore = require("connect-mongo");
require("dotenv").config();

const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/user");
const adminRoutes = require("./routes/admin");
const facultyRoutes = require("./routes/faculty");
const eventCoordinatorRoutes = require("./routes/eventCoordinator");
const paymentRoutes = require("./routes/payment");
const dashboardRoutes = require("./routes/dashboard");

const createDefaultAdmin = require("./hash");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// View Engine
app.set("view engine", "ejs");

// Static files
app.use("/uploads", express.static("uploads"));

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

// Routes
app.use("/", authRoutes);
app.use("/user", userRoutes);
app.use("/admin", adminRoutes);
app.use("/faculty", facultyRoutes);
app.use("/event-coordinator", eventCoordinatorRoutes);
app.use("/payment", paymentRoutes);
app.use("/dashboard", dashboardRoutes);

// Redirect home
app.get("/", (req, res) => {
  res.redirect("/login");
});

// MongoDB connect
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("✅ MongoDB connected");
    createDefaultAdmin();
    app.listen(PORT, () => {
      console.log(`🚀 Server running at  10.183.121.170:${PORT}`);
    });
  })
  .catch((err) => console.error("❌ MongoDB error:", err));
