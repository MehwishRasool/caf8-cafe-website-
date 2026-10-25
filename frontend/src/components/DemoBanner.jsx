import { useEffect, useState } from "react";
import { api } from "../data/api";

const KEY = "caf8-demo-notice-closed";

// A small notice on demo sites, so visitors do not type in real details.
// It only appears when the backend says it is running in demo mode.
export default function DemoBanner() {
  const [demo, setDemo] = useState(false);
  const [closed, setClosed] = useState(() => {
    try {
      return sessionStorage.getItem(KEY) === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    let cancelled = false;
    api
      .get("/api/site-info")
      .then((info) => {
        if (!cancelled) setDemo(Boolean(info?.demo));
      })
      .catch(() => {
        /* no notice if the server cannot be reached */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!demo || closed) return null;

  const close = () => {
    setClosed(true);
    try {
      sessionStorage.setItem(KEY, "1");
    } catch {
      /* blocked storage: the notice simply comes back next visit */
    }
  };

  return (
    <div
      role="status"
      className="fixed inset-x-3 bottom-3 z-40 mx-auto flex max-w-xl items-start gap-3 rounded-2xl bg-brand px-4 py-3 text-sm text-white shadow-lg"
    >
      <p className="flex-1">
        <span className="font-bold text-accent">Demo site.</span> Orders and
        payments here are pretend. Please do not enter your real phone number
        or address.
      </p>
      <button
        type="button"
        onClick={close}
        aria-label="Close this notice"
        className="-mr-1 grid h-7 w-7 shrink-0 place-items-center rounded-full text-lg leading-none transition duration-200 hover:bg-white/20"
      >
        ×
      </button>
    </div>
  );
}