import { useEffect, useState } from "react";
import { api } from "../data/api";
import { formatDate, formatTime } from "../data/format";
import { formatPrice } from "../data/store";

const REFRESH_SECONDS = 15;

const badge = {
  new: "bg-accent text-brand",
  preparing: "bg-sage text-white",
  ready: "bg-brand text-white",
  done: "bg-line text-muted",
  cancelled: "bg-line text-muted",
};

const label = {
  new: "New",
  preparing: "Preparing",
  ready: "Ready",
  done: "Done",
  cancelled: "Cancelled",
};

// the button that moves an order to its next step
const next = {
  new: { status: "preparing", text: "Start preparing" },
  preparing: { status: "ready", text: "Mark ready" },
  ready: { status: "done", text: "Mark done" },
};

const scopeButton = (active) =>
  `rounded-full px-4 py-1 font-bold transition duration-200 ${
    active ? "bg-brand text-white" : "bg-mint text-brand hover:bg-accent"
  }`;

// how this order is being paid, in words
function paymentInfo(o) {
  if (o.paymentMethod === "cash") {
    const where = o.fulfilment === "delivery" ? "Cash on delivery" : "Cash at pickup";
    return o.paymentStatus === "paid"
      ? { text: `${where} (received)`, cls: "bg-line text-muted" }
      : { text: `${where}: collect `, cls: "bg-accent text-brand", collect: true };
  }
  if (o.paymentStatus === "paid") {
    return { text: "Paid online", cls: "bg-brand text-white" };
  }
  if (o.paymentStatus === "failed") {
    return { text: "Online payment failed", cls: "bg-red-800 text-white" };
  }
  return { text: "Waiting for online payment", cls: "bg-red-100 text-red-800" };
}

export default function AdminOrders({ onExpired }) {
  const [scope, setScope] = useState("active");
  const [data, setData] = useState({ scope: "", items: null });
  const [loadError, setLoadError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [actionError, setActionError] = useState("");
  const [busyId, setBusyId] = useState(null);

  // loads the list, and again every 15 seconds so new orders show up by themselves
  useEffect(() => {
    let cancelled = false;

    const load = () =>
      api
        .get(`/api/admin/orders?scope=${scope === "done" ? "done" : "active"}`)
        .then((items) => {
          if (!cancelled) {
            setLoadError("");
            setData({ scope, items });
          }
        })
        .catch((err) => {
          if (cancelled) return;
          if (err.status === 401) onExpired();
          else setLoadError(err.message);
        });

    load();
    const timer = setInterval(load, REFRESH_SECONDS * 1000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [scope, attempt, onExpired]);

  const items = data.scope === scope ? data.items : null;

  // runs one change on an order, then updates the list
  const run = async (order, request) => {
    setBusyId(order.id);
    setActionError("");
    try {
      const updated = await request();
      // an order that is done or cancelled leaves the active list
      setData((d) => ({
        ...d,
        items:
          scope === "active" && ["done", "cancelled"].includes(updated.status)
            ? d.items.filter((o) => o.id !== updated.id)
            : d.items.map((o) => (o.id === updated.id ? updated : o)),
      }));
    } catch (err) {
      if (err.status === 401) onExpired();
      else setActionError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const change = (order, status) => {
    if (
      status === "cancelled" &&
      !window.confirm(`Cancel order #${order.number} for ${order.name}?`)
    ) {
      return;
    }
    run(order, () =>
      api.put(`/api/admin/orders/${order.id}/status`, { status })
    );
  };

  const markPaid = (order) => {
    if (
      !window.confirm(
        `Only continue if you can see this payment of ${formatPrice(order.total)} in your Safepay dashboard. Mark order #${order.number} as paid?`
      )
    ) {
      return;
    }
    run(order, () => api.put(`/api/admin/orders/${order.id}/paid`, {}));
  };

  const newCount =
    scope === "active" && items
      ? items.filter((o) => o.status === "new").length
      : 0;

  return (
    <div className="mt-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-2xl font-bold text-brand">
          Orders
          {newCount > 0 && (
            <span className="ml-3 rounded-full bg-accent px-3 py-1 text-sm font-bold text-brand">
              {newCount} new
            </span>
          )}
        </h2>
        <div className="flex gap-2">
          <button
            type="button"
            aria-pressed={scope === "active"}
            onClick={() => setScope("active")}
            className={scopeButton(scope === "active")}
          >
            To prepare
          </button>
          <button
            type="button"
            aria-pressed={scope === "done"}
            onClick={() => setScope("done")}
            className={scopeButton(scope === "done")}
          >
            Finished
          </button>
          <button
            type="button"
            onClick={() => setAttempt((n) => n + 1)}
            className="rounded-full border-2 border-brand px-4 py-1 font-bold text-brand transition duration-200 hover:bg-brand hover:text-white"
          >
            Refresh
          </button>
        </div>
      </div>
      <p className="mt-1 text-sm text-muted">
        This list updates by itself every {REFRESH_SECONDS} seconds.
      </p>

      {actionError && (
        <p role="alert" className="mt-4 font-medium text-red-800">
          {actionError}
        </p>
      )}
      {loadError && (
        <p role="alert" className="mt-6 font-medium text-red-800">
          {loadError}
        </p>
      )}
      {!loadError && !items && <p className="mt-6 text-muted">Loading...</p>}
      {items && items.length === 0 && (
        <p className="mt-6 rounded-xl bg-mint px-6 py-8 text-ink">
          {scope === "done"
            ? "No finished orders yet."
            : "No orders to prepare. New orders will appear here."}
        </p>
      )}

      <ul className="mt-6 space-y-3">
        {(items ?? []).map((o) => {
          const pay = paymentInfo(o);
          const delivery = o.fulfilment === "delivery";
          const unpaidOnline =
            o.paymentMethod === "online" && o.paymentStatus !== "paid";

          return (
            <li
              key={o.id}
              className={`rounded-xl border bg-card p-4 ${
                o.status === "new" ? "border-accent shadow-sm" : "border-line"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-display text-xl font-bold text-brand">
                    #{o.number}{" "}
                    <span className="rounded-full bg-mint px-3 py-0.5 align-middle text-sm font-bold">
                      {delivery ? "Delivery" : "Pickup"}
                    </span>
                  </p>
                  {!delivery && (
                    <p className="text-sm text-muted">
                      Pickup {formatTime(o.time)}, {formatDate(o.date)}
                    </p>
                  )}
                  <p className="mt-1 font-bold text-ink">
                    {o.name}{" "}
                    <a
                      href={`tel:${o.phone}`}
                      className="font-normal text-muted underline"
                    >
                      {o.phone}
                    </a>
                  </p>
                  {delivery && (
                    <p className="mt-1 break-words text-ink">
                      <span className="font-bold">Address:</span> {o.address}
                    </p>
                  )}
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-sm font-bold ${badge[o.status]}`}
                >
                  {label[o.status]}
                </span>
              </div>

              <ul className="mt-3 space-y-1">
                {o.items.map((i) => (
                  <li key={i.name} className="flex justify-between gap-4">
                    <span>
                      <span className="font-bold">{i.qty} ×</span> {i.name}
                    </span>
                    <span className="text-muted">
                      {formatPrice(i.price * i.qty)}
                    </span>
                  </li>
                ))}
                {o.deliveryFee > 0 && (
                  <li className="flex justify-between gap-4 text-muted">
                    <span>Delivery fee</span>
                    <span>{formatPrice(o.deliveryFee)}</span>
                  </li>
                )}
              </ul>
              <p className="mt-2 flex justify-between border-t border-line pt-2 font-bold">
                <span>Total</span>
                <span>{formatPrice(o.total)}</span>
              </p>

              <p className="mt-2">
                <span
                  className={`inline-block rounded-full px-3 py-1 text-sm font-bold ${pay.cls}`}
                >
                  {pay.collect ? `${pay.text}${formatPrice(o.total)}` : pay.text}
                </span>
              </p>

              {o.notes && (
                <p className="mt-2 break-words text-sm text-ink">
                  Note: {o.notes}
                </p>
              )}

              {next[o.status] && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {unpaidOnline ? (
                    <button
                      type="button"
                      disabled={busyId === o.id}
                      onClick={() => markPaid(o)}
                      className="rounded-full bg-brand px-5 py-2 font-bold text-white transition duration-200 hover:bg-sage disabled:opacity-60"
                    >
                      Mark as paid
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={busyId === o.id}
                      onClick={() => change(o, next[o.status].status)}
                      className="rounded-full bg-brand px-5 py-2 font-bold text-white transition duration-200 hover:bg-sage disabled:opacity-60"
                    >
                      {o.status === "ready" && delivery
                        ? "Mark delivered"
                        : next[o.status].text}
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={busyId === o.id}
                    onClick={() => change(o, "cancelled")}
                    className="rounded-full border-2 border-red-800 px-5 py-2 font-bold text-red-800 transition duration-200 hover:bg-red-800 hover:text-white disabled:opacity-60"
                  >
                    Cancel order
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}