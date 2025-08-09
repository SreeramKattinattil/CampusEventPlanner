const bcrypt = require("bcrypt");
const Admin = require("./models/admin");

async function createDefaultAdmin() {
  const existingAdmin = await Admin.findOne({ email: "admin@example.com" });
  if (existingAdmin) return;

  const hashedPassword = await bcrypt.hash("admin123", 10); // 👈 default password
  const admin = new Admin({
    name: "Super Admin",
    email: "admin@example.com",
    password: hashedPassword,
  });

  await admin.save();
  console.log("✅ Default admin created");
}

module.exports = createDefaultAdmin;
