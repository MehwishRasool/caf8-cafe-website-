import { Link } from "react-router-dom";
import {
  CATEGORIES,
  formatPrice,
  useMenu,
  useCart,
  cartActions,
  loadMenu,
} from "../data/store";

const slug = (s) => s.toLowerCase().replace(/\s+/g, "-");

/* Add button, which turns into a - 1 + counter once an item is in the cart */
function Counter({ item, qty }) {
  if (qty === 0) {
    return (
      <button
        type="button"
        onClick={() => cartActions.set(item.id, 1)}
        aria-label={`Add ${item.name}`}
        className="rounded-full bg-brand px-5 py-2 font-bold text-white transition duration-300 hover:-translate-y-0.5 hover:bg-accent hover:text-brand"
      >
        Add
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => cartActions.set(item.id, qty - 1)}
        aria-label={`Remove one ${item.name}`}
        className="h-9 w-9 rounded-full border-2 border-brand font-bold text-brand transition duration-200 hover:bg-brand hover:text-white"
      >
        -
      </button>
      <span className="w-6 text-center font-bold" aria-live="polite">
        {qty}
      </span>
      <button
        type="button"
        onClick={() => cartActions.set(item.id, qty + 1)}
        aria-label={`Add one more ${item.name}`}
        className="h-9 w-9 rounded-full border-2 border-brand font-bold text-brand transition duration-200 hover:bg-brand hover:text-white"
      >
        +
      </button>
    </div>
  );
}

export default function Menu() {
  const { items, status } = useMenu();
  const { qty, count, total } = useCart();

  const groups = CATEGORIES.map((cat) => ({
    cat,
    list: items.filter((i) => !i.hidden && i.category === cat),
  })).filter((g) => g.list.length > 0);

  return (
    <>
      {/* Title banner */}
      <section className="relative overflow-hidden bg-brand text-white">
        <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-sage/50" />
        <div className="absolute bottom-0 left-[12%] h-16 w-16 translate-y-1/2 rounded-full bg-accent" />
        <div className="relative mx-auto max-w-6xl px-5 py-16">
          <h1 className="animate-fade-up font-display text-5xl font-extrabold md:text-6xl">
            Menu
          </h1>
          <p
            className="animate-fade-up mt-3 max-w-md text-white/80"
            style={{ animationDelay: "120ms" }}
          >
            Order ahead and pick up at the counter. Add what you like, then
            choose a pickup time at checkout.
          </p>
        </div>
      </section>

      {/* Category links */}
      {groups.length > 0 && (
        <nav
          aria-label="Menu categories"
          className="sticky top-16 z-30 border-b border-line bg-paper/95 backdrop-blur"
        >
          <ul className="mx-auto flex max-w-6xl gap-2 overflow-x-auto px-5 py-3">
            {groups.map(({ cat }) => (
              <li key={cat}>
                <a
                  href={`#${slug(cat)}`}
                  className="inline-block whitespace-nowrap rounded-full bg-mint px-4 py-2 font-medium text-brand transition duration-300 hover:bg-accent"
                >
                  {cat}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}

      {/* Items */}
      <div
        className={`mx-auto max-w-6xl px-5 pt-12 ${
          count > 0 ? "pb-32" : "pb-16"
        }`}
      >
        {status === "loading" && (
          <p className="py-16 text-center text-lg text-muted">
            Loading the menu...
          </p>
        )}

        {status === "error" && items.length === 0 && (
          <div className="py-16 text-center">
            <p className="text-lg text-muted">We could not load the menu.</p>
            <button
              type="button"
              onClick={() => loadMenu()}
              className="mt-4 rounded-full bg-brand px-6 py-2 font-bold text-white transition duration-300 hover:bg-sage"
            >
              Try again
            </button>
          </div>
        )}

        {status === "ready" && groups.length === 0 && (
          <p className="py-16 text-center text-lg text-muted">
            The menu is being updated. Please check back soon.
          </p>
        )}

        {groups.map(({ cat, list }) => (
          <section key={cat} id={slug(cat)} className="mb-14 scroll-mt-36">
            <h2 className="mb-6 font-display text-3xl font-extrabold text-brand md:text-4xl">
              {cat}
            </h2>
            <ul className="grid gap-4 md:grid-cols-2">
              {list.map((item, i) => (
                <li
                  key={item.id}
                  className="animate-fade-up flex items-start justify-between gap-4 rounded-xl bg-card p-5 shadow-sm"
                  style={{ animationDelay: `${Math.min(i, 8) * 60}ms` }}
                >
                  <div className="min-w-0">
                    <h3 className="font-display text-xl font-bold">
                      {item.name}
                    </h3>
                    {item.description && (
                      <p className="mt-1 text-sm text-muted">
                        {item.description}
                      </p>
                    )}
                    <p className="mt-2 font-bold text-brand">
                      {formatPrice(item.price)}
                    </p>
                  </div>
                  <Counter item={item} qty={qty(item.id)} />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      {/* Cart bar: slides up once something is added */}
      <div
        className={`fixed inset-x-0 bottom-0 z-40 bg-brand text-white shadow-lg transition-all duration-300 ${
          count > 0 ? "visible translate-y-0" : "invisible translate-y-full"
        }`}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3">
          <p>
            <span className="font-bold">
              {count} {count === 1 ? "item" : "items"}
            </span>
            <span className="ml-3 text-white/80">{formatPrice(total)}</span>
          </p>
          <Link
            to="/cart"
            className="rounded-full bg-accent px-6 py-2 font-bold text-brand transition duration-300 hover:bg-white"
          >
            View cart
          </Link>
        </div>
      </div>
    </>
  );
}