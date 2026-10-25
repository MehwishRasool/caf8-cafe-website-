import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { api } from "../data/api";
import { cafe } from "../data/cafe";
import { formatDate, formatTime } from "../data/format";
import { cartActions, formatPrice } from "../data/store";

const POLL_SECONDS = 4;

export default function Order() {
  const { publicId } = useParams();
  const [params] = useSearchParams();
  const cancelledPayment = params.get("cancelled") === "1";

  const [state, setState] = useState({ order: null, error: "" });
  const { order, error } = state;

  const waitingForPayment =
    order?.paymentMethod === "online" && order?.paymentStatus === "pending";

  // load the order, and keep checking while an online payment is being confirmed
  useEffect(() => {
    let cancelled = false;

    const load = () =>
      api
        .get(`/api/orders/track/${encodeURIComponent(publicId)}`)
        .then((o) => {
          if (!cancelled) setState({ order: o, error: "" });
        })
        .catch((err) => {
          if (!cancelled)
            setState((s) => ({
              ...s,
              error:
                err.status === 404
                  ? "We could not find this order. Check the link you were given."
                  : err.message,
            }));
        });

    load();
    if (!waitingForPayment) {
      return () => {
        cancelled = true;
      };
    }
    const timer = setInterval(load, POLL_SECONDS * 1000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [publicId, waitingForPayment]);

  // after a successful online payment the cart is emptied (only for the order just paid)
  const paid = order?.paymentStatus === "paid";
  useEffect(() => {
    if (!paid || order?.paymentMethod !== "online") return;
    try {
      if (sessionStorage.getItem("caf8-paying") === publicId) {
        cartActions.clear();
        sessionStorage.removeItem("caf8-paying");
      }
    } catch {
      /* blocked storage */
    }
  }, [paid, order?.paymentMethod, publicId]);

  const header = (
    <section className="bg-brand px-5 py-14 text-white">
      <div className="mx-auto max-w-6xl">
        <h1 className="animate-fade-up font-display text-4xl font-extrabold md:text-5xl">
          Your <span className="text-accent">order</span>
        </h1>
      </div>
    </section>
  );

  if (error && !order) {
    return (
      <>
        {header}
        <div className="mx-auto max-w-md px-5 py-16 text-center">
          <p role="alert" className="font-medium text-red-800">
            {error}
          </p>
          <Link
            to="/menu"
            className="mt-6 inline-block rounded-full bg-brand px-7 py-3 font-bold text-white transition duration-300 hover:bg-sage"
          >
            Back to the menu
          </Link>
        </div>
      </>
    );
  }

  if (!order) {
    return (
      <>
        {header}
        <p className="px-5 py-12 text-center text-muted">Loading your order...</p>
      </>
    );
  }

  const delivery = order.fulfilment === "delivery";
  const steps = [
    { key: "new", label: "Received" },
    { key: "preparing", label: "Preparing" },
    { key: "ready", label: delivery ? "On its way" : "Ready for pickup" },
    { key: "done", label: delivery ? "Delivered" : "Collected" },
  ];
  const stepIndex = steps.findIndex((s) => s.key === order.status);

  let paymentNote;
  if (order.paymentMethod === "cash") {
    paymentNote = delivery
      ? "Pay cash to the rider when your order arrives."
      : "Pay cash at the counter when you collect.";
  } else if (order.paymentStatus === "paid") {
    paymentNote = "Paid online. Thank you!";
  } else if (order.paymentStatus === "failed") {
    paymentNote = "The online payment was not completed.";
  } else {
    paymentNote = "Waiting for your online payment to be confirmed...";
  }

  return (
    <>
      {header}
      <section className="px-5 py-12">
        <div className="animate-fade-up mx-auto max-w-2xl rounded-2xl bg-card p-8 shadow-sm">
          {order.status === "cancelled" ? (
            <>
              <h2 className="font-display text-3xl font-extrabold text-brand">
                Order #{order.number} was cancelled
              </h2>
              <p className="mt-3 text-ink">
                {order.paymentMethod === "online" && order.paymentStatus !== "paid"
                  ? "The payment was not completed, so no money was taken. "
                  : ""}
                If this is a mistake, please call us on{" "}
                <a href={`tel:${cafe.phone}`} className="font-bold text-brand underline">
                  {cafe.phone}
                </a>
                .
              </p>
            </>
          ) : waitingForPayment ? (
            <>
              <h2 className="font-display text-3xl font-extrabold text-brand">
                {cancelledPayment ? "Payment cancelled" : "Confirming your payment"}
              </h2>
              <p className="mt-3 text-ink">
                {cancelledPayment
                  ? "You left the payment page, so your order has not been placed yet. Your cart is still saved."
                  : "This page updates by itself. It usually takes a few seconds. If you have already paid and nothing changes after a minute, call us and give your order number."}
              </p>
              <Link
                to="/checkout"
                className="mt-4 inline-block rounded-full border-2 border-brand px-6 py-2 font-bold text-brand transition duration-300 hover:bg-brand hover:text-white"
              >
                Back to checkout
              </Link>
            </>
          ) : (
            <>
              <p className="text-sm font-bold uppercase tracking-widest text-sage">
                Order placed
              </p>
              <h2 className="mt-2 font-display text-3xl font-extrabold text-brand">
                Thank you, {order.name}
              </h2>
            </>
          )}

          <div className="mt-6 rounded-xl bg-mint p-6">
            <p className="text-sm text-muted">Order number</p>
            <p className="font-display text-5xl font-extrabold text-brand">
              #{order.number}
            </p>
            <p className="mt-4 text-sm text-muted">
              {delivery ? "Delivery" : "Pickup"}
            </p>
            <p className="text-lg font-bold text-ink">
              {delivery
                ? "To the address you gave us"
                : `${formatDate(order.date)} at ${formatTime(order.time)}`}
            </p>
            <p className="mt-4 text-sm text-ink">{paymentNote}</p>
          </div>

          {order.status !== "cancelled" && !waitingForPayment && (
            <ol className="mt-6 grid grid-cols-4 gap-2 text-center text-sm">
              {steps.map((s, i) => (
                <li
                  key={s.key}
                  className={`rounded-lg px-1 py-2 font-bold transition duration-300 ${
                    i <= stepIndex ? "bg-brand text-white" : "bg-line text-muted"
                  }`}
                >
                  {s.label}
                </li>
              ))}
            </ol>
          )}

          <ul className="mt-6 divide-y divide-line">
            {order.items.map((i) => (
              <li key={i.name} className="flex justify-between gap-4 py-2">
                <span>
                  {i.qty} × {i.name}
                </span>
                <span>{formatPrice(i.price * i.qty)}</span>
              </li>
            ))}
            {order.deliveryFee > 0 && (
              <li className="flex justify-between gap-4 py-2">
                <span>Delivery fee</span>
                <span>{formatPrice(order.deliveryFee)}</span>
              </li>
            )}
            <li className="flex justify-between gap-4 pt-3 text-lg font-bold">
              <span>Total</span>
              <span>{formatPrice(order.total)}</span>
            </li>
          </ul>

          <p className="mt-6 text-sm text-muted">
            Keep this page's link to check your order again. To change your
            order, call{" "}
            <a href={`tel:${cafe.phone}`} className="font-bold text-brand underline">
              {cafe.phone}
            </a>
            .
          </p>

          <Link
            to="/menu"
            className="mt-6 inline-block rounded-full bg-brand px-6 py-3 font-bold text-white transition duration-300 hover:bg-sage"
          >
            Back to the menu
          </Link>
        </div>
      </section>
    </>
  );
}