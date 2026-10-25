import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../data/api";
import { formatPrice } from "../data/store";

// A pretend payment page, used only while the backend is in demo mode.
// It never asks for card details. The buttons just tell the backend what happened.
export default function DemoPay() {
  const { publicId } = useParams();
  const navigate = useNavigate();

  const [state, setState] = useState({ order: null, error: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    api
      .get(`/api/orders/track/${encodeURIComponent(publicId)}`)
      .then((order) => {
        if (!cancelled) setState({ order, error: "" });
      })
      .catch((err) => {
        if (!cancelled) setState({ order: null, error: err.message });
      });
    return () => {
      cancelled = true;
    };
  }, [publicId]);

  const finish = async (outcome) => {
    setBusy(true);
    setError("");
    try {
      await api.post(`/api/payments/demo/${encodeURIComponent(publicId)}`, {
        outcome,
      });
      navigate(`/order/${publicId}`);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  const { order } = state;
  const canPay =
    order &&
    order.paymentMethod === "online" &&
    order.paymentStatus === "pending" &&
    order.status !== "cancelled";

  return (
    <section className="px-5 py-16">
      <div className="animate-fade-up mx-auto max-w-md rounded-2xl bg-card p-8 shadow-sm">
        <p className="inline-block rounded-full bg-accent px-3 py-1 text-xs font-bold uppercase tracking-widest text-brand">
          Demo payment page
        </p>
        <h1 className="mt-4 font-display text-3xl font-extrabold text-brand">
          Pretend payment
        </h1>
        <p className="mt-2 text-ink">
          This is a practice page. No card is needed and no real money is used.
          Never type a real card number into a test site.
        </p>

        {state.error && !order && (
          <p role="alert" className="mt-6 font-medium text-red-800">
            {state.error}
          </p>
        )}
        {!order && !state.error && (
          <p className="mt-6 text-muted">Loading...</p>
        )}

        {order && (
          <div className="mt-6 rounded-xl bg-mint p-5">
            <p className="text-sm text-muted">Order #{order.number}</p>
            <p className="font-display text-4xl font-extrabold text-brand">
              {formatPrice(order.total)}
            </p>
          </div>
        )}

        {order && !canPay && (
          <p className="mt-6 text-ink">
            This payment has already been dealt with.{" "}
            <Link to={`/order/${publicId}`} className="font-bold text-brand underline">
              See your order
            </Link>
          </p>
        )}

        {canPay && (
          <div className="mt-6 space-y-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => finish("paid")}
              className="w-full rounded-full bg-brand px-6 py-3 font-bold text-white transition duration-300 hover:bg-sage disabled:opacity-60"
            >
              {busy ? "Please wait..." : `Pay ${formatPrice(order.total)} (demo)`}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => finish("failed")}
              className="w-full rounded-full border-2 border-red-800 px-6 py-3 font-bold text-red-800 transition duration-200 hover:bg-red-800 hover:text-white disabled:opacity-60"
            >
              Pretend the payment failed
            </button>
            <Link
              to={`/order/${publicId}?cancelled=1`}
              className="block text-center font-bold text-brand underline"
            >
              Cancel and go back
            </Link>
          </div>
        )}

        {error && (
          <p role="alert" className="mt-4 font-medium text-red-800">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}