/**
 * One-off diagnostic for the checkout "Shipping is temporarily unavailable" error.
 * Calls the same endpoints as src/lib/canadapost.ts and prints HTTP status +
 * response body only. Never prints credentials or tokens.
 */
import fs from "node:fs";

// Load .env.local manually (later lines win, like dotenv).
for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && !(m[1] in process.env === false)) process.env[m[1]] = m[2];
  else if (m) process.env[m[1]] = m[2];
}

const BASE =
  "https://api.canadapost-postescanada.ca/prod/devportal-portaildesdeveloppeurs";
const TOKEN_URL = `${BASE}/cpc-api-native-oauth-provider/oauth2/token`;
const RATES_URL = `${BASE}/rating/v1/prices`;

const clientId = process.env.CANADAPOST_API_KEY?.trim();
const clientSecret = process.env.CANADAPOST_SECRET_KEY?.trim();
if (!clientId || !clientSecret) {
  console.log("MISSING credentials in .env.local");
  process.exit(1);
}
console.log(`Using key ending ...${clientId.slice(-4)} (from .env.local)`);

async function getToken() {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "X-IBM-Client-Id": clientId,
      "X-IBM-Client-Secret": clientSecret,
      accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "scope=merchant&grant_type=client_credentials",
  });
  const text = await res.text();
  console.log(`\nTOKEN  -> HTTP ${res.status}`);
  if (!res.ok) {
    console.log(text.slice(0, 400));
    process.exit(1);
  }
  console.log("token acquired OK");
  return JSON.parse(text).access_token;
}

async function getRates(token, postalCode) {
  const customerNumber = process.env.CANADAPOST_CUSTOMER_NUMBER?.trim();
  const payload = {
    quoteType: customerNumber ? "commercial" : "counter",
    parcelCharacteristics: {
      weight: 0.25,
      dimensions: { length: 30, width: 20, height: 10 },
      unpackaged: false,
    },
    originPostalCode: "L1B0W9",
    destination: { domestic: { postalCode } },
  };
  if (customerNumber) payload.customerNumber = customerNumber;

  const res = await fetch(RATES_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  console.log(`\nRATES ${postalCode} -> HTTP ${res.status}`);
  console.log(text.slice(0, 700));
}

const customerNumber = process.env.CANADAPOST_CUSTOMER_NUMBER?.trim();

// Read-only probe: list recent shipments (does the SHIPPING subscription work?).
async function probeShipping(token) {
  const today = new Date();
  const fmt = (d) => d.toISOString().slice(0, 10).replace(/-/g, "");
  const start = fmt(new Date(today.getTime() - 7 * 86400000));
  const end = fmt(today);
  const res = await fetch(
    `${BASE}/shipping/v1/${customerNumber}/${customerNumber}/shipments?start=${start}&end=${end}`,
    { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } }
  );
  const text = await res.text();
  console.log(`\nSHIPMENT LIST (read-only) -> HTTP ${res.status}`);
  console.log(text.slice(0, 400));
}

// Probe: Tracking 2.0.0 summaries endpoint for a dummy PIN (test apps return stubbed data).
async function probeTracking(token, pin) {
  const res = await fetch(`${BASE}/tracking/v1/pins/${pin}/summaries`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json", "Accept-Language": "en-CA" },
  });
  const text = await res.text();
  console.log(`\nTRACKING ${pin} -> HTTP ${res.status}`);
  console.log(text.slice(0, 1200));
}

const token = await getToken();
await probeTracking(token, "123456789012");
await probeShipping(token);
await getRates(token, "M5V2T6"); // Toronto ON — known-good earlier
await getRates(token, "H3B1A2"); // Montreal QC — failing in checkout now
