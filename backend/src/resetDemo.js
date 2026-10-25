import mongoose from "mongoose";
import { MenuItem } from "./models.js";
// these files create their database models when they are loaded
import "./reservations.js";
import "./messages.js";
import "./orders.js";

const { MONGODB_URI } = process.env;

if (!MONGODB_URI) {
  console.error("Set MONGODB_URI in .env first.");
  process.exit(1);
}

// This deletes data, so it only runs when you add --yes on purpose
if (!process.argv.includes("--yes")) {
  console.error(
    "This deletes ALL menu items, orders, bookings and messages in the database named in MONGODB_URI.\n" +
      "The owner login is kept.\n" +
      "To go ahead, run:  npm run reset-demo -- --yes"
  );
  process.exit(1);
}

// The same starter menu as the seed script
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
console.log(`Database: ${mongoose.connection.name}`);

// Clears everything except the owner login (including the order number counter)
for (const name of mongoose.modelNames()) {
  if (name === "Admin") continue;
  const { deletedCount } = await mongoose.model(name).deleteMany({});
  console.log(`Cleared ${name}: ${deletedCount}`);
}

await MenuItem.insertMany(sampleMenu);
console.log("Added the starter menu. The demo is fresh again.");

await mongoose.disconnect();