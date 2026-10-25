import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../data/api";
import { cafe } from "../data/cafe";
import { formatDate, formatTime } from "../data/format";
import { cartActions, formatPrice, loadMenu, useCart, useMenu } from "../data/store";

const inputClass =
  "w-full rounded-lg border border-line bg-card px-3 py-2 text-ink placeholder:text-muted";

const emptyDetails = { name: "", phone: "", address: "", notes: "" };

// a big clickable card used for the delivery and payment choices
function Choice({ selected, disabled, onClick, title, text }) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={selected}
      onClick={onClick}
      className={`rounded-xl border-2 p-4 text-left transition duration-200 ${
        selected
          ? "border-brand bg-brand text-white"
          : "border-line bg-card text-ink hover:border-brand"
      } disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-line`}
    >
      <span className="block font-bold">{title}</span>
      <span className={`mt-1 block text-sm ${selected ? "text-white/80" : "text-muted"}`}>
        {text}
      </span>
    </button>
  );
}

export default function Checkout() {
  const navigate = useNavigate();
  const { status } = useMenu();
  const { lines, total } = useCart();

  const [config, setConfig] = useState(null);
  const [configError, setConfigError] = useState("");
  const [configTry, setConfigTry] = useState(0);

  const [choice, setChoice] = useState(""); // "delivery", "pickup" or "" (not chosen yet)
  const [payment, setPayment] = useState("cash");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [details, setDetails] = useState(emptyDetails);

  const [avail, setAvail] = useState({ key: "", open: true, slots: null, error: "" });
  const [reload, setReload] = useState(0);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // today's date, delivery rules and whether online payment is switched on
  useEffect(() => {
    let cancelled = false;
    api
      .get("/api/orders/config")
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

  const delivery = config?.delivery;
  const deliveryPossible = Boolean(delivery?.enabled && delivery?.openNow);
  // until the customer chooses, we suggest delivery when it is possible
  const fulfilment = choice || (deliveryPossible ? "delivery" : "pickup");
  const isDelivery = fulfilment === "delivery";

  // which pickup times are free on the chosen day
  useEffect(() => {
    if (fulfilment !== "pickup" || !date) return;
    let cancelled = false;
    api
      .get(`/api/orders/slots?date=${date}`)
      .then((d) => {
        if (!cancelled)
          setAvail({ key: date, open: d.open, slots: d.slots, error: "" });
      })
      .catch((err) => {
        if (!cancelled)
          setAvail({ key: date, open: true, slots: null, error: err.message });
      });
    return () => {
      cancelled = true;
    };
  }, [fulfilment, date, reload]);

  const loadingSlots = Boolean(date) && avail.key !== date;
  const slots = avail.key === date ? avail.slots : null;
  const chosenTime = slots?.some((s) => s.time === time && s.available) ? time : "";
  const anyFree = slots?.some((s) => s.available) ?? false;

  const deliveryFee = isDelivery && delivery ? delivery.fee : 0;
  const grandTotal = total + deliveryFee;

  const setDetail = (field) => (e) =>
    setDetails((d) => ({ ...d, [field]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError("");

    const name = details.name.trim();
    const phone = details.phone.trim();
    const address = details.address.trim();

    if (lines.some((l) => l.qty > 20)) {
      return setError("You can order up to 20 of one item. Please lower the amount.");
    }
    if (isDelivery) {
      if (total < delivery.minOrder) {
        return setError(
          `The smallest delivery order is ${formatPrice(delivery.minOrder)}. Add more items or choose pickup.`
        );
      }
      if (address.length < 10) {
        return setError("Enter your full delivery address.");
      }
    } else {
      if (!date) return setError("Choose a pickup day.");
      if (!chosenTime) return setError("Choose a pickup time.");
    }
    if (name.length < 2) return setError("Enter your name.");
    if (!/^[0-9+()\-\s]{7,25}$/.test(phone)) {
      return setError("Enter a valid phone number.");
    }

    setBusy(true);
    try {
      const result = await api.post("/api/orders", {
        fulfilment,
        payment,
        name,
        phone,
        address: isDelivery ? address : "",
        date: isDelivery ? "" : date,
        time: isDelivery ? "" : chosenTime,
        notes: details.notes.trim(),
        items: lines.map((l) => ({ id: l.item.id, qty: l.qty })),
      });

      if (result.checkoutUrl) {
        // online payment: the cart is cleared after we know it was paid
        try {
          sessionStorage.setItem("caf8-paying", result.publicId);
        } catch {
          /* blocked storage: the cart simply stays until the next order */
        }
        window.location.assign(result.checkoutUrl);
        return; // the browser is leaving this page
      }

      cartActions.clear();
      navigate(`/order/${result.publicId}`);
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

  const header = (
    <section className="bg-brand px-5 py-14 text-white">
      <div className="mx-auto max-w-6xl">
        <h1 className="animate-fade-up font-display text-4xl font-extrabold md:text-5xl">
          Check<span className="text-accent">out</span>
        </h1>
      </div>
    </section>
  );

  if (status === "idle" || (status === "loading" && lines.length === 0)) {
    return (
      <>
        {header}
        <p className="px-5 py-12 text-center text-muted">Loading...</p>
      </>
    );
  }

  if (status === "error" && lines.length === 0) {
    return (
      <>
        {header}
        <div className="mx-auto max-w-md px-5 py-12 text-center">
          <p role="alert" className="font-medium text-red-800">
            We could not load the menu. Check your connection and try again.
          </p>
          <button
            type="button"
            onClick={loadMenu}
            className="mt-4 rounded-full bg-brand px-6 py-2 font-bold text-white transition duration-300 hover:bg-sage"
          >
            Try again
          </button>
        </div>
      </>
    );
  }

  if (lines.length === 0) {
    return (
      <>
        {header}
        <div className="mx-auto max-w-md px-5 py-16 text-center">
          <p className="text-lg text-ink">Your cart is empty.</p>
          <Link
            to="/menu"
            className="mt-6 inline-block rounded-full bg-brand px-7 py-3 font-bold text-white transition duration-300 hover:bg-sage"
          >
            See the menu
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      {header}
      <section className="mx-auto grid max-w-6xl gap-10 px-5 py-12 lg:grid-cols-[1fr_360px]">
        <div>
          {configError ? (
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
              {/* 1. delivery or pickup */}
              <fieldset>
                <legend className="font-display text-xl font-bold text-brand">
                  1. How do you want your order?
                </legend>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <Choice
                    selected={fulfilment === "delivery"}
                    disabled={!deliveryPossible}
                    onClick={() => setChoice("delivery")}
                    title="Delivery"
                    text={
                      !delivery.enabled
                        ? "Not available right now"
                        : !delivery.openNow
                          ? "We are not delivering right now"
                          : `${formatPrice(delivery.fee)} fee · ${delivery.estimate}`
                    }
                  />
                  <Choice
                    selected={fulfilment === "pickup"}
                    onClick={() => setChoice("pickup")}
                    title="Pickup"
                    text="Collect it from the cafe at a time you choose"
                  />
                </div>
              </fieldset>

              {/* 2a. pickup time */}
              {!isDelivery && (
                <fieldset>
                  <legend className="font-display text-xl font-bold text-brand">
                    2. Pickup day and time
                  </legend>
                  <div className="mt-3 flex flex-wrap gap-3">
                    {[
                      { label: "Today", value: config.today },
                      { label: "Tomorrow", value: config.tomorrow },
                    ].map((d) => (
                      <button
                        key={d.value}
                        type="button"
                        aria-pressed={date === d.value}
                        onClick={() => setDate(d.value)}
                        className={`rounded-full border-2 px-6 py-2 font-bold transition duration-200 ${
                          date === d.value
                            ? "border-brand bg-brand text-white"
                            : "border-brand text-brand hover:bg-brand hover:text-white"
                        }`}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                  {date && (
                    <p className="mt-2 text-sm text-muted">{formatDate(date)}</p>
                  )}

                  {!date && <p className="mt-3 text-muted">Choose a day first.</p>}
                  {loadingSlots && (
                    <p className="mt-3 text-muted">Checking pickup times...</p>
                  )}
                  {date && !loadingSlots && avail.error && (
                    <p role="alert" className="mt-3 font-medium text-red-800">
                      {avail.error}
                    </p>
                  )}
                  {slots && !avail.open && (
                    <p className="mt-3 text-ink">
                      We are closed on this day. Please choose another day.
                    </p>
                  )}
                  {slots && avail.open && !anyFree && (
                    <p className="mt-3 text-ink">
                      There are no pickup times left for this day. Try the other
                      day or call us on {cafe.phone}.
                    </p>
                  )}
                  {slots && anyFree && (
                    <>
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
                      <p className="mt-2 text-sm text-muted">
                        Crossed-out times are full or too soon.
                      </p>
                    </>
                  )}
                </fieldset>
              )}

              {/* 2b. delivery address */}
              {isDelivery && (
                <fieldset>
                  <legend className="font-display text-xl font-bold text-brand">
                    2. Delivery address
                  </legend>
                  <label htmlFor="c-address" className="mt-3 mb-1 block font-medium">
                    House or flat number, street, area, city
                  </label>
                  <textarea
                    id="c-address"
                    rows={3}
                    value={details.address}
                    onChange={setDetail("address")}
                    autoComplete="street-address"
                    maxLength={200}
                    className={inputClass}
                  />
                  <p className="mt-2 text-sm text-muted">
                    Smallest delivery order: {formatPrice(delivery.minOrder)}.
                    Delivery takes {delivery.estimate}.
                  </p>
                </fieldset>
              )}

              {/* 3. your details */}
              <fieldset className="space-y-4">
                <legend className="font-display text-xl font-bold text-brand">
                  3. Your details
                </legend>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="c-name" className="mb-1 block font-medium">
                      Name
                    </label>
                    <input
                      id="c-name"
                      value={details.name}
                      onChange={setDetail("name")}
                      autoComplete="name"
                      maxLength={80}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label htmlFor="c-phone" className="mb-1 block font-medium">
                      Phone
                    </label>
                    <input
                      id="c-phone"
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
                  <label htmlFor="c-notes" className="mb-1 block font-medium">
                    Anything we should know? (optional)
                  </label>
                  <textarea
                    id="c-notes"
                    rows={2}
                    value={details.notes}
                    onChange={setDetail("notes")}
                    maxLength={200}
                    placeholder="No sugar, extra hot, ring the bell..."
                    className={inputClass}
                  />
                </div>
              </fieldset>

              {/* 4. payment */}
              <fieldset>
                <legend className="font-display text-xl font-bold text-brand">
                  4. How do you want to pay?
                </legend>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <Choice
                    selected={payment === "cash"}
                    onClick={() => setPayment("cash")}
                    title={isDelivery ? "Cash on delivery" : "Cash at pickup"}
                    text={
                      isDelivery
                        ? "Pay the rider when your order arrives"
                        : "Pay at the counter when you collect"
                    }
                  />
                  <Choice
                    selected={payment === "online"}
                    disabled={!config.onlineEnabled}
                    onClick={() => setPayment("online")}
                    title="Pay online"
                    text={
                      config.onlineEnabled
                        ? "You pay now on a secure payment page"
                        : "Not available yet"
                    }
                  />
                </div>
                {payment === "online" && (
                  <p className="mt-2 text-sm text-muted">
                    {config.demoPayments
                      ? "Demo mode: you will see a pretend payment page. No real money is used."
                      : "After you press the button you go to Safepay's secure page. We never see or store your card details."}
                  </p>
                )}
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
                {busy
                  ? "Please wait..."
                  : payment === "online"
                    ? `Pay ${formatPrice(grandTotal)}`
                    : `Place order · ${formatPrice(grandTotal)}`}
              </button>
            </form>
          )}
        </div>

        {/* summary */}
        <aside className="h-fit rounded-2xl bg-mint p-6 lg:sticky lg:top-24">
          <h2 className="font-display text-xl font-bold text-brand">
            Your order
          </h2>
          <ul className="mt-4 space-y-2">
            {lines.map(({ item, qty }) => (
              <li key={item.id} className="flex justify-between gap-3">
                <span>
                  {qty} × {item.name}
                </span>
                <span className="shrink-0">{formatPrice(item.price * qty)}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-4 space-y-1 border-t border-line pt-4">
            <div className="flex justify-between">
              <dt>Items</dt>
              <dd>{formatPrice(total)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Delivery</dt>
              <dd>{isDelivery ? formatPrice(deliveryFee) : "Free (pickup)"}</dd>
            </div>
            <div className="flex justify-between pt-2 text-lg font-bold">
              <dt>Total</dt>
              <dd>{formatPrice(grandTotal)}</dd>
            </div>
          </dl>
          <Link to="/cart" className="mt-4 inline-block font-bold text-brand underline">
            Change items
          </Link>
        </aside>
      </section>
    </>
  );
}