import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { cafe } from "../data/cafe";

/* ---------- Scroll reveal (fades a section up when it appears) ---------- */
function Reveal({ children, delay = 0, className = "" }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${
        visible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
      } ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

/* hides a photo that is missing, so no broken-image icon shows */
const hideBroken = (e) => {
  e.currentTarget.style.display = "none";
};

/* ---------- Page content: edit the text and photos here ---------- */
const strip = [
  {
    word: "Eat",
    text: "Cooked breakfasts and light lunches, made fresh each morning.",
    color: "bg-accent text-ink",
  },
  {
    word: "Drink",
    text: "Coffee from espresso to flat white, plus cold drinks.",
    color: "bg-blush text-ink",
  },
  {
    word: "Enjoy",
    text: "Take a seat and stay a while, or take it to go.",
    color: "bg-brand text-white",
  },
];

// Put these photos in public/images and update the alt text
const photos = [
  { src: "/images/gallery-1.jpg", alt: "Coffee being poured", offset: "", block: "bg-accent" },
  { src: "/images/gallery-2.jpg", alt: "Fresh pastries on the counter", offset: "md:mt-12", block: "bg-blush" },
  { src: "/images/gallery-3.jpg", alt: "Breakfast plate on a table", offset: "", block: "bg-sage" },
];

const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
  cafe.address
)}`;

/* ---------- The page ---------- */
export default function Home() {
  // flips to true right after the page loads, which starts the hero animation
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setLoaded(true), 50);
    return () => clearTimeout(t);
  }, []);

  return (
    <>
      {/* Hero */}
      <section className="relative flex min-h-svh items-center justify-center overflow-hidden bg-linear-to-br from-brand to-ink text-center text-white">
        {/* photo (optional until you add hero.jpg) */}
        <img
          src="/images/hero.jpg"
          alt="Inside Caf8"
          onError={hideBroken}
          className={`absolute inset-0 h-full w-full object-cover transition-transform duration-[14000ms] ease-out ${
            loaded ? "scale-100" : "scale-110"
          }`}
        />
        <div className="absolute inset-0 bg-brand/60" />

        {/* decorative shapes */}
        <div className="absolute -left-24 top-1/3 h-72 w-72 animate-pulse rounded-full bg-accent/30 blur-3xl" />
        <div className="absolute -right-20 bottom-10 h-80 w-80 animate-pulse rounded-full bg-sage/40 blur-3xl" />
        <div className="absolute right-[8%] top-28 h-40 w-40 animate-slow-spin rounded-full border-2 border-dashed border-white/30 md:h-64 md:w-64" />
        <div className="absolute bottom-16 left-[6%] h-20 w-20 rounded-full bg-sage md:h-28 md:w-28" />

        <div className="relative z-10 mx-auto max-w-3xl px-5">
          <h1
            className={`font-display text-5xl font-extrabold leading-tight transition-all duration-1000 ease-out md:text-7xl ${
              loaded ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
            }`}
            style={{ transitionDelay: "200ms" }}
          >
            {cafe.tagline}
          </h1>

          <div
            className={`mt-10 flex flex-wrap justify-center gap-4 transition-all duration-1000 ease-out ${
              loaded ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
            }`}
            style={{ transitionDelay: "600ms" }}
          >
            <Link
              to="/menu"
              className="rounded-full bg-accent px-8 py-3 font-bold text-brand transition duration-300 hover:-translate-y-1 hover:bg-white"
            >
              Order now
            </Link>
            <Link
              to="/reserve"
              className="rounded-full border-2 border-white px-8 py-3 font-bold transition duration-300 hover:-translate-y-1 hover:bg-white hover:text-brand"
            >
              Book a table
            </Link>
          </div>
        </div>
      </section>

      {/* Opening hours */}
      <section className="bg-mint">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-20 md:grid-cols-2 md:items-center">
          <Reveal>
            <h2 className="font-display text-4xl font-extrabold text-brand md:text-5xl">
              Opening hours
            </h2>
            <p className="mt-4 max-w-md text-muted">
              Walk in whenever we are open, or book a table ahead.
            </p>
            <span className="mt-6 inline-block -rotate-6 rounded-full bg-accent px-5 py-2 font-display font-bold text-brand">
              Fresh every day
            </span>
          </Reveal>

          <Reveal delay={150}>
            <ul className="space-y-3">
              {cafe.hours.map((h) => (
                <li
                  key={h.days}
                  className="flex items-center justify-between rounded-xl bg-card px-5 py-4 text-lg shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-md"
                >
                  <span className="font-bold text-brand">{h.days}</span>
                  <span className="text-muted">{h.time}</span>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>

      {/* Eat, Drink, Enjoy */}
      <section className="grid md:grid-cols-3">
        {strip.map((s, i) => (
          <Reveal key={s.word} delay={i * 150} className="h-full">
            <div className={`group h-full px-8 py-16 text-center ${s.color}`}>
              <h3 className="inline-block font-display text-6xl font-extrabold transition-transform duration-300 group-hover:scale-110">
                {s.word}
              </h3>
              <p className="mx-auto mt-3 max-w-xs opacity-80">{s.text}</p>
            </div>
          </Reveal>
        ))}
      </section>

      {/* Photos */}
      <section className="mx-auto max-w-6xl px-5 py-20">
        <div className="grid gap-8 md:grid-cols-3">
          {photos.map((p, i) => (
            <Reveal key={p.src} delay={i * 150} className={p.offset}>
              <div className="relative">
                <div
                  className={`absolute inset-0 translate-x-3 translate-y-3 rounded-lg ${p.block}`}
                />
                <div className="relative aspect-[4/5] overflow-hidden rounded-lg bg-mint">
                  <img
                    src={p.src}
                    alt={p.alt}
                    onError={hideBroken}
                    className="h-full w-full object-cover transition-transform duration-700 hover:scale-105"
                  />
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Address */}
      <section className="bg-blush">
        <div className="mx-auto grid max-w-6xl gap-8 px-5 py-20 md:grid-cols-2 md:items-center">
          <Reveal>
            <h2 className="font-display text-4xl font-extrabold text-brand md:text-5xl">
              Find us
            </h2>
            <address className="mt-4 space-y-1 text-lg text-ink not-italic">
              <p>{cafe.address}</p>
              <p>{cafe.phone}</p>
            </address>
          </Reveal>

          <Reveal delay={150} className="md:text-right">
            <a
              href={mapsUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-block rounded-full bg-brand px-8 py-3 font-bold text-white transition duration-300 hover:-translate-y-1 hover:bg-accent hover:text-brand"
            >
              Get directions
            </a>
          </Reveal>
        </div>
      </section>
    </>
  );
}