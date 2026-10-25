import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import mongoose from "mongoose";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { rateLimit } from "express-rate-limit";
import { MenuItem, Admin, CATEGORIES } from "./models.js";
import { registerReservationRoutes } from "./reservations.js";
import { registerMessageRoutes } from "./messages.js";
import { registerOrderRoutes } from "./orders.js";
import { apiLimiter, noStore, originCheck } from "./security.js";
import { demoMode } from "./payments.js";

const {
  PORT = 5000,
  MONGODB_URI,
  JWT_SECRET,
  NODE_ENV,
  TRUST_PROXY = "1",
  DEBUG_IP,
} = process.env;
const isProd = NODE_ENV === "production";

if (!MONGODB_URI || !JWT_SECRET || JWT_SECRET.length < 32) {
  console.error(
    "Check your .env file: MONGODB_URI is required, and JWT_SECRET must be at least 32 characters."
  );
  process.exit(1);
}

// How many proxies sit between the visitor and this server (see the README)
const proxyHops = Number(TRUST_PROXY);
if (!Number.isInteger(proxyHops) || proxyHops < 0 || proxyHops > 5) {
  console.error("TRUST_PROXY must be a whole number from 0 to 5.");
  process.exit(1);
}

const app = express();
app.set("trust proxy", proxyHops);

/* ---------- Security headers ---------- */
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        // 'unsafe-inline' is needed for the small style="..." animation delays
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:"],
        connectSrc: ["'self'"],
        // the Google map on the Contact page
        frameSrc: ["https://www.google.com", "https://maps.google.com"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        ...(isProd ? { upgradeInsecureRequests: [] } : {}),
      },
    },
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  })
);
app.use((_req, res, next) => {
  res.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), usb=()"
  );
  next();
});

app.use(express.json({ limit: "10kb" }));
app.use(cookieParser());

/* ---------- Protection for the whole API ---------- */
app.use("/api", noStore); // answers are never saved by browsers or proxies
app.use("/api", apiLimiter);
app.use(["/api/admin", "/api/auth"], originCheck);

/* ---------- Login helpers ---------- */
const COOKIE = "caf8_token";
const EIGHT_HOURS = 8 * 60 * 60 * 1000;

const cookieBase = { httpOnly: true, sameSite: "lax", secure: isProd };

async function requireAdmin(req, res, next) {
  let adminId = null;
  try {
    const payload = jwt.verify(req.cookies[COOKIE], JWT_SECRET, {
      algorithms: ["HS256"],
    });
    // the account must still exist, so removing an admin ends their login
    if (
      mongoose.isValidObjectId(payload.sub) &&
      (await Admin.exists({ _id: payload.sub }))
    ) {
      adminId = payload.sub;
    }
  } catch {
    adminId = null;
  }
  if (!adminId) return res.status(401).json({ error: "Please log in." });
  req.adminId = adminId;
  next();
}

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many attempts. Try again in 15 minutes." },
});

// used so a wrong email takes as long to reject as a wrong password
const dummyHash = bcrypt.hashSync("not-a-real-password", 12);

/* ---------- Auth routes ---------- */
app.post("/api/auth/login", loginLimiter, async (req, res) => {
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  const password = String(req.body?.password ?? "");

  const admin = await Admin.findOne({ email });
  const matches = await bcrypt.compare(
    password,
    admin ? admin.passwordHash : dummyHash
  );

  if (!admin || !matches) {
    return res.status(401).json({ error: "Incorrect email or password." });
  }

  const token = jwt.sign({ sub: admin.id }, JWT_SECRET, {
    algorithm: "HS256",
    expiresIn: "8h",
  });
  res.cookie(COOKIE, token, { ...cookieBase, maxAge: EIGHT_HOURS });
  res.json({ email: admin.email });
});

app.post("/api/auth/logout", (_req, res) => {
  res.clearCookie(COOKIE, cookieBase);
  res.status(204).end();
});

app.get("/api/auth/me", requireAdmin, async (req, res) => {
  const admin = await Admin.findById(req.adminId);
  if (!admin) return res.status(401).json({ error: "Please log in." });
  res.json({ email: admin.email });
});

/* ---------- Menu ---------- */
function parseItem(body = {}) {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const description =
    typeof body.description === "string" ? body.description.trim() : "";
  const { price } = body;

  if (!name || name.length > 80) {
    return { error: "Name is required (80 characters at most)." };
  }
  if (
    typeof price !== "number" ||
    !Number.isFinite(price) ||
    price < 0 ||
    price > 1000000
  ) {
    return { error: "Price must be a number from 0 to 1,000,000." };
  }
  if (!CATEGORIES.includes(body.category)) {
    return { error: "Choose a valid category." };
  }
  if (description.length > 200) {
    return { error: "Description must be 200 characters or fewer." };
  }

  return {
    data: {
      name,
      price,
      category: body.category,
      description,
      hidden: body.hidden === true,
    },
  };
}

// Used by the host to check that the server is alive
app.get("/api/health", (_req, res) => res.json({ ok: true }));

// Tells the website whether this is a demo (it then shows a small notice)
app.get("/api/site-info", (_req, res) =>
  res.json({
    demo: demoMode,
    ownerLogin: demoMode ? (process.env.DEMO_OWNER_LOGIN ?? null) : null,
  })
);

// Switch on DEBUG_IP=true for a moment after deploying, to check TRUST_PROXY
if (DEBUG_IP === "true") {
  app.get("/api/whoami", (req, res) =>
    res.json({ ip: req.ip, forwardedFor: req.headers["x-forwarded-for"] ?? null })
  );
}

// Public: what customers see (hidden items are left out)
app.get("/api/menu", async (_req, res) => {
  res.json(await MenuItem.find({ hidden: false }).sort({ createdAt: 1 }));
});

// Admin only: everything, including hidden items
app.get("/api/admin/menu", requireAdmin, async (_req, res) => {
  res.json(await MenuItem.find().sort({ createdAt: 1 }));
});

app.post("/api/admin/menu", requireAdmin, async (req, res) => {
  const { data, error } = parseItem(req.body);
  if (error) return res.status(400).json({ error });
  res.status(201).json(await MenuItem.create(data));
});

app.put("/api/admin/menu/:id", requireAdmin, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(404).json({ error: "Item not found." });
  }
  const { data, error } = parseItem(req.body);
  if (error) return res.status(400).json({ error });

  const item = await MenuItem.findByIdAndUpdate(req.params.id, data, {
    new: true,
    runValidators: true,
  });
  if (!item) return res.status(404).json({ error: "Item not found." });
  res.json(item);
});

app.delete("/api/admin/menu/:id", requireAdmin, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(404).json({ error: "Item not found." });
  }
  const item = await MenuItem.findByIdAndDelete(req.params.id);
  if (!item) return res.status(404).json({ error: "Item not found." });
  res.status(204).end();
});

/* ---------- Table bookings, messages and orders ---------- */
registerReservationRoutes(app, requireAdmin);
registerMessageRoutes(app, requireAdmin);
registerOrderRoutes(app, requireAdmin);

app.use("/api", (_req, res) => res.status(404).json({ error: "Not found." }));

/* ---------- The website itself (after "npm run build" in the frontend) ---------- */
// On the live site this one server sends both the pages and the API, so they
// share one address and login cookies just work. While you develop, Vite
// serves the pages instead and this part does nothing.
const here = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(here, "../../frontend/dist");
const indexFile = path.join(distDir, "index.html");

if (fs.existsSync(indexFile)) {
  app.use(
    express.static(distDir, {
      index: false,
      setHeaders(res, file) {
        // built files have a fingerprint in their name, so they can be kept for a year
        const fingerprinted = file.includes(`${path.sep}assets${path.sep}`);
        res.setHeader(
          "Cache-Control",
          fingerprinted
            ? "public, max-age=31536000, immutable"
            : "public, max-age=3600"
        );
      },
    })
  );
  // every other address is a page of the website (React shows the right one)
  app.get("/{*splat}", (_req, res) => {
    res.setHeader("Cache-Control", "no-cache");
    res.sendFile(indexFile);
  });
}

/* ---------- Errors ---------- */
app.use((err, _req, res, _next) => {
  const status = err.status && err.status < 500 ? err.status : 500;
  if (status === 500) console.error(err);
  res.status(status).json({
    error:
      status === 500
        ? "Something went wrong. Please try again."
        : "Bad request.",
  });
});

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled problem:", reason);
});

/* ---------- Start ---------- */
let server;
try {
  await mongoose.connect(MONGODB_URI);
  server = app.listen(PORT, () =>
    console.log(
      `API running on port ${PORT}${
        fs.existsSync(indexFile) ? " (also serving the website)" : ""
      }`
    )
  );
} catch (err) {
  console.error("Could not connect to MongoDB:", err.message);
  process.exit(1);
}

// The host stops the server like this on every new deploy
process.on("SIGTERM", () => {
  server.close(async () => {
    await mongoose.disconnect();
    process.exit(0);
  });
});