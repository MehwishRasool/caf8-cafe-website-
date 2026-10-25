import { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { cafe } from "../data/cafe";

const links = [
  { to: "/", label: "Home" },
  { to: "/menu", label: "Menu" },
  { to: "/reserve", label: "Reserve" },
  { to: "/about", label: "About" },
  { to: "/contact", label: "Contact" },
];

const underline =
  "relative pb-1 after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-full after:origin-left after:bg-accent after:transition-transform after:duration-300";

export default function Header({ cartCount = 0 }) {
  const { pathname } = useLocation();
  const isHome = pathname === "/";
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // transparent over the home hero, solid everywhere else
  const solid = scrolled || open || !isHome;

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        solid
          ? "bg-paper/95 text-ink shadow-sm backdrop-blur"
          : "bg-transparent text-white"
      }`}
    >
      <div
        className={`mx-auto flex max-w-6xl items-center justify-between px-5 transition-all duration-300 ${
          solid ? "h-16" : "h-24"
        }`}
      >
        {/* Logo: the 8 turns sideways on hover */}
        <Link
          to="/"
          className="group font-display text-3xl font-bold tracking-tight"
        >
          Caf
          <span className="inline-block text-accent transition-transform duration-500 group-hover:rotate-90">
            8
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-8 md:flex">
          <ul className="flex items-center gap-8 font-medium">
            {links.map((l) => (
              <li key={l.to}>
                <NavLink
                  to={l.to}
                  end={l.to === "/"}
                  className={({ isActive }) =>
                    `${underline} ${
                      isActive
                        ? "after:scale-x-100"
                        : "after:scale-x-0 hover:after:scale-x-100"
                    }`
                  }
                >
                  {l.label}
                </NavLink>
              </li>
            ))}
          </ul>

          <Link
            to="/cart"
            className="flex items-center gap-2 rounded-full bg-accent px-5 py-2 font-medium text-ink transition duration-300 hover:-translate-y-0.5 hover:bg-brand hover:text-white"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M6 7h12l-1 13H7L6 7Z" />
              <path d="M9 7a3 3 0 0 1 6 0" />
            </svg>
            Cart
            {cartCount > 0 && (
              <span
                key={cartCount}
                className="animate-bump rounded-full bg-ink px-2 text-sm text-white"
              >
                {cartCount}
              </span>
            )}
          </Link>
        </nav>

        {/* Mobile toggle: three lines morph into an X */}
        <button
          className="flex h-10 w-10 flex-col items-center justify-center gap-1.5 md:hidden"
          aria-label="Toggle navigation"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          <span
            className={`h-0.5 w-6 bg-current transition-transform duration-300 ${
              open ? "translate-y-2 rotate-45" : ""
            }`}
          />
          <span
            className={`h-0.5 w-6 bg-current transition-opacity duration-300 ${
              open ? "opacity-0" : ""
            }`}
          />
          <span
            className={`h-0.5 w-6 bg-current transition-transform duration-300 ${
              open ? "-translate-y-2 -rotate-45" : ""
            }`}
          />
        </button>
      </div>

      {/* Mobile menu: slides down, links appear one after another */}
      {open && (
        <nav className="animate-slide-down border-t border-line bg-paper text-ink md:hidden">
          <ul className="mx-auto flex max-w-6xl flex-col gap-1 px-5 py-4">
            {links.map((l, i) => (
              <li
                key={l.to}
                className="animate-fade-up"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <NavLink
                  to={l.to}
                  end={l.to === "/"}
                  className={({ isActive }) =>
                    `block py-3 text-lg ${
                      isActive ? "font-bold text-brand" : "text-ink"
                    }`
                  }
                >
                  {l.label}
                </NavLink>
              </li>
            ))}
            <li
              className="animate-fade-up pt-2"
              style={{ animationDelay: `${links.length * 60}ms` }}
            >
              <Link
                to="/cart"
                className="block rounded-full bg-accent py-3 text-center font-medium"
              >
                Cart {cartCount > 0 && `(${cartCount})`}
              </Link>
            </li>
          </ul>
        </nav>
      )}
    </header>
  );
}