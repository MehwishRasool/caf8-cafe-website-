import crypto from "node:crypto";
import { PAYMENT_AMOUNT_MULTIPLIER } from "./config.js";
import { SITE_ORIGIN } from "./security.js";

/* All online payment code lives in this one file:
   - demo mode: a fake payment page on your own site, no real money
   - Safepay: the real thing, used when demo mode is off and keys are set */

const {
  SAFEPAY_API_KEY,
  SAFEPAY_V1_SECRET,
  SAFEPAY_WEBHOOK_SECRET,
  SAFEPAY_ENV = "sandbox",
  DEMO_PAYMENTS,
  NODE_ENV,
} = process.env;

const isProduction = NODE_ENV === "production";

// DEMO_PAYMENTS=true   -> fake payments, on your own computer only
// DEMO_PAYMENTS=public -> fake payments on a live portfolio demo site too
// Fake payments let anyone mark their own order as paid, so they must never be
// on for a real shop. "true" is ignored in production on purpose.
export const demoMode =
  DEMO_PAYMENTS === "public" || (DEMO_PAYMENTS === "true" && !isProduction);

if (DEMO_PAYMENTS === "true" && isProduction) {
  console.warn(
    'DEMO_PAYMENTS=true is ignored in production. For a public demo site use DEMO_PAYMENTS=public.'
  );
}
if (demoMode) {
  console.warn(
    `DEMO PAYMENTS ARE ON${DEMO_PAYMENTS === "public" ? " (public demo site)" : ""}: online payments are fake. Never use this for a real shop.`
  );
}

const hasSafepayKeys = Boolean(SAFEPAY_API_KEY && SAFEPAY_V1_SECRET);

// Online payment is switched on in demo mode, or when the Safepay keys are in .env
export const onlineEnabled = demoMode || hasSafepayKeys;

let client = null;

async function getClient() {
  if (client) return client;
  // loaded only when needed, so the site runs even without the package
  const mod = await import("@sfpy/node-sdk");
  const Safepay = mod.Safepay ?? mod.default?.Safepay;
  client = new Safepay({
    environment: SAFEPAY_ENV,
    apiKey: SAFEPAY_API_KEY,
    v1Secret: SAFEPAY_V1_SECRET,
    webhookSecret: SAFEPAY_WEBHOOK_SECRET ?? "not-used-yet",
  });
  return client;
}

// Starts a payment and gives back { token, url }.
// The customer is sent to url to pay.
export async function createCheckout({
  amount,
  reference,
  publicId,
  cancelUrl,
  redirectUrl,
}) {
  // demo: our own fake payment page
  if (demoMode) {
    return {
      token: `demo_${crypto.randomBytes(8).toString("hex")}`,
      url: `${SITE_ORIGIN}/demo-pay/${publicId}`,
    };
  }

  const safepay = await getClient();

  const payment = await safepay.payments.create({
    amount: amount * PAYMENT_AMOUNT_MULTIPLIER,
    currency: "PKR",
  });
  const token = typeof payment === "string" ? payment : payment?.token;
  if (!token) throw new Error("Safepay did not return a payment token.");

  const checkout = await safepay.checkout.create({
    token,
    orderId: reference,
    cancelUrl,
    redirectUrl,
    source: "custom",
    webhooks: false,
  });
  const url = typeof checkout === "string" ? checkout : checkout?.url;
  if (typeof url !== "string" || !url.startsWith("https://")) {
    throw new Error("Safepay did not return a checkout address.");
  }

  return { token, url };
}

// Is the page the customer came back with really from Safepay?
export async function verifyReturn(req) {
  if (demoMode) return false; // demo payments never come back through Safepay
  const safepay = await getClient();
  return Boolean(await safepay.verify.signature(req));
}