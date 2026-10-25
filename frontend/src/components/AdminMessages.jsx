import { useEffect, useState } from "react";
import { api } from "../data/api";

const smallButton =
  "rounded-full border-2 border-brand px-4 py-1 text-sm font-bold text-brand transition duration-200 hover:bg-brand hover:text-white disabled:opacity-60";

function formatSent(iso) {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function AdminMessages({ onExpired }) {
  const [items, setItems] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [actionError, setActionError] = useState("");
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api
      .get("/api/admin/messages")
      .then((data) => {
        if (!cancelled) {
          setLoadError("");
          setItems(data);
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
  }, [attempt, onExpired]);

  const fail = (err) => {
    if (err.status === 401) onExpired();
    else setActionError(err.message);
  };

  const setRead = async (item, read) => {
    setBusyId(item.id);
    setActionError("");
    try {
      const updated = await api.put(`/api/admin/messages/${item.id}/read`, {
        read,
      });
      setItems((list) => list.map((m) => (m.id === updated.id ? updated : m)));
    } catch (err) {
      fail(err);
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (item) => {
    if (!window.confirm(`Delete the message from ${item.name}?`)) return;
    setBusyId(item.id);
    setActionError("");
    try {
      await api.del(`/api/admin/messages/${item.id}`);
      setItems((list) => list.filter((m) => m.id !== item.id));
    } catch (err) {
      fail(err);
    } finally {
      setBusyId(null);
    }
  };

  const unread = items ? items.filter((m) => !m.read).length : 0;

  return (
    <div className="mt-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-2xl font-bold text-brand">
          Messages
          {items && unread > 0 && (
            <span className="ml-3 rounded-full bg-accent px-3 py-1 text-sm font-bold text-brand">
              {unread} new
            </span>
          )}
        </h2>
        <button
          type="button"
          onClick={() => setAttempt((n) => n + 1)}
          className={smallButton}
        >
          Refresh
        </button>
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
          No messages yet. Messages from your Contact page will appear here.
        </p>
      )}

      <ul className="mt-6 space-y-3">
        {(items ?? []).map((m) => (
          <li
            key={m.id}
            className={`rounded-xl border bg-card p-4 ${
              m.read ? "border-line" : "border-accent shadow-sm"
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-bold text-ink">
                  {m.name}
                  {!m.read && (
                    <span className="ml-2 rounded-full bg-accent px-2 py-0.5 text-xs font-bold text-brand">
                      New
                    </span>
                  )}
                </p>
                <p className="text-sm text-muted">
                  <a href={`mailto:${m.email}`} className="underline">
                    {m.email}
                  </a>{" "}
                  · {formatSent(m.createdAt)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <a
                  href={`mailto:${m.email}?subject=${encodeURIComponent("Your message to Caf8")}`}
                  className={smallButton}
                >
                  Reply
                </a>
                <button
                  type="button"
                  disabled={busyId === m.id}
                  onClick={() => setRead(m, !m.read)}
                  className={smallButton}
                >
                  {m.read ? "Mark as new" : "Mark as read"}
                </button>
                <button
                  type="button"
                  disabled={busyId === m.id}
                  onClick={() => remove(m)}
                  className="rounded-full border-2 border-red-800 px-4 py-1 text-sm font-bold text-red-800 transition duration-200 hover:bg-red-800 hover:text-white disabled:opacity-60"
                >
                  Delete
                </button>
              </div>
            </div>
            <p className="mt-3 whitespace-pre-wrap break-words text-ink">
              {m.message}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}