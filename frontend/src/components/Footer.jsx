import { Link } from "react-router-dom";
import { cafe } from "../data/cafe";
import useInView from "../hooks/useInView";

const reveal = (inView, i) => ({
  className: `transition-all duration-700 ease-out ${
    inView ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
  }`,
  style: { transitionDelay: `${i * 120}ms` },
});

const linkClass =
  "inline-block transition duration-200 hover:translate-x-1 hover:text-accent";

export default function Footer() {
  const [ref, inView] = useInView(0.15);

  return (
    <footer className="bg-brand text-white">
      <div
        ref={ref}
        className="mx-auto grid max-w-6xl gap-10 px-5 py-14 md:grid-cols-4"
      >
        <div {...reveal(inView, 0)}>
          <p className="mb-3 font-display text-3xl font-bold">
            Caf<span className="text-accent">8</span>
          </p>
          <p className="max-w-xs text-white/80">{cafe.tagline}</p>
        </div>

        <div {...reveal(inView, 1)}>
          <h3 className="mb-3 font-display text-lg font-bold">Opening hours</h3>
          <ul className="space-y-1 text-white/80">
            {cafe.hours.map((h) => (
              <li key={h.days} className="flex justify-between gap-4">
                <span>{h.days}</span>
                <span>{h.time}</span>
              </li>
            ))}
          </ul>
        </div>

        <div {...reveal(inView, 2)}>
          <h3 className="mb-3 font-display text-lg font-bold">Find us</h3>
          <address className="space-y-1 text-white/80 not-italic">
            <p>{cafe.address}</p>
            <p>
              <a href={`tel:${cafe.phone}`} className={linkClass}>
                {cafe.phone}
              </a>
            </p>
            <p>
              <a href={`mailto:${cafe.email}`} className={linkClass}>
                {cafe.email}
              </a>
            </p>
          </address>
        </div>

        <div {...reveal(inView, 3)}>
          <h3 className="mb-3 font-display text-lg font-bold">Visit</h3>
          <ul className="space-y-1 text-white/80">
            <li><Link to="/menu" className={linkClass}>Order online</Link></li>
            <li><Link to="/reserve" className={linkClass}>Book a table</Link></li>
            <li><Link to="/about" className={linkClass}>About us</Link></li>
            <li><Link to="/contact" className={linkClass}>Contact</Link></li>
          </ul>
        </div>
      </div>

           <div className="border-t border-white/15">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4 text-sm text-white/70">
          <p>
            {new Date().getFullYear()} {cafe.name}
          </p>
          <Link to="/admin" className={linkClass}>
            Owner login
          </Link>
        </div>
      </div>
    </footer>
  );
}