/**
 * READ-ONLY DIAGNOSTIC PROBE — credential binding test.
 *
 * Answers: is our Test app's API key tied to customer 0001221118, or does the
 * sandbox let a [Test] app act as a designated test customer?
 *
 * Method (Get Rates only — pricing inquiry, never creates or bills anything):
 *   1. Rates with mailedBy = mobo = 0001221118   -> expected 200 (bound)
 *   2. Rates with mailedBy = mobo = 2004381      -> expected failure (not bound)
 *   3. Rates with mailedBy = mobo = 0007020811   -> expected failure (not bound)
 *
 * 2004381 is the legacy sandbox test customer from the old soa-gw developer
 * program docs; 0007020811 is the merchant sample number in the new portal's
 * own documentation. Prints statuses only. Never prints secrets.
 *
 * Run: node scripts/probe-binding.mjs
 */
import fs from "node:fs";

for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) process.env[m[1]] = m[2];
}

const BASE =
  "https://api.canadapost-postescanada.ca/prod/devportal-portaildesdeveloppeurs";
const TOKEN_URL = `${BASE}/cpc-api-native-oauth-provider/oauth2/token`;
const RATES_URL = `${BASE}/rating/v1/prices`;

const clientId = process.env.CANADAPOST_API_KEY?.trim();
const clientSecret = process.env.CANADAPOST_SECRET_KEY?.trim();
const customerNumber = process.env.CANADAPOST_CUSTOMER_NUMBER?.trim();

if (!clientId || !clientSecret || !customerNumber) {
  console.log("MISSING CANADAPOST_API_KEY / SECRET_KEY / CUSTOMER_NUMBER in .env.local");
  process.exit(1);
}
console.log(`Test key ending ...${clientId.slice(-4)}; app customer number ${customerNumber}\n`);

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
if (!res.ok) {
  console.log(`TOKEN -> HTTP ${res.status}`);
  console.log((await res.text()).slice(0, 300));
  process.exit(1);
}
const { access_token: token } = await res.json();

const payload = {
  customerNumber,
  quoteType: "commercial",
  parcelCharacteristics: {
    weight: 0.5,
    dimensions: { length: 30, width: 20, height: 10 },
    unpackaged: false,
  },
  originPostalCode: "M5V2T6",
  destination: { domestic: { postalCode: "M5V2T6" } },
};

async function rates(label, mailedBy) {
  const r = await fetch(RATES_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ ...payload, customerNumber: mailedBy }),
  });
  const text = (await r.text()) || "";
  const codes = [...text.matchAll(/"code"\s*:\s*"?(\d+)"?/g)].map((m) => m[1]);
  console.log(`${label}  ->  HTTP ${r.status}${codes.length ? ` codes ${codes.join(",")}` : ""}${r.ok ? " (rates returned)" : ""}`);
  if (!r.ok) console.log(`   ${text.replace(/\s+/g, " ").slice(0, 200)}`);
}

await rates("[1] mailedBy=mobo=0001221118 (our customer)  ", customerNumber);
await rates("[2] mailedBy=mobo=2004381 (legacy test cust)   ", "2004381");
await rates("[3] mailedBy=mobo=0007020811 (portal sample)   ", "0007020811");
console.log("\nDone. A 200 on [1] with auth failures on [2]/[3] proves the Test key");
console.log("is bound to 0001221118 — there is no shared/dedicated test customer in");
console.log("the new portal sandbox that this key could act as.");
