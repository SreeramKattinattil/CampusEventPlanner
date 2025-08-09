const mongoose = require("mongoose");
const dotenv = require("dotenv");
const User = require("./models/user"); // Adjust path if needed

dotenv.config();

mongoose
  .connect(process.env.MONGO_URI)
  .then(async () => {
    const users = await User.find({});
    console.log("📄 All users in DB:");
    console.log(users);
    mongoose.disconnect();
  })
  .catch((err) => console.error("DB error:", err));
