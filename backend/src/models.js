
import mongoose from "mongoose";

export const CATEGORIES = ["Coffee", "Cold drinks", "Breakfast", "Pastries"];

// Sends "id" to the website instead of MongoDB's "_id"
const toJSON = {
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  },
};

const menuItemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    price: { type: Number, required: true, min: 0, max: 1000000 },
    category: { type: String, required: true, enum: CATEGORIES },
    description: { type: String, trim: true, maxlength: 200, default: "" },
    hidden: { type: Boolean, default: false },
  },
  { timestamps: true, toJSON }
);

const adminSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: { type: String, required: true },
  },
  { timestamps: true }
);

export const MenuItem = mongoose.model("MenuItem", menuItemSchema);
export const Admin = mongoose.model("Admin", adminSchema);