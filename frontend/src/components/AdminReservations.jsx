import { useEffect, useState } from "react";
import { api } from "../data/api";
import { formatDate, formatTime } from "../data/format";

const badge = {
  pending: "bg-accent text-brand",
  confirmed: "bg-brand text-white",
  cancelled: "bg-line text-muted",
};

const label = {
  pending: "Waiting",
  confirmed: "Confirmed",
  cancelled: "Cancelled",
};

const scopeButton = (active) =>
  `rounded-full px-4 py-1 font-bold transition duration-200 ${
    active ? "bg-brand text-white" : "bg-mint text-brand hover:bg-accent"
  }`;

export default function AdminReservations({ onExpired }) {
  const [scope, setScope] = useState("upcoming");
  const [data, setData] = useState({ scope: "", items: null });
  const [loadError, setLoadError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [actionError, setActionError] = useState("");
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api
      .get(`/api/admin/reservations?scope=${scope === "past" ? "past" : "upcoming"}`)
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
    return () => {
      cancelled = true;
    };
  }, [scope, attempt, onExpired]);

  const items = data.scope === scope ? data.items : null;

  const change = async (item, status) => {
    if (
      status === "cancelled" &&
      !window.confirm(`Cancel the booking for ${item.name}?`)
    ) {
      return;
    }
    setBusyId(item.id);
    setActionError("");
    try {
      const updated = await api.put(`/api/admin/reservations/${item.id}/status`, {
        status,
      });
      setData((d) => ({
        ...d,
        items: d.items.map((r) => (r.id === updated.id ? updated : r)),
      }));
    } catch (err) {
      if (err.status === 401) onExpired();
      else setActionError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  // group the list by day
  const days = [];
  for (const r of items ?? []) {
    const last = days[days.length - 1];
    if (last && last.date === r.date) last.list.push(r);
    else days.push({ date: r.date, list: [r] });
  }

  return (
    <div className="mt-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-2xl font-bold text-brand">
          Reservations
        </h2>
        <div className="flex gap-2">
          <button
            type="button"
            aria-pressed={scope === "upcoming"}
            onClick={() => setScope("upcoming")}
            className={scopeButton(scope === "upcoming")}
          >
            Upcoming
          </button>
          <button
            type="button"
            aria-pressed={scope === "past"}
            onClick={() => setScope("past")}
            className={scopeButton(scope === "past")}
          >
            Past
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
          {scope === "past"
            ? "No past bookings yet."
            : "No upcoming bookings yet. New ones will appear here."}
        </p>
      )}

      {days.map((day) => (
        <div key={day.date} className="mt-8">
          <h3 className="font-display text-xl font-bold text-ink">
            {formatDate(day.date)}
          </h3>
          <ul className="mt-3 space-y-3">
            {day.list.map((r) => (
              <li
                key={r.id}
                className="grid gap-3 rounded-xl border border-line bg-card p-4 md:grid-cols-[110px_1fr_auto] md:items-center"
              >
                <p className="font-display text-xl font-bold text-brand">
                  {formatTime(r.time)}
                </p>
                <div className="min-w-0">
                  <p className="font-bold text-ink">
                    {r.name}{" "}
                    <span className="font-normal text-muted">
                      · {r.people} {r.people === 1 ? "guest" : "guests"}
                    </span>
                  </p>
                  <p className="text-sm text-muted">
                    <a href={`tel:${r.phone}`} className="underline">
                      {r.phone}
                    </a>{" "}
                    · No. {r.reference}
                  </p>
                  {r.notes && (
                    <p className="mt-1 break-words text-sm text-ink">
                      Note: {r.notes}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-3 py-1 text-sm font-bold ${badge[r.status]}`}
                  >
                    {label[r.status]}
                  </span>
                  {r.status === "pending" && (
                    <button
                      type="button"
                      disabled={busyId === r.id}
                      onClick={() => change(r, "confirmed")}
                      className="rounded-full bg-brand px-4 py-1 font-bold text-white transition duration-200 hover:bg-sage disabled:opacity-60"
                    >
                      Confirm
                    </button>
                  )}
                  {r.status !== "cancelled" && (
                    <button
                      type="button"
                      disabled={busyId === r.id}
                      onClick={() => change(r, "cancelled")}
                      className="rounded-full border-2 border-brand px-4 py-1 font-bold text-brand transition duration-200 hover:bg-brand hover:text-white disabled:opacity-60"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}