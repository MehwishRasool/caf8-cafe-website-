import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../data/api";
import { CATEGORIES, formatPrice, loadMenu } from "../data/store";
import AdminReservations from "../components/AdminReservations";
import AdminMessages from "../components/AdminMessages";
import AdminOrders from "../components/AdminOrders";

const emptyForm = {
  name: "",
  price: "",
  category: CATEGORIES[0],
  description: "",
  hidden: false,
};

const inputClass =
  "w-full rounded-lg border border-line bg-card px-3 py-2 text-ink placeholder:text-muted";

const outlineButton =
  "rounded-full border-2 border-brand px-4 py-1 text-brand transition duration-200 hover:bg-brand hover:text-white";

// the fields the server accepts for a menu item
const toPayload = (item, hidden = item.hidden) => ({
  name: item.name,
  price: item.price,
  category: item.category,
  description: item.description ?? "",
  hidden: Boolean(hidden),
});

/* ---------- Login ---------- */
function Login({ onLoggedIn }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      // the server still calls this field "email", but it holds your username
      const user = await api.post("/api/auth/login", {
        email: username,
        password,
      });
      onLoggedIn(user);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <section className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-5 py-16">
      <h1 className="font-display text-4xl font-extrabold text-brand">
        Owner login
      </h1>
      <p className="mt-2 text-muted">
        Sign in to manage your menu, orders and bookings.
      </p>

      <form onSubmit={submit} className="mt-8 space-y-4">
        <div>
          <label htmlFor="username" className="mb-1 block font-medium">
            Username
          </label>
          <input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            required
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="password" className="mb-1 block font-medium">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
            className={inputClass}
          />
        </div>
        {error && (
          <p role="alert" className="text-sm font-medium text-red-800">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-full bg-brand px-8 py-3 font-bold text-white transition duration-300 hover:bg-sage disabled:opacity-60"
        >
          {busy ? "Logging in..." : "Log in"}
        </button>
      </form>
    </section>
  );
}

/* ---------- Menu tab: add, edit, hide and delete items ---------- */
function MenuManager({ onExpired }) {
  const [items, setItems] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [formError, setFormError] = useState("");
  const [actionError, setActionError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .get("/api/admin/menu")
      .then((data) => {
        if (!cancelled) setItems(data);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err.status === 401) onExpired();
        else setLoadError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [onExpired, attempt]);

  // a 401 means the login ran out, so go back to the login page
  const fail = (err, setter) => {
    if (err.status === 401) onExpired();
    else setter(err.message);
  };

  // reload the list here, and refresh what customers see on the menu page
  const refresh = async () => {
    setItems(await api.get("/api/admin/menu"));
    loadMenu();
  };

  const setField = (field) => (e) => {
    const value =
      e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [field]: value }));
  };

  const cancel = () => {
    setEditingId(null);
    setForm(emptyForm);
    setFormError("");
  };

  const startEdit = (item) => {
    setEditingId(item.id);
    setForm({
      name: item.name,
      price: String(item.price),
      category: item.category,
      description: item.description ?? "",
      hidden: Boolean(item.hidden),
    });
    setFormError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const submit = async (e) => {
    e.preventDefault();
    const name = form.name.trim();
    const price = Number(form.price);

    if (!name) {
      setFormError("Enter a name for the item.");
      return;
    }
    if (form.price === "" || Number.isNaN(price) || price < 0) {
      setFormError("Enter a price of 0 or more.");
      return;
    }

    const data = {
      name,
      price,
      category: form.category,
      description: form.description.trim(),
      hidden: form.hidden,
    };

    setSaving(true);
    setFormError("");
    try {
      if (editingId) await api.put(`/api/admin/menu/${editingId}`, data);
      else await api.post("/api/admin/menu", data);
      await refresh();
      cancel();
    } catch (err) {
      fail(err, setFormError);
    } finally {
      setSaving(false);
    }
  };

  const toggleHidden = async (item) => {
    setActionError("");
    try {
      await api.put(`/api/admin/menu/${item.id}`, toPayload(item, !item.hidden));
      await refresh();
    } catch (err) {
      fail(err, setActionError);
    }
  };

  const remove = async (item) => {
    if (!window.confirm(`Delete "${item.name}"? This cannot be undone.`)) return;
    setActionError("");
    try {
      await api.del(`/api/admin/menu/${item.id}`);
      if (editingId === item.id) cancel();
      await refresh();
    } catch (err) {
      fail(err, setActionError);
    }
  };

  if (loadError) {
    return (
      <div className="mt-8">
        <p role="alert" className="font-medium text-red-800">
          {loadError}
        </p>
        <button
          type="button"
          onClick={() => {
            setLoadError("");
            setAttempt((a) => a + 1);
          }}
          className="mt-3 rounded-full bg-brand px-6 py-2 font-bold text-white transition duration-300 hover:bg-sage"
        >
          Try again
        </button>
      </div>
    );
  }

  if (items === null) {
    return <p className="mt-8 text-muted">Loading your menu...</p>;
  }

  const groups = CATEGORIES.map((cat) => ({
    cat,
    list: items.filter((i) => i.category === cat),
  })).filter((g) => g.list.length > 0);

  return (
    <div className="mt-8 grid gap-8 lg:grid-cols-[22rem_1fr]">
      {/* Add / edit form */}
      <form
        onSubmit={submit}
        className="space-y-4 self-start rounded-xl bg-card p-5 shadow-sm lg:sticky lg:top-24"
      >
        <h2 className="font-display text-2xl font-bold text-brand">
          {editingId ? "Edit item" : "Add item"}
        </h2>

        <div>
          <label htmlFor="name" className="mb-1 block font-medium">
            Name
          </label>
          <input
            id="name"
            value={form.name}
            onChange={setField("name")}
            maxLength={80}
            className={inputClass}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="price" className="mb-1 block font-medium">
              Price
            </label>
            <input
              id="price"
              type="number"
              min="0"
              step="any"
              inputMode="decimal"
              value={form.price}
              onChange={setField("price")}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="category" className="mb-1 block font-medium">
              Category
            </label>
            <select
              id="category"
              value={form.category}
              onChange={setField("category")}
              className={inputClass}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="description" className="mb-1 block font-medium">
            Short description
          </label>
          <textarea
            id="description"
            rows={3}
            maxLength={200}
            value={form.description}
            onChange={setField("description")}
            className={inputClass}
          />
        </div>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={form.hidden}
            onChange={setField("hidden")}
            className="h-4 w-4 accent-brand"
          />
          Hide from the menu
        </label>

        {formError && (
          <p role="alert" className="text-sm font-medium text-red-800">
            {formError}
          </p>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="flex-1 rounded-full bg-brand px-6 py-2 font-bold text-white transition duration-300 hover:bg-sage disabled:opacity-60"
          >
            {saving ? "Saving..." : editingId ? "Save changes" : "Add item"}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={cancel}
              className="rounded-full border-2 border-brand px-6 py-2 font-bold text-brand transition duration-300 hover:bg-brand hover:text-white"
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      {/* Current items */}
      <div>
        {actionError && (
          <p role="alert" className="mb-4 font-medium text-red-800">
            {actionError}
          </p>
        )}

        {groups.length === 0 && (
          <p className="text-muted">
            The menu is empty. Add your first item using the form.
          </p>
        )}

        {groups.map(({ cat, list }) => (
          <div key={cat} className="mb-8">
            <h2 className="mb-3 font-display text-2xl font-bold text-brand">
              {cat}
            </h2>
            <ul className="space-y-3">
              {list.map((item) => (
                <li
                  key={item.id}
                  className={`flex flex-wrap items-center justify-between gap-3 rounded-xl bg-card p-4 shadow-sm ${
                    item.hidden ? "opacity-60" : ""
                  }`}
                >
                  <div className="min-w-0">
                    <p className="font-bold">
                      {item.name}
                      {item.hidden && (
                        <span className="ml-2 rounded-full bg-mint px-2 py-0.5 text-xs font-medium">
                          Hidden
                        </span>
                      )}
                    </p>
                    <p className="text-sm text-muted">
                      {formatPrice(item.price)}
                    </p>
                  </div>
                  <div className="flex gap-2 text-sm font-bold">
                    <button
                      type="button"
                      onClick={() => startEdit(item)}
                      className={outlineButton}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleHidden(item)}
                      className={outlineButton}
                    >
                      {item.hidden ? "Show" : "Hide"}
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(item)}
                      className="rounded-full border-2 border-red-800 px-4 py-1 text-red-800 transition duration-200 hover:bg-red-800 hover:text-white"
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

const tabs = [
  { id: "menu", label: "Menu" },
  { id: "orders", label: "Orders" },
  { id: "reservations", label: "Reservations" },
  { id: "messages", label: "Messages" },
];

/* ---------- The page ---------- */
export default function Admin() {
  // undefined = still checking, null = logged out, otherwise { email }
  const [user, setUser] = useState(undefined);
  const [tab, setTab] = useState("menu");
  const expire = useCallback(() => setUser(null), []);

  // are we already logged in? (the login lasts 8 hours)
  useEffect(() => {
    let cancelled = false;
    api
      .get("/api/auth/me")
      .then((u) => {
        if (!cancelled) setUser(u);
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const logout = async () => {
    try {
      await api.post("/api/auth/logout");
      setUser(null);
    } catch {
      window.alert("Could not log out. Check your connection and try again.");
    }
  };

  if (user === undefined) {
    return <p className="px-5 py-24 text-center text-muted">Checking login...</p>;
  }

  if (user === null) return <Login onLoggedIn={setUser} />;

  return (
    <section className="mx-auto max-w-6xl px-5 py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-extrabold text-brand">
            Owner area
          </h1>
          <p className="text-sm text-muted">Signed in as {user.email}</p>
        </div>
        <div className="flex gap-3">
          <Link
            to="/menu"
            className="rounded-full border-2 border-brand px-5 py-2 font-bold text-brand transition duration-300 hover:bg-brand hover:text-white"
          >
            View menu
          </Link>
          <button
            type="button"
            onClick={logout}
            className="rounded-full bg-brand px-5 py-2 font-bold text-white transition duration-300 hover:bg-sage"
          >
            Log out
          </button>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            aria-pressed={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-full px-5 py-2 font-bold transition duration-300 ${
              tab === t.id
                ? "bg-brand text-white"
                : "bg-mint text-brand hover:bg-accent"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "menu" && <MenuManager onExpired={expire} />}
      {tab === "orders" && <AdminOrders onExpired={expire} />}
      {tab === "reservations" && <AdminReservations onExpired={expire} />}
      {tab === "messages" && <AdminMessages onExpired={expire} />}
    </section>
  );
}