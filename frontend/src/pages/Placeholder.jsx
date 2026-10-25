import { Link } from "react-router-dom";
import { cafe } from "../data/cafe";

export default function Placeholder({ title, text }) {
  return (
    <section className="mx-auto flex min-h-[60vh] max-w-3xl flex-col items-center justify-center px-5 py-24 text-center">
      <h1 className="font-display text-5xl font-extrabold text-brand md:text-6xl">
        {title}
      </h1>
      <p className="mt-4 max-w-md text-lg text-muted">{text}</p>
      <p className="mt-2 text-muted">
        Questions? Call{" "}
        <a
          href={`tel:${cafe.phone}`}
          className="font-bold text-brand underline"
        >
          {cafe.phone}
        </a>
        .
      </p>
      <Link
        to="/"
        className="mt-8 rounded-full bg-brand px-8 py-3 font-bold text-white transition duration-300 hover:-translate-y-1 hover:bg-accent hover:text-brand"
      >
        Back to home
      </Link>
    </section>
  );
}