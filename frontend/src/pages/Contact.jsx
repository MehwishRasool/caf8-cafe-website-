import { useState } from "react";
import { api } from "../data/api";
import { cafe } from "../data/cafe";
import Reveal from "../components/Reveal";
import FindUs from "../components/FindUs";

const inputClass =
  "w-full rounded-lg border border-line bg-card px-3 py-2 text-ink placeholder:text-muted";

const empty = { name: "", email: "", message: "", website: "" };

export default function Contact() {
  const [form, setForm] = useState(empty);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const setField = (field) => (e) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError("");

    const name = form.name.trim();
    const email = form.email.trim();
    const message = form.message.trim();
    if (name.length < 2) return setError("Enter your name.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return setError("Enter a valid email address.");
    }
    if (message.length < 5) return setError("Write your message.");

    setBusy(true);
    try {
      await api.post("/api/messages", {
        name,
        email,
        message,
        website: form.website,
      });
      setForm(empty);
      setSent(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <section className="bg-brand px-5 py-14 text-white">
        <div className="mx-auto max-w-6xl">
          <h1 className="animate-fade-up font-display text-4xl font-extrabold md:text-5xl">
            Get in <span className="text-accent">touch</span>
          </h1>
          <p className="mt-3 max-w-xl text-white/80">
            Questions, feedback or a big group booking? Send us a message or
            call {cafe.phone}.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-16">
        <Reveal>
          <div className="mx-auto max-w-2xl">
            {sent ? (
              <div className="animate-fade-up rounded-2xl bg-card p-8 shadow-sm">
                <h2 className="font-display text-3xl font-extrabold text-brand">
                  Message sent
                </h2>
                <p className="mt-3 text-ink">
                  Thank you for writing to us. We will reply to your email as
                  soon as we can.
                </p>
                <button
                  type="button"
                  onClick={() => setSent(false)}
                  className="mt-6 rounded-full border-2 border-brand px-6 py-2 font-bold text-brand transition duration-300 hover:bg-brand hover:text-white"
                >
                  Send another message
                </button>
              </div>
            ) : (
              <form
                onSubmit={submit}
                noValidate
                className="space-y-4 rounded-2xl bg-card p-8 shadow-sm"
              >
                <h2 className="font-display text-2xl font-bold text-brand">
                  Send us a message
                </h2>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="c-name" className="mb-1 block font-medium">
                      Name
                    </label>
                    <input
                      id="c-name"
                      value={form.name}
                      onChange={setField("name")}
                      autoComplete="name"
                      maxLength={80}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label htmlFor="c-email" className="mb-1 block font-medium">
                      Email
                    </label>
                    <input
                      id="c-email"
                      type="email"
                      value={form.email}
                      onChange={setField("email")}
                      autoComplete="email"
                      maxLength={120}
                      className={inputClass}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="c-message" className="mb-1 block font-medium">
                    Message
                  </label>
                  <textarea
                    id="c-message"
                    rows={5}
                    value={form.message}
                    onChange={setField("message")}
                    maxLength={2000}
                    className={inputClass}
                  />
                </div>

                {/* Hidden from people. Spam bots fill it in and are ignored. */}
                <div className="absolute -left-[9999px]" aria-hidden="true">
                  <label htmlFor="c-website">Leave this field empty</label>
                  <input
                    id="c-website"
                    tabIndex={-1}
                    autoComplete="off"
                    value={form.website}
                    onChange={setField("website")}
                  />
                </div>

                {error && (
                  <p role="alert" className="font-medium text-red-800">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-full bg-brand px-8 py-3 font-bold text-white transition duration-300 hover:bg-sage disabled:opacity-60"
                >
                  {busy ? "Sending..." : "Send message"}
                </button>
              </form>
            )}
          </div>
        </Reveal>

        <div className="mt-16">
          <Reveal>
            <h2 className="mb-8 font-display text-3xl font-extrabold text-brand">
              Find us
            </h2>
          </Reveal>
          <Reveal delay={100}>
            <FindUs />
          </Reveal>
        </div>
      </section>
    </>
  );
}