import { Link } from "react-router-dom";
import { cartActions, formatPrice, loadMenu, useCart, useMenu } from "../data/store";

const stepButton =
  "grid h-9 w-9 place-items-center rounded-full border-2 border-brand text-lg font-bold text-brand transition duration-200 hover:bg-brand hover:text-white disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-brand";

export default function Cart() {
  const { status } = useMenu();
  const { lines, count, total } = useCart();

  const header = (
    <section className="bg-brand px-5 py-14 text-white">
      <div className="mx-auto max-w-6xl">
        <h1 className="animate-fade-up font-display text-4xl font-extrabold md:text-5xl">
          Your <span className="text-accent">cart</span>
        </h1>
      </div>
    </section>
  );

  // while the menu loads, we cannot show the cart yet
  if (status === "idle" || (status === "loading" && lines.length === 0)) {
    return (
      <>
        {header}
        <p className="px-5 py-12 text-center text-muted">Loading your cart...</p>
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
      <section className="mx-auto grid max-w-6xl gap-10 px-5 py-12 lg:grid-cols-[1fr_340px]">
        <ul className="divide-y divide-line">
          {lines.map(({ item, qty }) => (
            <li
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-4 py-5"
            >
              <div className="min-w-0">
                <p className="font-display text-lg font-bold text-ink">
                  {item.name}
                </p>
                <p className="text-sm text-muted">{formatPrice(item.price)} each</p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  aria-label={`One fewer ${item.name}`}
                  onClick={() => cartActions.set(item.id, qty - 1)}
                  className={stepButton}
                >
                  −
                </button>
                <span className="min-w-6 text-center font-bold">{qty}</span>
                <button
                  type="button"
                  aria-label={`One more ${item.name}`}
                  disabled={qty >= 20}
                  onClick={() => cartActions.set(item.id, qty + 1)}
                  className={stepButton}
                >
                  +
                </button>
              </div>

              <div className="flex w-32 items-center justify-end gap-4">
                <p className="font-bold text-ink">{formatPrice(item.price * qty)}</p>
                <button
                  type="button"
                  aria-label={`Remove ${item.name}`}
                  onClick={() => cartActions.set(item.id, 0)}
                  className="text-sm font-medium text-red-800 underline"
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>

        <aside className="h-fit rounded-2xl bg-mint p-6 lg:sticky lg:top-24">
          <h2 className="font-display text-xl font-bold text-brand">
            Order summary
          </h2>
          <dl className="mt-4 space-y-2">
            <div className="flex justify-between">
              <dt>
                Items ({count})
              </dt>
              <dd className="font-bold">{formatPrice(total)}</dd>
            </div>
            <div className="flex justify-between text-sm text-muted">
              <dt>Delivery fee</dt>
              <dd>Chosen at checkout</dd>
            </div>
          </dl>
          <Link
            to="/checkout"
            className="mt-6 block rounded-full bg-brand px-6 py-3 text-center font-bold text-white transition duration-300 hover:bg-sage"
          >
            Go to checkout
          </Link>
          <Link
            to="/menu"
            className="mt-4 block text-center font-bold text-brand underline"
          >
            Add more items
          </Link>
        </aside>
      </section>
    </>
  );
}