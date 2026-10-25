/* ---------- Your cafe's time zone (set in .env) ---------- */
const { CAFE_TIMEZONE } = process.env;

if (!CAFE_TIMEZONE) {
  console.error(
    "Add CAFE_TIMEZONE to your .env file, for example CAFE_TIMEZONE=Asia/Karachi"
  );
  process.exit(1);
}
try {
  new Intl.DateTimeFormat("en", { timeZone: CAFE_TIMEZONE });
} catch {
  console.error(`CAFE_TIMEZONE "${CAFE_TIMEZONE}" is not a valid time zone name.`);
  process.exit(1);
}

export const TIMEZONE = CAFE_TIMEZONE;

/* ---------- Table booking rules: change these to fit your cafe ---------- */
export const RESERVATION = {
  slotMinutes: 30, // a new time is offered every 30 minutes
  durationMinutes: 90, // how long a booking holds its seats
  seats: 40, // total seats customers can book at the same time
  maxParty: 10, // bigger groups are asked to call
  daysAhead: 30, // how far ahead people can book
  leadMinutes: 60, // a booking must be at least this far in the future
  lastBookingBeforeCloseMinutes: 60, // the last booking starts this long before closing

  // Opening hours in 24-hour time. 0 = Sunday, 1 = Monday ... 6 = Saturday.
  // Leave a day out to close the cafe on it. Keep these the same as src/data/cafe.js.
  hours: {
    0: ["08:00", "16:00"],
    1: ["07:00", "18:00"],
    2: ["07:00", "18:00"],
    3: ["07:00", "18:00"],
    4: ["07:00", "18:00"],
    5: ["07:00", "18:00"],
    6: ["08:00", "20:00"],
  },
};

/* ---------- Pickup orders: change these to fit your cafe ---------- */
// Pickup uses the same opening hours as the table bookings above.
export const ORDERING = {
  slotMinutes: 15, // a pickup time is offered every 15 minutes
  leadMinutes: 20, // earliest pickup is this far away (your preparation time)
  maxOrdersPerSlot: 6, // how many orders you can prepare for the same pickup time
  lastPickupBeforeCloseMinutes: 15, // the last pickup is this long before closing
  maxLines: 30, // different items in one order
  maxQty: 20, // of one item
};

/* ---------- Home delivery: change these to fit your cafe ---------- */
export const DELIVERY = {
  enabled: true, // set to false to switch delivery off
  fee: 150, // delivery charge, in rupees
  minOrder: 500, // smallest order amount we deliver (before the fee)
  estimate: "about 45 minutes", // shown to the customer
  lastOrderBeforeCloseMinutes: 30, // stop taking delivery orders this long before closing
};

/* ---------- Online payment ---------- */
// Only matters for real Safepay payments later. Demo mode ignores it,
// but payments.js imports it, so it must exist.
export const PAYMENT_AMOUNT_MULTIPLIER = 1;