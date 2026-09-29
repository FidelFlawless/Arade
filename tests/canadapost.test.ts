import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Regression tests for the two Canada Post validation failures seen in the
 * admin "Create Canada Post Shipment" action:
 *   1711 - Please select a different Method of Payment.
 *   9162 - Length, Height and Width are mandatory when the document flag is false.
 */

const CUSTOMER_NUMBER = "0007023211";
const PORTAL_BASE = "https://api.canadapost-postescanada.ca/prod/devportal-portaildesdeveloppeurs";
const SHIPMENTS_URL = `${PORTAL_BASE}/shipping/v1/${CUSTOMER_NUMBER}/${CUSTOMER_NUMBER}/shipments`;
const RATES_URL = `${PORTAL_BASE}/rating/v1/prices`;

interface CapturedRequest {
  url: string;
  method?: string;
  headers: Record<string, string>;
  body: unknown;
}

let captured: CapturedRequest[] = [];

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Mock transport: answers the OAuth token call, the shipment call, and any
 * other endpoint the module might hit during a test.
 */
function stubFetch(handlers: {
  shipment?: () => Response;
  rates?: () => Response;
  tracking?: () => Response;
}) {
  const mock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const rawBody = typeof init?.body === "string" ? init.body : undefined;
    captured.push({
      url,
      method: init?.method,
      headers: (init?.headers as Record<string, string>) ?? {},
      // The OAuth call sends form-encoded data; everything else is JSON.
      body:
        rawBody && /^[[{]/.test(rawBody.trim())
          ? JSON.parse(rawBody)
          : rawBody,
    });

    if (url.includes("/oauth2/token")) {
      return jsonResponse({ access_token: "test-token", expires_in: 3600 });
    }
    // Match by suffix so tests can exercise CANADAPOST_API_BASE_URL overrides.
    if (url.endsWith("/shipments") && handlers.shipment) return handlers.shipment();
    if (url.endsWith("/prices") && handlers.rates) return handlers.rates();
    if (url.includes("/tracking/v1/pins/") && handlers.tracking) return handlers.tracking();
    throw new Error(`Unexpected fetch to ${url}`);
  });

  vi.stubGlobal("fetch", mock);
  return mock;
}

function shipmentRequest() {
  return {
    serviceCode: "DOM.EP",
    destination: {
      name: "Jane Doe",
      addressLine1: "456 Recipient Ave",
      city: "Laval",
      provState: "QC",
      postalCode: "H7T 1A1",
      country: "CA" as const,
    },
    weightKg: 1.25,
    orderId: "ARADE-1001",
  };
}

async function loadModule() {
  vi.resetModules();
  return import("@/lib/canadapost");
}

beforeEach(() => {
  captured = [];
  process.env.CANADAPOST_API_KEY = "test-client-id";
  process.env.CANADAPOST_SECRET_KEY = "test-client-secret";
  process.env.CANADAPOST_CUSTOMER_NUMBER = CUSTOMER_NUMBER;
  process.env.CANADAPOST_ORIGIN_POSTAL = "M5V 3L9";
  process.env.CANADAPOST_ORIGIN_ADDRESS = "123 Sender Street";
  process.env.CANADAPOST_ORIGIN_CITY = "Toronto";
  process.env.CANADAPOST_ORIGIN_PROVINCE = "ON";
  delete process.env.CANADAPOST_CONTRACT_ID;
  delete process.env.CANADAPOST_CONTRACT_NUMBER;
  delete process.env.CANADAPOST_PAYMENT_METHOD;
  delete process.env.CANADAPOST_DEFAULT_LENGTH_CM;
  delete process.env.CANADAPOST_DEFAULT_WIDTH_CM;
  delete process.env.CANADAPOST_DEFAULT_HEIGHT_CM;
  delete process.env.CANADAPOST_API_BASE_URL;
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Canada Post shipment payload", () => {
  it("sends dimensions for every parcel so error 9162 cannot occur", async () => {
    stubFetch({ shipment: () => jsonResponse({ shipmentId: "123", trackingPin: "4567890123456789" }) });
    const { createCanadaPostShipment } = await loadModule();

    await createCanadaPostShipment(shipmentRequest());

    const body = captured[1].body as {
      deliverySpec: {
        parcelCharacteristics: {
          weight: number;
          unpackaged: boolean;
          dimensions?: { length: number; width: number; height: number };
        };
      };
    };
    const parcel = body.deliverySpec.parcelCharacteristics;

    expect(parcel.dimensions).toEqual({ length: 30, width: 20, height: 10 });
    expect(parcel.dimensions?.length).toBeGreaterThan(0);
    expect(parcel.dimensions?.width).toBeGreaterThan(0);
    expect(parcel.dimensions?.height).toBeGreaterThan(0);
    expect(parcel.unpackaged).toBe(false);
    expect(parcel.weight).toBe(1.25);
  });

  it("honours env-configured box size and per-request dimensions", async () => {
    process.env.CANADAPOST_DEFAULT_LENGTH_CM = "45";
    process.env.CANADAPOST_DEFAULT_WIDTH_CM = "35";
    process.env.CANADAPOST_DEFAULT_HEIGHT_CM = "25";
    stubFetch({ shipment: () => jsonResponse({ shipmentId: "123", trackingPin: "4567890123456789" }) });
    const { createCanadaPostShipment } = await loadModule();

    await createCanadaPostShipment(shipmentRequest());
    await createCanadaPostShipment({
      ...shipmentRequest(),
      dimensions: { lengthCm: 12, widthCm: 8, heightCm: 4 },
    });

    const fromEnv = captured[1].body as {
      deliverySpec: { parcelCharacteristics: { dimensions: Record<string, number> } };
    };
    const explicit = captured[captured.length - 1].body as {
      deliverySpec: { parcelCharacteristics: { dimensions: Record<string, number> } };
    };

    expect(fromEnv.deliverySpec.parcelCharacteristics.dimensions).toEqual({
      length: 45,
      width: 35,
      height: 25,
    });
    expect(explicit.deliverySpec.parcelCharacteristics.dimensions).toEqual({
      length: 12,
      width: 8,
      height: 4,
    });
  });

  it("settles Small Business accounts by CreditCard (no contract number)", async () => {
    stubFetch({ shipment: () => jsonResponse({ shipmentId: "123", trackingPin: "4567890123456789" }) });
    const { createCanadaPostShipment } = await loadModule();

    await createCanadaPostShipment(shipmentRequest());

    const body = captured[1].body as { deliverySpec: { settlementInfo: Record<string, string> } };

    expect(body.deliverySpec.settlementInfo).toEqual({
      paidByCustomer: CUSTOMER_NUMBER,
      intendedMethodOfPayment: "CreditCard",
    });
  });

  it("settles contract accounts by Account with the contract number", async () => {
    process.env.CANADAPOST_CONTRACT_ID = "1234567";
    stubFetch({ shipment: () => jsonResponse({ shipmentId: "123", trackingPin: "4567890123456789" }) });
    const { createCanadaPostShipment } = await loadModule();

    await createCanadaPostShipment(shipmentRequest());

    const body = captured[1].body as { deliverySpec: { settlementInfo: Record<string, string> } };

    expect(body.deliverySpec.settlementInfo).toEqual({
      paidByCustomer: CUSTOMER_NUMBER,
      intendedMethodOfPayment: "Account",
      contractId: "1234567",
    });
  });

  it("rejects Account settlement without a contract number before calling the API", async () => {
    process.env.CANADAPOST_PAYMENT_METHOD = "Account";
    stubFetch({ shipment: () => jsonResponse({}) });
    const { createCanadaPostShipment, CanadaPostError } = await loadModule();

    await expect(createCanadaPostShipment(shipmentRequest())).rejects.toBeInstanceOf(CanadaPostError);
    expect(captured).toHaveLength(0);
  });
  it("accepts the legacy CANADAPOST_CONTRACT_NUMBER name for the contract id", async () => {
    process.env.CANADAPOST_CONTRACT_NUMBER = "7654321";
    stubFetch({ shipment: () => jsonResponse({ shipmentId: "123", trackingPin: "4567890123456789" }) });
    const { createCanadaPostShipment } = await loadModule();

    await createCanadaPostShipment(shipmentRequest());

    const body = captured[1].body as { deliverySpec: { settlementInfo: Record<string, string> } };

    expect(body.deliverySpec.settlementInfo).toEqual({
      paidByCustomer: CUSTOMER_NUMBER,
      intendedMethodOfPayment: "Account",
      contractId: "7654321",
    });
  });

  it("previews the exact payload without calling Canada Post", async () => {
    const { previewShipmentPayload } = await loadModule();

    const preview = previewShipmentPayload(shipmentRequest());

    expect(captured).toHaveLength(0); // no network at all
    expect(preview.url).toBe(SHIPMENTS_URL);
    expect(preview.config.paymentMethod).toBe("CreditCard");
    expect(preview.config.contractId).toBeNull();
    expect(preview.config.dimensionsCm).toEqual({ length: 30, width: 20, height: 10 });
    expect(preview.config.sandboxDeclared).toBe(false);
    expect(preview.payload.deliverySpec.parcelCharacteristics.dimensions).toEqual({
      length: 30,
      width: 20,
      height: 10,
    });
  });
});

describe("Canada Post shipment transport & errors", () => {
  it("posts JSON with the exact accepted headers and records the order reference", async () => {
    stubFetch({ shipment: () => jsonResponse({ shipmentId: "123", trackingPin: "4567890123456789" }) });
    const { createCanadaPostShipment } = await loadModule();

    const result = await createCanadaPostShipment(shipmentRequest());

    const shipmentCall = captured[1];
    expect(shipmentCall.url).toBe(SHIPMENTS_URL);
    expect(shipmentCall.method).toBe("POST");
    expect(shipmentCall.headers["Content-Type"]).toBe("application/json");
    expect(shipmentCall.headers["Accept"]).toBe("application/json");
    expect(shipmentCall.headers.Authorization).toBe("Bearer test-token");
    expect((shipmentCall.body as { deliverySpec: { references: Record<string, string> } }).deliverySpec.references).toEqual({
      customerRef1: "ARADE-1001",
    });
    expect(result).toEqual({
      shipmentId: "123",
      trackingPin: "4567890123456789",
      labelUrl: null,
    });
  });

  it("routes every call through CANADAPOST_API_BASE_URL when a host override is set", async () => {
    process.env.CANADAPOST_API_BASE_URL = "https://api-stg.canadapost-postescanada.ca/prod/devportal-portaildesdeveloppeurs/";
    stubFetch({ shipment: () => jsonResponse({ shipmentId: "123", trackingPin: "4567890123456789" }) });
    const { createCanadaPostShipment } = await loadModule();

    await createCanadaPostShipment(shipmentRequest());

    expect(captured[0].url).toBe(
      "https://api-stg.canadapost-postescanada.ca/prod/devportal-portaildesdeveloppeurs/cpc-api-native-oauth-provider/oauth2/token"
    );
    expect(captured[1].url).toBe(
      `https://api-stg.canadapost-postescanada.ca/prod/devportal-portaildesdeveloppeurs/shipping/v1/${CUSTOMER_NUMBER}/${CUSTOMER_NUMBER}/shipments`
    );
  });

  it("surfaces Canada Post error codes with actionable hints", async () => {
    stubFetch({
      shipment: () =>
        jsonResponse(
          {
            title: "Validation failed",
            detail: "Errors occurred while processing the request.",
            errors: [
              { errorCode: "1711", message: "Please select a different Method of Payment." },
              {
                errorCode: "9162",
                message: "Length, Height and Width are mandatory when the document flag is false.",
              },
            ],
          },
          400
        ),
    });
    const { createCanadaPostShipment, CanadaPostError } = await loadModule();

    const error = (await createCanadaPostShipment(shipmentRequest()).catch((e) => e)) as Error;

    expect(error).toBeInstanceOf(CanadaPostError);
    expect(error.message).toContain("Create shipment failed (HTTP 400)");
    expect(error.message).toContain("1711: Please select a different Method of Payment.");
    expect(error.message).toContain("9162:");
    expect(error.message).toContain("CreditCard");
    expect(error.message).toContain("CANADAPOST_DEFAULT_LENGTH_CM");
  });
});

describe("Canada Post tracking summary (Tracking API 2.0.0)", () => {
  it("maps the latest event from GET /tracking/v1/pins/{pin}/summaries", async () => {
    stubFetch({
      tracking: () =>
        jsonResponse([
          {
            pin: "1234567890123456",
            serviceName: "Expedited Parcels",
            mailedOnDate: "2026-01-10",
            expectedDeliveryDate: "2026-01-14",
            actualDeliveryDate: null,
            eventDateTime: "20260112:133457",
            eventDescription: "Item processed",
            eventType: "INFO",
            eventLocation: "TORONTO,ON",
            destinationProvince: "ON",
          },
        ]),
    });
    const { getTrackingSummary } = await loadModule();

    const summary = await getTrackingSummary("1234567890123456");

    const call = captured[1];
    expect(call.url).toBe(`${PORTAL_BASE}/tracking/v1/pins/1234567890123456/summaries`);
    expect(call.headers.Accept).toBe("application/json");
    expect(call.headers.Authorization).toBe("Bearer test-token");
    expect(summary).toEqual({
      pin: "1234567890123456",
      serviceName: "Expedited Parcels",
      mailedOnDate: "2026-01-10",
      expectedDeliveryDate: "2026-01-14",
      actualDeliveryDate: null,
      attemptedDate: null,
      eventDateTime: "20260112:133457",
      eventDescription: "Item processed",
      eventType: "INFO",
      eventLocation: "TORONTO,ON",
      destinationProvince: "ON",
    });
  });

  it("returns null when the item carries an item-level error (No Pin History)", async () => {
    stubFetch({
      tracking: () =>
        jsonResponse([{ pin: "123456789012", error: { code: "004", descEn: "No Pin History", descFr: "" } }]),
    });
    const { getTrackingSummary } = await loadModule();

    expect(await getTrackingSummary("123456789012")).toBeNull();
  });

  it("returns null on 404 (no record for the PIN yet)", async () => {
    stubFetch({ tracking: () => jsonResponse({ message: "not found" }, 404) });
    const { getTrackingSummary } = await loadModule();

    expect(await getTrackingSummary("123456789012")).toBeNull();
  });

  it("surfaces transport failures as CanadaPostError", async () => {
    stubFetch({ tracking: () => jsonResponse({ httpCode: "401" }, 401) });
    const { getTrackingSummary, CanadaPostError } = await loadModule();

    const error = (await getTrackingSummary("123456789012").catch((e) => e)) as Error;
    expect(error).toBeInstanceOf(CanadaPostError);
    expect(error.message).toContain("Tracking lookup failed (HTTP 401)");
  });

  it("rejects empty PINs before calling the API", async () => {
    stubFetch({});
    const { getTrackingSummary, CanadaPostError } = await loadModule();

    await expect(getTrackingSummary("  ")).rejects.toBeInstanceOf(CanadaPostError);
    expect(captured).toHaveLength(0);
  });
});

describe("Canada Post rating payload", () => {
  it("quotes using the same box size the label will be bought with", async () => {
    stubFetch({
      rates: () =>
        jsonResponse([
          {
            serviceCode: "DOM.EP",
            serviceName: "Expedited Parcel",
            priceDetails: { due: 18.42 },
            serviceStandard: { guaranteedDelivery: false, expectedTransitTime: 3 },
          },
        ]),
    });

    const { getCanadaPostRates } = await loadModule();
    const rates = await getCanadaPostRates({
      destinationCountry: "CA",
      destinationPostalCode: "H7T 1A1",
      weightKg: 1.25,
    });

    const body = captured[1].body as {
      parcelCharacteristics: { dimensions: Record<string, number> };
      customerNumber: string;
    };

    expect(captured[1].url).toBe(RATES_URL);
    expect(body.parcelCharacteristics.dimensions).toEqual({ length: 30, width: 20, height: 10 });
    expect(body.customerNumber).toBe(CUSTOMER_NUMBER);
    expect(rates).toEqual([
      {
        serviceCode: "DOM.EP",
        serviceName: "Expedited Parcel",
        price: 18.42,
        transitDays: 3,
        guaranteedDelivery: false,
        expectedDeliveryDate: null,
      },
    ]);
  });
});

