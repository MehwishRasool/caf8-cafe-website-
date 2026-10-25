import crypto from "node:crypto";
import express from "express";
import mongoose from "mongoose";
import { rateLimit } from "express-rate-limit";
import { MenuItem } from "./models.js";
import { RESERVATION, ORDERING, DELIVERY } from "./config.js";
import { SITE_ORIGIN, originCheck } from "./Security.js";
import {
  createCheckout,
  demoMode,
  onlineEnabled,
  verifyReturn,
} from "./payments.js";
import {
  addDays,
  cafeNow,
  isRealDate,
  toHHMM,
  toMinutes,
  weekday,
} from "./dates.js";

const STATUSES = ["new", "preparing", "ready", "done", "cancelled"];

// which status changes the owner may make
const ALLOWED = {
  new: ["preparing", "cancelled"],
  preparing: ["ready", "cancelled"],
  ready: ["done", "cancelled"],
  done: [],
  cancelled: [],
};

// the private tracking code a customer gets for their order
const PUBLIC_ID = /^[A-Za-z0-9_-]{22}$/;
const makePublicId = () => crypto.randomBytes(16).toString("base64url");

/* ---------- Database models ---------- */
const toJSON = {
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    delete ret.safepayToken;
    return ret;
  },
};

const orderSchema = new mongoose.Schema(
  {
    number: { type: Number, required: true, unique: true },
    publicId: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    phone: { type: String, required: true, trim: true, maxlength: 25 },
    fulfilment: { type: String, enum: ["pickup", "delivery"], required: true },
    address: { type: String, trim: true, maxlength: 200, default: "" },
    date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    time: { type: String, default: "", match: /^(\d{2}:\d{2})?$/ },
    notes: { type: String, trim: true, maxlength: 200, default: "" },
    items: [
      {
        _id: false,
        name: { type: String, required: true },
        price: { type: Number, required: true },
        qty: { type: Number, required: true },
      },
    ],
    subtotal: { type: Number, required: true },
    deliveryFee: { type: Number, required: true, default: 0 },
    total: { type: Number, required: true },
    paymentMethod: { type: String, enum: ["cash", "online"], required: true },
    // unpaid = cash not yet handed over, pending = waiting for Safepay
    paymentStatus: {
      type: String,
      enum: ["unpaid", "pending", "paid", "failed"],
      required: true,
    },
    safepayToken: { type: String, select: false },
    status: { type: String, enum: STATUSES, default: "new" },
  },
  { timestamps: true, toJSON }
);
orderSchema.index({ date: 1, time: 1 });
orderSchema.index({ status: 1 });

const Order = mongoose.model("Order", orderSchema);

// hands out order numbers 1001, 1002, 1003 ... one at a time, safely
const Counter = mongoose.model(
  "Counter",
  new mongoose.Schema({ _id: String, seq: { type: Number, default: 0 } })
);

async function nextNumber() {
  const counter = await Counter.findOneAndUpdate(
    { _id: "order" },
    { $inc: { seq: 1 } },
    { upsert: true, new: true }
  );
  return 1000 + counter.seq;
}

/* ---------- Opening hours, pickup times and delivery ---------- */
function slotTimes(date) {
  const hours = RESERVATION.hours[weekday(date)];
  if (!hours) return [];
  const last = toMinutes(hours[1]) - ORDERING.lastPickupBeforeCloseMinutes;
  const times = [];
  for (
    let m = toMinutes(hours[0]);
    m <= last;
    m += ORDERING.slotMinutes
  ) {
    times.push(toHHMM(m));
  }
  return times;
}

// pickup: today or tomorrow, far enough ahead to prepare
function isPickupAllowed(date, time, now) {
  if (date === addDays(now.date, 1)) return true;
  return (
    date === now.date && toMinutes(time) >= now.minutes + ORDERING.leadMinutes
  );
}

const orderDates = (now) => [now.date, addDays(now.date, 1)];

// delivery: only while we are open
function deliveryOpenNow(now) {
  if (!DELIVERY.enabled) return false;
  const hours = RESERVATION.hours[weekday(now.date)];
  if (!hours) return false;
  return (
    now.minutes >= toMinutes(hours[0]) &&
    now.minutes <= toMinutes(hours[1]) - DELIVERY.lastOrderBeforeCloseMinutes
  );
}

async function usedSlots(date) {
  const rows = await Order.find({
    date,
    fulfilment: "pickup",
    status: { $ne: "cancelled" },
  }).select("time");
  const counts = {};
  for (const r of rows) counts[r.time] = (counts[r.time] ?? 0) + 1;
  return counts;
}

/* ---------- Checking what the customer sent ---------- */
function parseOrder(body = {}) {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  const notes = typeof body.notes === "string" ? body.notes.trim() : "";
  const address = typeof body.address === "string" ? body.address.trim() : "";
  const { fulfilment, payment, date, time, items } = body;

  if (name.length < 2 || name.length > 80) return { error: "Enter your name." };
  if (!/^[0-9+()\-\s]{7,25}$/.test(phone)) {
    return { error: "Enter a valid phone number." };
  }
  if (notes.length > 200) {
    return { error: "Notes must be 200 characters or fewer." };
  }
  if (fulfilment !== "pickup" && fulfilment !== "delivery") {
    return { error: "Choose delivery or pickup." };
  }
  if (payment !== "cash" && payment !== "online") {
    return { error: "Choose how you want to pay." };
  }

  if (fulfilment === "delivery") {
    if (address.length < 10 || address.length > 200) {
      return { error: "Enter your full delivery address (10 to 200 characters)." };
    }
  } else {
    if (!isRealDate(date)) return { error: "Choose a pickup day." };
    if (
      typeof time !== "string" ||
      !/^\d{2}:\d{2}$/.test(time) ||
      !slotTimes(date).includes(time)
    ) {
      return { error: "Choose a pickup time from the list." };
    }
  }

  if (
    !Array.isArray(items) ||
    items.length === 0 ||
    items.length > ORDERING.maxLines
  ) {
    return { error: "Your cart is empty." };
  }
  const lines = new Map();
  for (const line of items) {
    if (
      typeof line?.id !== "string" ||
      !mongoose.isValidObjectId(line.id) ||
      !Number.isInteger(line.qty) ||
      line.qty < 1 ||
      line.qty > ORDERING.maxQty
    ) {
      return { error: "Something in your cart is not valid. Please check it." };
    }
    // the same item twice is added together
    lines.set(
      line.id,
      Math.min((lines.get(line.id) ?? 0) + line.qty, ORDERING.maxQty)
    );
  }

  return {
    data: {
      name,
      phone,
      notes,
      fulfilment,
      payment,
      address: fulfilment === "delivery" ? address : "",
      date,
      time: fulfilment === "pickup" ? time : "",
      lines,
    },
  };
}

// what a customer may see about their own order (never the phone or address)
const publicView = (o) => ({
  number: o.number,
  name: o.name,
  fulfilment: o.fulfilment,
  date: o.date,
  time: o.time,
  items: o.items,
  subtotal: o.subtotal,
  deliveryFee: o.deliveryFee,
  total: o.total,
  paymentMethod: o.paymentMethod,
  paymentStatus: o.paymentStatus,
  status: o.status,
});

/* ---------- Routes ---------- */
const createLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many orders. Please call us instead." },
});

const trackLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many requests. Please wait a moment." },
});

export function registerOrderRoutes(app, requireAdmin) {
  // Public: what the checkout page needs to know
  app.get("/api/orders/config", (_req, res) => {
    const now = cafeNow();
    const [today, tomorrow] = orderDates(now);
    res.json({
      today,
      tomorrow,
      maxQty: ORDERING.maxQty,
      onlineEnabled,
      demoPayments: demoMode,
      delivery: {
        enabled: DELIVERY.enabled,
        openNow: deliveryOpenNow(now),
        fee: DELIVERY.fee,
        minOrder: DELIVERY.minOrder,
        estimate: DELIVERY.estimate,
      },
    });
  });

  // Public: which pickup times are free on a day
  app.get("/api/orders/slots", async (req, res) => {
    const date = String(req.query.date ?? "");
    const now = cafeNow();
    if (!orderDates(now).includes(date)) {
      return res.status(400).json({ error: "Choose today or tomorrow." });
    }
    const times = slotTimes(date);
    const used = await usedSlots(date);
    res.json({
      open: times.length > 0,
      slots: times.map((time) => ({
        time,
        available:
          isPickupAllowed(date, time, now) &&
          (used[time] ?? 0) < ORDERING.maxOrdersPerSlot,
      })),
    });
  });

  // Public: place an order. Prices always come from the database.
  app.post("/api/orders", createLimiter, async (req, res) => {
    const { data, error } = parseOrder(req.body);
    if (error) return res.status(400).json({ error });

    const now = cafeNow();
    const delivery = data.fulfilment === "delivery";
    const taken = {
      error: "Sorry, that pickup time has just filled up. Please choose another.",
    };

    if (data.payment === "online" && !onlineEnabled) {
      return res
        .status(400)
        .json({ error: "Online payment is not available right now." });
    }

    if (delivery) {
      if (!deliveryOpenNow(now)) {
        return res.status(400).json({
          error: "We are not taking delivery orders right now. Try pickup instead.",
        });
      }
      data.date = now.date;
    } else {
      if (
        !orderDates(now).includes(data.date) ||
        !isPickupAllowed(data.date, data.time, now)
      ) {
        return res.status(400).json({
          error: "That pickup time is no longer available. Choose another.",
        });
      }
      const used = await usedSlots(data.date);
      if ((used[data.time] ?? 0) >= ORDERING.maxOrdersPerSlot) {
        return res.status(409).json(taken);
      }
    }

    // look the items up: unknown and hidden items are refused
    const found = await MenuItem.find({
      _id: { $in: [...data.lines.keys()] },
      hidden: false,
    });
    if (found.length !== data.lines.size) {
      return res.status(400).json({
        error:
          "An item in your cart is no longer on the menu. Please check your cart.",
      });
    }

    const items = found.map((m) => ({
      name: m.name,
      price: m.price,
      qty: data.lines.get(m.id),
    }));
    const subtotal = items.reduce((sum, i) => sum + i.price * i.qty, 0);

    if (delivery && subtotal < DELIVERY.minOrder) {
      return res.status(400).json({
        error: `The smallest delivery order is Rs ${DELIVERY.minOrder.toLocaleString("en-US")}. Add more items or choose pickup.`,
      });
    }
    const deliveryFee = delivery ? DELIVERY.fee : 0;
    const total = subtotal + deliveryFee;

    const order = await Order.create({
      number: await nextNumber(),
      publicId: makePublicId(),
      name: data.name,
      phone: data.phone,
      fulfilment: data.fulfilment,
      address: data.address,
      notes: data.notes,
      date: data.date,
      time: data.time,
      items,
      subtotal,
      deliveryFee,
      total,
      paymentMethod: data.payment,
      paymentStatus: data.payment === "online" ? "pending" : "unpaid",
    });

    // pickup: if several people ordered the same time at once, the first ones keep it
    if (!delivery) {
      const keep = await Order.find({
        date: data.date,
        time: data.time,
        fulfilment: "pickup",
        status: { $ne: "cancelled" },
      })
        .sort({ _id: 1 })
        .limit(ORDERING.maxOrdersPerSlot)
        .select("_id");
      if (!keep.some((o) => o.id === order.id)) {
        await Order.findByIdAndDelete(order.id);
        return res.status(409).json(taken);
      }
    }

    if (data.payment === "cash") {
      return res.status(201).json({ publicId: order.publicId });
    }

    // online: get a payment page (Safepay, or the fake demo page) and send the customer there
    try {
      const { token, url } = await createCheckout({
        amount: total,
        reference: String(order.number),
        publicId: order.publicId,
        cancelUrl: `${SITE_ORIGIN}/order/${order.publicId}?cancelled=1`,
        redirectUrl: `${SITE_ORIGIN}/api/payments/return/${order.publicId}`,
      });
      await Order.updateOne({ _id: order._id }, { safepayToken: token });
      return res.status(201).json({ publicId: order.publicId, checkoutUrl: url });
    } catch (err) {
      console.error("Could not start an online payment:", err.message);
      await Order.updateOne(
        { _id: order._id },
        { status: "cancelled", paymentStatus: "failed" }
      );
      return res.status(502).json({
        error:
          "Online payment is not working right now. Please choose cash instead.",
      });
    }
  });

  // Public: the customer comes back from Safepay.
  // Safepay sends the customer back to this page (as a GET or a form POST).
  // The order is only marked paid if the signature is real AND it belongs to
  // THIS order's payment. Anything else leaves the order waiting for payment.
  app.all(
    "/api/payments/return/:publicId",
    express.urlencoded({ extended: false, limit: "8kb" }),
    async (req, res) => {
      const { publicId } = req.params;
      const back = `${SITE_ORIGIN}/order/${encodeURIComponent(publicId)}`;
      if (!PUBLIC_ID.test(publicId)) return res.redirect(303, SITE_ORIGIN);

      const order = await Order.findOne({
        publicId,
        paymentMethod: "online",
      }).select("+safepayToken");
      if (!order || order.paymentStatus !== "pending" || !order.safepayToken) {
        return res.redirect(303, back);
      }

      const fields = { ...req.query, ...req.body };
      // Only the names of the fields are logged, never their values
      console.log(
        `Safepay return for order ${order.number}. Fields received:`,
        Object.keys(fields).join(", ")
      );

      try {
        const signatureOk = await verifyReturn(req);
        const tracker = typeof fields.tracker === "string" ? fields.tracker : "";
        const a = Buffer.from(tracker);
        const b = Buffer.from(order.safepayToken);
        const sameTracker = a.length === b.length && crypto.timingSafeEqual(a, b);

        if (signatureOk && sameTracker) {
          await Order.updateOne(
            { _id: order._id, paymentStatus: "pending" },
            { paymentStatus: "paid" }
          );
        } else {
          console.warn(
            `Safepay return for order ${order.number} was NOT accepted (signature ok: ${signatureOk}, same payment: ${sameTracker}).`
          );
        }
      } catch (err) {
        console.error("Could not check the Safepay return:", err.message);
      }
      res.redirect(303, back);
    }
  );

  // DEMO ONLY: the fake payment page tells us if the "customer" paid or not.
  // This route exists only while DEMO_PAYMENTS=true and never in production.
  if (demoMode) {
    app.post(
      "/api/payments/demo/:publicId",
      originCheck,
      trackLimiter,
      async (req, res) => {
        res.set("Cache-Control", "no-store");
        const { publicId } = req.params;
        const outcome = req.body?.outcome;
        if (!PUBLIC_ID.test(publicId)) {
          return res.status(404).json({ error: "Order not found." });
        }
        if (outcome !== "paid" && outcome !== "failed") {
          return res.status(400).json({ error: "Choose paid or failed." });
        }

        const order = await Order.findOne({ publicId, paymentMethod: "online" });
        if (!order) return res.status(404).json({ error: "Order not found." });
        if (order.paymentStatus !== "pending") {
          return res
            .status(409)
            .json({ error: "This payment has already been dealt with." });
        }

        await Order.updateOne(
          { _id: order._id, paymentStatus: "pending" },
          outcome === "paid"
            ? { paymentStatus: "paid" }
            : { paymentStatus: "failed", status: "cancelled" }
        );
        res.json({ ok: true });
      }
    );
  }

  // Public: a customer checks their own order with the private code
  app.get("/api/orders/track/:publicId", trackLimiter, async (req, res) => {
    res.set("Cache-Control", "no-store");
    if (!PUBLIC_ID.test(req.params.publicId)) {
      return res.status(404).json({ error: "Order not found." });
    }
    const order = await Order.findOne({ publicId: req.params.publicId });
    if (!order) return res.status(404).json({ error: "Order not found." });
    res.json(publicView(order));
  });

  // Admin: orders still to prepare (default) or finished ones (?scope=done)
  app.get("/api/admin/orders", requireAdmin, async (req, res) => {
    const finished = req.query.scope === "done";
    const list = await Order.find({
      status: {
        $in: finished ? ["done", "cancelled"] : ["new", "preparing", "ready"],
      },
    })
      .sort(finished ? { createdAt: -1 } : { date: 1, time: 1, number: 1 })
      .limit(finished ? 100 : 300);
    res.json(list);
  });

  // Admin: move an order along (new -> preparing -> ready -> done) or cancel it
  app.put("/api/admin/orders/:id/status", requireAdmin, async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ error: "Order not found." });
    }
    const status = req.body?.status;
    if (!STATUSES.includes(status)) {
      return res.status(400).json({ error: "Choose a valid status." });
    }

    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ error: "Order not found." });

    if (!ALLOWED[order.status].includes(status)) {
      return res.status(400).json({
        error: `A ${order.status} order cannot be changed to ${status}.`,
      });
    }
    if (
      order.paymentMethod === "online" &&
      order.paymentStatus !== "paid" &&
      status !== "cancelled"
    ) {
      return res.status(400).json({
        error: "This order has not been paid online yet.",
      });
    }

    order.status = status;
    // cash is handed over by the time the order is done
    if (status === "done" && order.paymentMethod === "cash") {
      order.paymentStatus = "paid";
    }
    await order.save();
    res.json(order);
  });

  // Admin: you checked your Safepay dashboard and the money is there
  app.put("/api/admin/orders/:id/paid", requireAdmin, async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ error: "Order not found." });
    }
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ error: "Order not found." });
    if (
      order.paymentMethod !== "online" ||
      order.status === "cancelled" ||
      order.paymentStatus === "paid"
    ) {
      return res.status(400).json({ error: "This order cannot be marked as paid." });
    }
    order.paymentStatus = "paid";
    await order.save();
    res.json(order);
  });
}