/**
 * DIAGNOSTIC PROBE (Test app only — nothing is ever billed on a [Test] app).
 *
 * Question: does Create Shipment with transmitShipment=false (group/manifest
 * mode, billing deferred to a Transmit Shipments call that we will NOT make)
 * avoid error 9174 "requires a default payment card"?
 *
 * - Same endpoint, auth and settlement (CreditCard) as the production code path.
 * - Only differences vs src/lib/canadapost.ts: transmitShipment:false + groupId
 *   (the docs require a group-id when transmit-shipment is not provided).
 * - Prints HTTP status + response body only. Never prints secrets.
 *
 * Run: node scripts/probe-transmit-false.mjs
 */
import fs from "node:fs";

// Load .env.local manually (later lines win, like dotenv).
for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) process.env[m[1]] = m[2];
}

const BASE =
  "https://api.canadapost-postescanada.ca/prod/devportal-portaildesdeveloppeurs";
const TOKEN_URL = `${BASE}/cpc-api-native-oauth-provider/oauth2/token`;
const SHIPPING_URL = `${BASE}/shipping/v1`;

const clientId = process.env.CANADAPOST_API_KEY?.trim();
const clientSecret = process.env.CANADAPOST_SECRET_KEY?.trim();
const customerNumber = process.env.CANADAPOST_CUSTOMER_NUMBER?.trim();

if (!clientId || !clientSecret || !customerNumber) {
  console.log("MISSING CANADAPOST_API_KEY / SECRET_KEY / CUSTOMER_NUMBER in .env.local");
  process.exit(1);
}
console.log(`Test key ending ...${clientId.slice(-4)}, customer ${customerNumber}`);

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
  console.log(`\nTOKEN -> HTTP ${res.status}`);
  if (!res.ok) {
    console.log(text.slice(0, 300));
    process.exit(1);
  }
  return JSON.parse(text).access_token;
}

// Mirrors buildShipmentPayload() from src/lib/canadapost.ts for the pending
// E2E test order ARD-MULMNE4P-HQ52 (Quebec QC H3B 1A2, Regular Parcel).
function buildProbePayload() {
  const originPostal = process.env.CANADAPOST_ORIGIN_POSTAL?.replace(/\s+/g, "").toUpperCase();
  const originName = process.env.CANADAPOST_ORIGIN_NAME?.trim() || "Arade";
  const originPhone = process.env.CANADAPOST_ORIGIN_PHONE?.trim() || "000-000-0000";
  const originAddress = process.env.CANADAPOST_ORIGIN_ADDRESS?.trim();
  const originCity = process.env.CANADAPOST_ORIGIN_CITY?.trim();
  const originProv = process.env.CANADAPOST_ORIGIN_PROVINCE?.trim() || "ON";

  if (!originPostal || !originAddress || !originCity) {
    console.log("MISSING CANADAPOST_ORIGIN_* env vars");
    process.exit(1);
  }

  return {
    // THE PROBE: no immediate transmit/charge — group/manifest mode instead.
    // group-id is required when transmit-shipment is absent (docs).
    groupId: `P${Date.now().toString(36).toUpperCase()}`.slice(0, 12),
    requestedShippingPoint: originPostal,
    deliverySpec: {
      serviceCode: "DOM.RP",
      sender: {
        name: originName,
        company: originName,
        contactPhone: originPhone,
        addressDetails: {
          addressLine1: originAddress,
          city: originCity,
          provState: originProv,
          countryCode: "CA",
          postalZipCode: originPostal,
        },
      },
      destination: {
        name: "E2E Test Recipient",
        addressDetails: {
          addressLine1: "380 Rue Saint-Antoine O",
          city: "Montreal",
          provState: "QC",
          countryCode: "CA",
          postalZipCode: "H3B1A2",
        },
      },
      parcelCharacteristics: {
        weight: 0.5,
        dimensions: { length: 30, width: 20, height: 10 },
        unpackaged: false,
      },
      preferences: {
        showPackingInstructions: false,
        showPostageRate: true,
        showInsuredValue: true,
      },
      settlementInfo: {
        paidByCustomer: customerNumber,
        intendedMethodOfPayment: "CreditCard",
      },
      references: { customerRef1: "ARD-MULMNE4P-HQ52-probe" },
    },
  };
}

const token = await getToken();
const payload = buildProbePayload();

console.log("\nCREATE SHIPMENT (transmitShipment omitted = false, group mode) ...");
const res = await fetch(`${SHIPPING_URL}/${customerNumber}/${customerNumber}/shipments`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  },
  body: JSON.stringify(payload),
});
const text = await res.text();
console.log(`HTTP ${res.status}`);
console.log(text.slice(0, 1500) || "(empty body)");

if (res.ok) {
  const data = JSON.parse(text);
  const label = data.links?.find((l) => l.rel === "label" || l.rel === "artifact")?.href;
  console.log("\n>>> RESULT: ACCEPTED without a default card.");
  console.log(`shipment-id: ${data.shipmentId} | PIN: ${data.trackingPin}`);
  if (label) console.log(`label link: ${label}`);
  console.log(">>> We are NOT transmitting/billing this shipment (probe only).");
  console.log(">>> NOTE: probe shipments may linger in the Test app's shipment list.");
} else if (text.includes("9174")) {
  console.log("\n>>> RESULT: 9174 again — card required even in group/manifest mode.");
  console.log(">>> Conclusion: the client's real default Visa/MC/Amex is unavoidable for label creation.");
} else {
  console.log("\n>>> RESULT: different error — copy this output back to me for analysis.");
}
