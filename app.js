const express = require("express");
const mongoose = require("mongoose");
const session = require("express-session");
const MongoStore = require("connect-mongo");
require("dotenv").config();

const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/user");
const adminRoutes = require("./routes/admin");
const facultyRouter = require("./routes/faculty");
const eventCoordinatorRoutes = require("./routes/eventCoordinator");
const dashboardRoutes = require("./routes/dashboard");

const createDefaultAdmin = require("./hash");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.set("view engine", "ejs");

// Serve uploads folder so files can be accessed
app.use("/uploads", express.static("uploads"));

// Session setup
app.use(
  session({
    secret: "campus-secret-key",
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: process.env.MONGO_URI }),
  })
);

// Routes
app.use("/", authRoutes);
app.use("/user", userRoutes);
app.use("/admin", adminRoutes);
app.use("/faculty", facultyRouter);
app.use("/event-coordinator", eventCoordinatorRoutes); // ✅ keep this
app.use("/dashboard", dashboardRoutes);
// MongoDB connect
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("✅ MongoDB connected");
    createDefaultAdmin();
  })
  .catch((err) => console.log("❌ MongoDB error:", err));

// Redirect home
app.get("/", (req, res) => {
  res.redirect("/login");
});

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
