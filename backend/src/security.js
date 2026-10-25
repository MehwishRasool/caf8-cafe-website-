import { rateLimit } from "express-rate-limit";

/* ---------- Your website's address (set in .env) ---------- */
const { SITE_URL, NODE_ENV } = process.env;

if (!SITE_URL) {
  console.error(
    "Add SITE_URL to your .env file, for example SITE_URL=http://localhost:5173"
  );
  process.exit(1);
}

let siteUrl;
try {
  siteUrl = new URL(SITE_URL);
} catch {
  console.error(`SITE_URL "${SITE_URL}" is not a valid address.`);
  process.exit(1);
}

// A live site must use https, otherwise logins and orders travel in the open
if (NODE_ENV === "production" && siteUrl.protocol !== "https:") {
  console.error(
    `SITE_URL must start with https:// when NODE_ENV is production (it is "${SITE_URL}").`
  );
  process.exit(1);
}

export const SITE_ORIGIN = siteUrl.origin;

/* ---------- Only your own website may change things ---------- */
// A browser always says which website a request came from. If it is not yours,
// the request is refused. This stops other websites from tricking a logged-in
// owner's browser into deleting menu items, cancelling orders and so on.
export function originCheck(req, res, next) {
  const safe = ["GET", "HEAD", "OPTIONS"].includes(req.method);
  if (safe) return next();

  const origin = req.headers.origin;
  const fetchSite = req.headers["sec-fetch-site"];
  if ((origin && origin !== SITE_ORIGIN) || fetchSite === "cross-site") {
    return res.status(403).json({ error: "This request is not allowed." });
  }
  next();
}

/* ---------- Answers from the API are never saved by the browser or a proxy ---------- */
export function noStore(_req, res, next) {
  res.set("Cache-Control", "no-store");
  next();
}

/* ---------- A limit on how often anyone can call the API ---------- */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 600,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many requests. Please slow down." },
});