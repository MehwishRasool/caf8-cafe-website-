import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../data/api";
import { cafe } from "../data/cafe";
import { formatDate, formatTime } from "../data/format";

const inputClass =
  "w-full rounded-lg border border-line bg-card px-3 py-2 text-ink placeholder:text-muted";

const stepButton =
  "grid h-11 w-11 place-items-center rounded-full border-2 border-brand text-xl font-bold text-brand transition duration-200 hover:bg-brand hover:text-white disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-brand";

const emptyDetails = { name: "", phone: "", notes: "" };

/* ---------- The "booking received" screen ---------- */
function Confirmation({ booking, onAnother }) {
  return (
    <div className="animate-fade-up rounded-2xl bg-card p-8 shadow-sm">
      <p className="text-sm font-bold uppercase tracking-widest text-sage">
        Request received
      </p>
      <h2 className="mt-2 font-display text-3xl font-extrabold text-brand">
        Thank you, {booking.name}
      </h2>
      <p className="mt-3 text-ink">
        We have saved your table. We will confirm it shortly. If we need to
        change anything, we will call you.
      </p>

      <dl className="mt-6 grid gap-4 rounded-xl bg-mint p-6 sm:grid-cols-2">
        <div>
          <dt className="text-sm text-muted">Booking number</dt>
          <dd className="font-display text-2xl font-bold tracking-widest text-brand">
            {booking.reference}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-muted">Guests</dt>
          <dd className="text-lg font-bold text-ink">{booking.people}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted">Date</dt>
          <dd className="text-lg font-bold text-ink">
            {formatDate(booking.date)}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-muted">Time</dt>
          <dd className="text-lg font-bold text-ink">
            {formatTime(booking.time)}
          </dd>
        </div>
      </dl>

      <p className="mt-6 text-sm text-muted">
        Keep your booking number. To change or cancel, call us on{" "}
        <a href={`tel:${cafe.phone}`} className="font-bold text-brand underline">
          {cafe.phone}
        </a>
        .
      </p>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          to="/menu"
          className="rounded-full bg-brand px-6 py-3 font-bold text-white transition duration-300 hover:bg-sage"
        >
          Look at the menu
        </Link>
        <button
          type="button"
          onClick={onAnother}
          className="rounded-full border-2 border-brand px-6 py-3 font-bold text-brand transition duration-300 hover:bg-brand hover:text-white"
        >
          Book another table
        </button>
      </div>
    </div>
  );
}

/* ---------- The page ---------- */
export default function Reserve() {
  const [config, setConfig] = useState(null);
  const [configError, setConfigError] = useState("");
  const [configTry, setConfigTry] = useState(0);

  const [people, setPeople] = useState(2);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [details, setDetails] = useState(emptyDetails);

  const [avail, setAvail] = useState({ key: "", open: true, slots: null, error: "" });
  const [reload, setReload] = useState(0);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [booking, setBooking] = useState(null);

  // limits from the server (today's date in the cafe's time zone, how far ahead)
  useEffect(() => {
    let cancelled = false;
    api
      .get("/api/reservations/config")
      .then((c) => {
        if (!cancelled) setConfig(c);
      })
      .catch((err) => {
        if (!cancelled) setConfigError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [configTry]);

  // which times are free for this date and number of guests
  const key = date ? `${date}|${people}` : "";
  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    api
      .get(`/api/reservations/availability?date=${date}&people=${people}`)
      .then((d) => {
        if (!cancelled) setAvail({ key, open: d.open, slots: d.slots, error: "" });
      })
      .catch((err) => {
        if (!cancelled)
          setAvail({ key, open: true, slots: null, error: err.message });
      });
    return () => {
      cancelled = true;
    };
  }, [key, date, people, reload]);

  const loadingSlots = Boolean(key) && avail.key !== key;
  const slots = avail.key === key ? avail.slots : null;
  // a chosen time only counts while it is still free
  const chosenTime = slots?.some((s) => s.time === time && s.available) ? time : "";
  const anyFree = slots?.some((s) => s.available) ?? false;

  const setDetail = (field) => (e) =>
    setDetails((d) => ({ ...d, [field]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError("");

    const name = details.name.trim();
    const phone = details.phone.trim();
    if (!date) return setError("Choose a date.");
    if (!chosenTime) return setError("Choose a time.");
    if (name.length < 2) return setError("Enter your name.");
    if (!/^[0-9+()\-\s]{7,25}$/.test(phone)) {
      return setError("Enter a valid phone number.");
    }

    setBusy(true);
    try {
      const result = await api.post("/api/reservations", {
        name,
        phone,
        people,
        date,
        time: chosenTime,
        notes: details.notes.trim(),
      });
      setBooking(result);
    } catch (err) {
      setError(err.message);
      if (err.status === 409) {
        setTime("");
        setReload((n) => n + 1); // show the times that are really free now
      }
    } finally {
      setBusy(false);
    }
  };

  const bookAnother = () => {
    setBooking(null);
    setDate("");
    setTime("");
    setDetails(emptyDetails);
    setError("");
  };

  return (
    <>
      <section className="bg-brand px-5 py-14 text-white">
        <div className="mx-auto max-w-6xl">
          <h1 className="animate-fade-up font-display text-4xl font-extrabold md:text-5xl">
            Book a <span className="text-accent">table</span>
          </h1>
          <p className="mt-3 max-w-xl text-white/80">
            Choose a day and time, tell us who is coming and we will keep a
            table for you.
          </p>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-10 px-5 py-12 lg:grid-cols-[1fr_320px]">
        <div>
          {booking ? (
            <Confirmation booking={booking} onAnother={bookAnother} />
          ) : configError ? (
            <div role="alert" className="rounded-xl bg-mint p-6">
              <p className="font-medium text-ink">{configError}</p>
              <button
                type="button"
                onClick={() => {
                  setConfigError("");
                  setConfigTry((n) => n + 1);
                }}
                className="mt-4 rounded-full bg-brand px-5 py-2 font-bold text-white transition duration-300 hover:bg-sage"
              >
                Try again
              </button>
            </div>
          ) : !config ? (
            <p className="text-muted">Loading...</p>
          ) : (
            <form onSubmit={submit} noValidate className="space-y-8">
              {/* 1. guests */}
              <fieldset>
                <legend className="font-display text-xl font-bold text-brand">
                  1. How many guests?
                </legend>
                <div className="mt-3 flex items-center gap-4">
                  <button
                    type="button"
                    aria-label="One fewer guest"
                    disabled={people <= 1}
                    onClick={() => setPeople((p) => p - 1)}
                    className={stepButton}
                  >
                    −
                  </button>
                  <span
                    aria-live="polite"
                    className="min-w-24 text-center text-lg font-bold text-ink"
                  >
                    {people} {people === 1 ? "guest" : "guests"}
                  </span>
                  <button
                    type="button"
                    aria-label="One more guest"
                    disabled={people >= config.maxParty}
                    onClick={() => setPeople((p) => p + 1)}
                    className={stepButton}
                  >
                    +
                  </button>
                </div>
                <p className="mt-2 text-sm text-muted">
                  For more than {config.maxParty} people, please call us on{" "}
                  <a href={`tel:${cafe.phone}`} className="font-bold text-brand underline">
                    {cafe.phone}
                  </a>
                  .
                </p>
              </fieldset>

              {/* 2. date */}
              <div>
                <label
                  htmlFor="date"
                  className="font-display text-xl font-bold text-brand"
                >
                  2. Which day?
                </label>
                <input
                  id="date"
                  type="date"
                  value={date}
                  min={config.today}
                  max={config.maxDate}
                  onChange={(e) => setDate(e.target.value)}
                  className={`${inputClass} mt-3 max-w-xs`}
                />
                {date && (
                  <p className="mt-2 text-sm text-muted">{formatDate(date)}</p>
                )}
              </div>

              {/* 3. time */}
              <fieldset>
                <legend className="font-display text-xl font-bold text-brand">
                  3. Which time?
                </legend>

                {!date && (
                  <p className="mt-3 text-muted">Choose a day first.</p>
                )}
                {loadingSlots && (
                  <p className="mt-3 text-muted">Checking free tables...</p>
                )}
                {date && !loadingSlots && avail.error && (
                  <p role="alert" className="mt-3 font-medium text-red-800">
                    {avail.error}
                  </p>
                )}
                {slots && !avail.open && (
                  <p className="mt-3 text-ink">
                    We are closed on {formatDate(date)}. Please choose another
                    day.
                  </p>
                )}
                {slots && avail.open && !anyFree && (
                  <p className="mt-3 text-ink">
                    Sorry, there are no free tables for {people}{" "}
                    {people === 1 ? "guest" : "guests"} on this day. Try another
                    day or call us.
                  </p>
                )}
                {slots && anyFree && (
                  <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
                    {slots.map((s) => (
                      <button
                        key={s.time}
                        type="button"
                        disabled={!s.available}
                        aria-pressed={chosenTime === s.time}
                        onClick={() => setTime(s.time)}
                        className={`rounded-lg border-2 px-2 py-2 text-sm font-bold transition duration-200 ${
                          chosenTime === s.time
                            ? "border-brand bg-brand text-white"
                            : s.available
                              ? "border-line bg-card text-brand hover:border-brand"
                              : "cursor-not-allowed border-line bg-transparent text-muted line-through opacity-50"
                        }`}
                      >
                        {formatTime(s.time)}
                      </button>
                    ))}
                  </div>
                )}
                {slots && anyFree && (
                  <p className="mt-2 text-sm text-muted">
                    Crossed-out times are already full.
                  </p>
                )}
              </fieldset>

              {/* 4. details */}
              <fieldset className="space-y-4">
                <legend className="font-display text-xl font-bold text-brand">
                  4. Your details
                </legend>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="name" className="mb-1 block font-medium">
                      Name
                    </label>
                    <input
                      id="name"
                      type="text"
                      value={details.name}
                      onChange={setDetail("name")}
                      autoComplete="name"
                      maxLength={80}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label htmlFor="phone" className="mb-1 block font-medium">
                      Phone
                    </label>
                    <input
                      id="phone"
                      type="tel"
                      value={details.phone}
                      onChange={setDetail("phone")}
                      autoComplete="tel"
                      maxLength={25}
                      placeholder="+92 300 0000000"
                      className={inputClass}
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="notes" className="mb-1 block font-medium">
                    Anything we should know? (optional)
                  </label>
                  <textarea
                    id="notes"
                    rows={3}
                    value={details.notes}
                    onChange={setDetail("notes")}
                    maxLength={300}
                    placeholder="Birthday, high chair, allergies..."
                    className={inputClass}
                  />
                </div>
              </fieldset>

              {error && (
                <p role="alert" className="font-medium text-red-800">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={busy}
                className="rounded-full bg-brand px-10 py-3 font-bold text-white transition duration-300 hover:bg-sage disabled:opacity-60"
              >
                {busy ? "Booking..." : "Book my table"}
              </button>
            </form>
          )}
        </div>

        <aside className="h-fit rounded-2xl bg-mint p-6">
          <h2 className="font-display text-xl font-bold text-brand">
            Good to know
          </h2>
          <ul className="mt-3 space-y-3 text-ink">
            <li>We hold your table for about 90 minutes.</li>
            <li>We confirm every booking, and call you if anything changes.</li>
            <li>
              To change or cancel, call{" "}
              <a href={`tel:${cafe.phone}`} className="font-bold text-brand underline">
                {cafe.phone}
              </a>
              .
            </li>
          </ul>
          <h3 className="mt-6 font-display text-lg font-bold text-brand">
            Opening hours
          </h3>
          <ul className="mt-2 space-y-1 text-ink">
            {cafe.hours.map((h) => (
              <li key={h.days} className="flex justify-between gap-4">
                <span>{h.days}</span>
                <span>{h.time}</span>
              </li>
            ))}
          </ul>
        </aside>
      </section>
    </>
  );
}
