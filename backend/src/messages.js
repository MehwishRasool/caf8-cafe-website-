import mongoose from "mongoose";
import { rateLimit } from "express-rate-limit";

/* ---------- Database model ---------- */
const toJSON = {
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  },
};

const messageSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, trim: true, maxlength: 120 },
    message: { type: String, required: true, trim: true, maxlength: 2000 },
    read: { type: Boolean, default: false },
  },
  { timestamps: true, toJSON }
);

const Message = mongoose.model("Message", messageSchema);

/* ---------- Checking what the visitor typed ---------- */
function parseMessage(body = {}) {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";

  if (name.length < 2 || name.length > 80) return { error: "Enter your name." };
  if (email.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Enter a valid email address." };
  }
  if (message.length < 5) return { error: "Write your message." };
  if (message.length > 2000) {
    return { error: "Messages can be up to 2000 characters." };
  }
  return { data: { name, email, message } };
}

const sendLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many messages. Please try again later." },
});

/* ---------- Routes ---------- */
export function registerMessageRoutes(app, requireAdmin) {
  // Public: the contact form
  app.post("/api/messages", sendLimiter, async (req, res) => {
    // Hidden "website" field: people never see it, spam bots fill it in.
    // We pretend it worked and save nothing.
    if (req.body?.website) return res.status(201).json({ ok: true });

    const { data, error } = parseMessage(req.body);
    if (error) return res.status(400).json({ error });

    await Message.create(data);
    res.status(201).json({ ok: true });
  });

  // Admin: newest first
  app.get("/api/admin/messages", requireAdmin, async (_req, res) => {
    res.json(await Message.find().sort({ createdAt: -1 }).limit(200));
  });

  // Admin: mark as read / unread
  app.put("/api/admin/messages/:id/read", requireAdmin, async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ error: "Message not found." });
    }
    if (typeof req.body?.read !== "boolean") {
      return res.status(400).json({ error: "Send read as true or false." });
    }
    const message = await Message.findByIdAndUpdate(
      req.params.id,
      { read: req.body.read },
      { new: true }
    );
    if (!message) return res.status(404).json({ error: "Message not found." });
    res.json(message);
  });

  // Admin: delete
  app.delete("/api/admin/messages/:id", requireAdmin, async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ error: "Message not found." });
    }
    const message = await Message.findByIdAndDelete(req.params.id);
    if (!message) return res.status(404).json({ error: "Message not found." });
    res.status(204).end();
  });
}