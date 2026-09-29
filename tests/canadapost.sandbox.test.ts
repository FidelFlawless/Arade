import { describe, expect, it } from "vitest";
import fs from "node:fs";
import {
  createCanadaPostShipment,
  getCanadaPostRates,
  getShipmentLabelPdf,
  previewShipmentPayload,
} from "@/lib/canadapost";

/**
 * Live Canada Post harness.
 *
 * 1. Diagnostics (always visible when credentials exist in .env.local):
 *      npm test
 *    Prints the resolved config and the exact Create Shipment payload, with
 *    no network access at all.
 *
 * 2. Live rating call (read-only, Canada Post does not charge for rates):
 *      PowerShell:  $env:CANADAPOST_LIVE_TESTS="1"; npm test
 *
 * 3. Live shipment + label download (⚠ may buy a REAL label if the API keys
 *    belong to a [Production] app — the portal says: "Avoid using
 *    [Production] apps, as any orders or shipments submitted through them
 *    will incur actual billing charges"):
 *      PowerShell:  $env:CANADAPOST_LIVE_TESTS="1"; $env:CANADAPOST_LIVE_SHIPMENT="1"; npm test
 */

/** Load .env.local into process.env (never overwrites existing values). */
function loadLocalEnv() {
  if (!fs.existsSync(".env.local")) return;
  for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    if (!line || line.startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i <= 0) continue;
    const key = line.slice(0, i).trim();
    const value = line.slice(i + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadLocalEnv();

const live = process.env.CANADAPOST_LIVE_TESTS === "1";
const liveShipment = live && process.env.CANADAPOST_LIVE_SHIPMENT === "1";

const requiredEnv = [
  "CANADAPOST_API_KEY",
  "CANADAPOST_SECRET_KEY",
  "CANADAPOST_CUSTOMER_NUMBER",
  "CANADAPOST_ORIGIN_POSTAL",
  "CANADAPOST_ORIGIN_ADDRESS",
  "CANADAPOST_ORIGIN_CITY",
];
const missingEnv = requiredEnv.filter((key) => !process.env[key]?.trim());
const hasEnv = missingEnv.length === 0;

/** A parcel that mirrors what the admin route builds for a real order. */
function testShipment() {
  return {
    serviceCode: "DOM.EP",
    destination: {
      name: "Arade Test Recipient",
      addressLine1: "2701 Riverside Drive",
      city: "Ottawa",
      provState: "ON",
      postalCode: "K1A 0B1",
      country: "CA" as const,
    },
    weightKg: 0.75,
    orderId: "TEST-0001",
  };
}

describe("Canada Post configuration diagnostics (offline)", () => {
  it("reports which credentials are configured", () => {
    console.log(
      hasEnv
        ? "CANADAPOST env: complete ✓"
        : `CANADAPOST env: MISSING ${missingEnv.join(", ")}`
    );
    expect(true).toBe(true);
  });

  it.skipIf(!hasEnv)("builds the exact shipment payload without touching the network", () => {
    const preview = previewShipmentPayload(testShipment());
    const parcel = preview.payload.deliverySpec.parcelCharacteristics;

    console.log("--- would POST to ---");
    console.log(preview.url);
    console.log("--- resolved config ---");
    console.log(JSON.stringify(preview.config, null, 2));
    console.log("--- Create Shipment payload ---");
    console.log(JSON.stringify(preview.payload, null, 2));

    // Fix for error 9162: dimensions are always present and positive.
    expect(parcel.dimensions.length).toBeGreaterThan(0);
    expect(parcel.dimensions.width).toBeGreaterThan(0);
    expect(parcel.dimensions.height).toBeGreaterThan(0);

    // Fix for error 1711: a valid method of payment for the account type.
    expect(["CreditCard", "Account"]).toContain(
      preview.payload.deliverySpec.settlementInfo.intendedMethodOfPayment
    );
    if (preview.payload.deliverySpec.settlementInfo.intendedMethodOfPayment === "Account") {
      expect(preview.payload.deliverySpec.settlementInfo.contractId).toBeTruthy();
    }
  });
});

describe.skipIf(!live)("Canada Post live rating call", () => {
  it("returns live rates for a Canadian destination", async () => {
    const rates = await getCanadaPostRates({
      destinationCountry: "CA",
      destinationPostalCode: "K1A 0B1",
      weightKg: 0.75,
    });

    console.log("--- live rates ---");
    console.log(JSON.stringify(rates, null, 2));

    expect(Array.isArray(rates)).toBe(true);
    expect(rates.length).toBeGreaterThan(0);
  });
});

describe.skipIf(!liveShipment)("Canada Post live shipment creation", () => {
  it("creates a shipment and downloads the label PDF", async () => {
    const shipment = await createCanadaPostShipment(testShipment());

    console.log("--- created shipment ---");
    console.log(JSON.stringify(shipment, null, 2));

    expect(shipment.shipmentId).toBeTruthy();
    expect(shipment.trackingPin).toBeTruthy();

    if (shipment.labelUrl) {
      const pdf = await getShipmentLabelPdf(shipment.labelUrl);
      const header = new TextDecoder().decode(new Uint8Array(pdf.slice(0, 5)));
      console.log(`label PDF: ${pdf.byteLength} bytes, starts with "${header}"`);
      expect(pdf.byteLength).toBeGreaterThan(0);
    }
  });
});
