import crypto from "node:crypto";
import mongoose from "mongoose";
import { rateLimit } from "express-rate-limit";
import { RESERVATION, TIMEZONE } from "./config.js";

const STATUSES = ["pending", "confirmed", "cancelled"];

// which status changes the owner may make
const ALLOWED = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["cancelled"],
  cancelled: [],
};

/* ---------- Database model ---------- */
const toJSON = {
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  },
};

const reservationSchema = new mongoose.Schema(
  {
    reference: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    phone: { type: String, required: true, trim: true, maxlength: 25 },
    people: { type: Number, required: true, min: 1 },
    date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    time: { type: String, required: true, match: /^\d{2}:\d{2}$/ },
    notes: { type: String, trim: true, maxlength: 300, default: "" },
    status: { type: String, enum: STATUSES, default: "pending" },
  },
  { timestamps: true, toJSON }
);
reservationSchema.index({ date: 1, time: 1 });

const Reservation = mongoose.model("Reservation", reservationSchema);

/* ---------- Dates and times (all in your cafe's time zone) ---------- */
const toMinutes = (hhmm) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

const toHHMM = (minutes) =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(
    minutes % 60
  ).padStart(2, "0")}`;

function cafeNow() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const get = (type) => parts.find((p) => p.type === type).value;
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    minutes: Number(get("hour")) * 60 + Number(get("minute")),
  };
}

function isRealDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

function addDays(date, days) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// every time a table can be booked on this date
function slotTimes(date) {
  const hours = RESERVATION.hours[new Date(`${date}T00:00:00Z`).getUTCDay()];
  if (!hours) return [];
  const lastStart =
    toMinutes(hours[1]) - RESERVATION.lastBookingBeforeCloseMinutes;
  const times = [];
  for (
    let m = toMinutes(hours[0]);
    m <= lastStart;
    m += RESERVATION.slotMinutes
  ) {
    times.push(toHHMM(m));
  }
  return times;
}

// is this date and time far enough ahead, and not too far ahead?
function isBookable(date, time, now) {
  if (date > addDays(now.date, RESERVATION.daysAhead)) return false;
  if (date > now.date) return true;
  return (
    date === now.date && toMinutes(time) >= now.minutes + RESERVATION.leadMinutes
  );
}

/* ---------- Seat counting ---------- */
function seatsUsedAt(active, minute) {
  return active.reduce((sum, r) => {
    const start = toMinutes(r.time);
    const covers =
      start <= minute && minute < start + RESERVATION.durationMinutes;
    return covers ? sum + r.people : sum;
  }, 0);
}

// walks through the booking's whole stay and returns the busiest moment
function peakSeats(active, time) {
  const start = toMinutes(time);
  let peak = 0;
  for (
    let m = start;
    m < start + RESERVATION.durationMinutes;
    m += RESERVATION.slotMinutes
  ) {
    peak = Math.max(peak, seatsUsedAt(active, m));
  }
  return peak;
}

const fits = (active, time, people) =>
  peakSeats(active, time) + people <= RESERVATION.seats;

const overbooked = (active, time) => peakSeats(active, time) > RESERVATION.seats;

const activeOn = (date) =>
  Reservation.find({ date, status: { $ne: "cancelled" } }).select("time people");

/* ---------- Booking details from the customer ---------- */
const REF_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0, O, 1 or I
const makeReference = () =>
  Array.from(
    crypto.randomBytes(6),
    (b) => REF_ALPHABET[b % REF_ALPHABET.length]
  ).join("");

function parseBooking(body = {}) {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  const notes = typeof body.notes === "string" ? body.notes.trim() : "";
  const { people, date, time } = body;

  if (name.length < 2 || name.length > 80) {
    return { error: "Enter your name." };
  }
  if (!/^[0-9+()\-\s]{7,25}$/.test(phone)) {
    return { error: "Enter a valid phone number." };
  }
  if (!Number.isInteger(people) || people < 1 || people > RESERVATION.maxParty) {
    return {
      error: `Online bookings are for 1 to ${RESERVATION.maxParty} people. Please call us for larger groups.`,
    };
  }
  if (typeof date !== "string" || !isRealDate(date)) {
    return { error: "Choose a date." };
  }
  if (
    typeof time !== "string" ||
    !/^\d{2}:\d{2}$/.test(time) ||
    !slotTimes(date).includes(time)
  ) {
    return { error: "Choose a time from the list." };
  }
  if (notes.length > 300) {
    return { error: "Notes must be 300 characters or fewer." };
  }
  return { data: { name, phone, people, date, time, notes } };
}

/* ---------- Routes ---------- */
const createLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 8,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many booking requests. Please call us instead." },
});

export function registerReservationRoutes(app, requireAdmin) {
  // Public: the limits the booking page needs
  app.get("/api/reservations/config", (_req, res) => {
    const today = cafeNow().date;
    res.json({
      today,
      maxDate: addDays(today, RESERVATION.daysAhead),
      maxParty: RESERVATION.maxParty,
      durationMinutes: RESERVATION.durationMinutes,
    });
  });

  // Public: which times are free on a date for a party of this size
  app.get("/api/reservations/availability", async (req, res) => {
    const date = String(req.query.date ?? "");
    const people = Number(req.query.people);

    if (
      !isRealDate(date) ||
      !Number.isInteger(people) ||
      people < 1 ||
      people > RESERVATION.maxParty
    ) {
      return res.status(400).json({ error: "Choose a date and number of guests." });
    }

    const now = cafeNow();
    if (date < now.date || date > addDays(now.date, RESERVATION.daysAhead)) {
      return res.status(400).json({
        error: `Tables can be booked from today up to ${RESERVATION.daysAhead} days ahead.`,
      });
    }

    const times = slotTimes(date);
    const active = await activeOn(date);
    res.json({
      open: times.length > 0,
      slots: times.map((time) => ({
        time,
        available: isBookable(date, time, now) && fits(active, time, people),
      })),
    });
  });

  // Public: a customer asks for a table
  app.post("/api/reservations", createLimiter, async (req, res) => {
    const { data, error } = parseBooking(req.body);
    if (error) return res.status(400).json({ error });

    const now = cafeNow();
    if (!isBookable(data.date, data.time, now)) {
      return res
        .status(400)
        .json({ error: "That time can no longer be booked. Choose another." });
    }

    const taken = {
      error: "Sorry, that time has just been taken. Please choose another.",
    };

    if (!fits(await activeOn(data.date), data.time, data.people)) {
      return res.status(409).json(taken);
    }

    const reservation = await Reservation.create({
      ...data,
      reference: makeReference(),
    });

    // If two people booked at the very same moment, check again and back out
    if (overbooked(await activeOn(data.date), data.time)) {
      await Reservation.findByIdAndDelete(reservation.id);
      return res.status(409).json(taken);
    }

    // the phone number is not sent back
    res.status(201).json({
      reference: reservation.reference,
      name: reservation.name,
      people: reservation.people,
      date: reservation.date,
      time: reservation.time,
      status: reservation.status,
    });
  });

  // Admin: upcoming bookings (or past ones with ?scope=past)
  app.get("/api/admin/reservations", requireAdmin, async (req, res) => {
    const today = cafeNow().date;
    const past = req.query.scope === "past";
    const list = await Reservation.find(
      past ? { date: { $lt: today } } : { date: { $gte: today } }
    )
      .sort(past ? { date: -1, time: -1 } : { date: 1, time: 1 })
      .limit(200);
    res.json(list);
  });

  // Admin: confirm or cancel a booking
  app.put("/api/admin/reservations/:id/status", requireAdmin, async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ error: "Booking not found." });
    }
    const status = req.body?.status;
    if (!STATUSES.includes(status)) {
      return res.status(400).json({ error: "Choose a valid status." });
    }

    const reservation = await Reservation.findById(req.params.id);
    if (!reservation) return res.status(404).json({ error: "Booking not found." });

    if (!ALLOWED[reservation.status].includes(status)) {
      return res.status(400).json({
        error: `A ${reservation.status} booking cannot be changed to ${status}.`,
      });
    }

    reservation.status = status;
    await reservation.save();
    res.json(reservation);
  });
}