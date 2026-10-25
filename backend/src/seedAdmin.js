import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { Admin, MenuItem } from "./models.js";

const { MONGODB_URI, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;

if (!MONGODB_URI || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error("Set MONGODB_URI, ADMIN_EMAIL and ADMIN_PASSWORD in .env first.");
  process.exit(1);
}
if (ADMIN_PASSWORD.length < 12) {
  console.error("ADMIN_PASSWORD must be at least 12 characters.");
  process.exit(1);
}

// Starter menu. You can edit or delete all of it later from the admin page.
const sampleMenu = [
  { name: "Espresso", price: 350, category: "Coffee", description: "A short, strong shot." },
  { name: "Flat white", price: 550, category: "Coffee", description: "Espresso with silky steamed milk." },
  { name: "Cappuccino", price: 500, category: "Coffee", description: "Espresso, steamed milk and a thick foam top." },
  { name: "Latte", price: 550, category: "Coffee", description: "Mild and creamy, made with steamed milk." },
  { name: "Iced latte", price: 600, category: "Cold drinks", description: "Espresso and cold milk over ice." },
  { name: "Cold brew", price: 650, category: "Cold drinks", description: "Steeped for 12 hours, smooth and strong." },
  { name: "Fresh lemonade", price: 350, category: "Cold drinks", description: "Squeezed to order with a little mint." },
  { name: "Eggs on toast", price: 750, category: "Breakfast", description: "Two eggs your way on toasted sourdough." },
  { name: "Pancake stack", price: 850, category: "Breakfast", description: "Three pancakes with honey and butter." },
  { name: "Granola bowl", price: 650, category: "Breakfast", description: "Yogurt, granola and seasonal fruit." },
  { name: "Butter croissant", price: 400, category: "Pastries", description: "Baked fresh every morning." },
  { name: "Cinnamon roll", price: 450, category: "Pastries", description: "Warm, soft and glazed." },
];

await mongoose.connect(MONGODB_URI);

// The login name is saved in lowercase, so "Admin-Store" and "admin-store" are the same
const username = ADMIN_EMAIL.trim().toLowerCase();
const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);

// Creates the admin, or resets the password if this username already exists
await Admin.findOneAndUpdate(
  { email: username },
  { email: username, passwordHash },
  { upsert: true }
);

// Only one owner account is kept, so any older admin account is removed
const removed = await Admin.deleteMany({ email: { $ne: username } });

console.log(`Admin ready: ${username}`);
if (removed.deletedCount > 0) {
  console.log(`Removed ${removed.deletedCount} older admin account(s).`);
}

if ((await MenuItem.countDocuments()) === 0) {
  await MenuItem.insertMany(sampleMenu);
  console.log("Added the starter menu.");
} else {
  console.log("The menu already has items, so nothing was added.");
}

await mongoose.disconnect();