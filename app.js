const express = require("express");
const mongoose = require("mongoose");
const session = require("express-session");
const MongoStore = require("connect-mongo");
require("dotenv").config();

const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/user");
const adminRoutes = require("./routes/admin");
const createDefaultAdmin = require("./hash");

const app = express();
const PORT = process.env.PORT || 3000;
const facultyRouter = require("./routes/faculty");

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.set("view engine", "ejs");

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
// MongoDB connect
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("✅ MongoDB connected");
    createDefaultAdmin();
  })
  .catch((err) => console.log("❌ MongoDB error:", err));

// Home
app.get("/", (req, res) => {
  res.redirect("/auth/login");
});

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
