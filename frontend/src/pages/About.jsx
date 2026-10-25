import { Link } from "react-router-dom";
import { cafe } from "../data/cafe";
import Reveal from "../components/Reveal";
import FindUs from "../components/FindUs";

/* ---- Change the text below to your own story ---- */
const story = [
  "Caf8 began with a simple idea: a warm, relaxed place where good coffee is made carefully and nobody is rushed.",
  "We bake our pastries fresh every morning, cook breakfast to order and pour every cup with attention. Come for a quick coffee on your way to work, or stay for a long breakfast with friends.",
  "Everyone is welcome here, whether you are a regular or this is your first visit.",
];

const values = [
  {
    title: "Fresh every day",
    text: "Pastries are baked each morning and food is cooked to order.",
    color: "bg-accent",
  },
  {
    title: "Made with care",
    text: "Every cup of coffee is made by hand, one at a time.",
    color: "bg-mint",
  },
  {
    title: "Room for everyone",
    text: "A calm corner to work, meet friends or simply sit and enjoy.",
    color: "bg-blush",
  },
];

/* hides a photo that is missing, so no broken-image icon shows */
const hideBroken = (e) => {
  e.currentTarget.style.display = "none";
};

export default function About() {
  return (
    <>
      <section className="bg-brand px-5 py-14 text-white">
        <div className="mx-auto max-w-6xl">
          <h1 className="animate-fade-up font-display text-4xl font-extrabold md:text-5xl">
            About <span className="text-accent">{cafe.name}</span>
          </h1>
          <p className="mt-3 max-w-xl text-white/80">{cafe.tagline}</p>
        </div>
      </section>

      {/* story */}
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-16 md:grid-cols-2">
        <Reveal>
          <h2 className="font-display text-3xl font-extrabold text-brand">
            Our story
          </h2>
          <div className="mt-4 space-y-4 text-lg text-ink">
            {story.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </div>
        </Reveal>

        <Reveal delay={150} className="relative">
          <div className="absolute -bottom-4 -right-4 h-full w-full rounded-2xl bg-accent" />
          <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-mint">
            <img
              src="/images/about.jpg"
              alt={`Inside ${cafe.name}`}
              loading="lazy"
              onError={hideBroken}
              className="h-full w-full object-cover"
            />
          </div>
        </Reveal>
      </section>

      {/* what we care about */}
      <section className="bg-mint px-5 py-16">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <h2 className="font-display text-3xl font-extrabold text-brand">
              What we care about
            </h2>
          </Reveal>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {values.map((v, i) => (
              <Reveal key={v.title} delay={i * 150} className="h-full">
                <div
                  className={`h-full rounded-2xl p-6 transition duration-300 hover:-translate-y-1 ${v.color}`}
                >
                  <h3 className="font-display text-xl font-bold text-brand">
                    {v.title}
                  </h3>
                  <p className="mt-2 text-ink">{v.text}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* find us */}
      <section className="mx-auto max-w-6xl px-5 py-16">
        <Reveal>
          <h2 className="mb-8 font-display text-3xl font-extrabold text-brand">
            Come and visit
          </h2>
        </Reveal>
        <Reveal delay={100}>
          <FindUs />
        </Reveal>

        <Reveal delay={150}>
          <div className="mt-12 flex flex-wrap gap-3">
            <Link
              to="/menu"
              className="rounded-full bg-brand px-7 py-3 font-bold text-white transition duration-300 hover:bg-sage"
            >
              See the menu
            </Link>
            <Link
              to="/reserve"
              className="rounded-full border-2 border-brand px-7 py-3 font-bold text-brand transition duration-300 hover:bg-brand hover:text-white"
            >
              Book a table
            </Link>
          </div>
        </Reveal>
      </section>
    </>
  );
}