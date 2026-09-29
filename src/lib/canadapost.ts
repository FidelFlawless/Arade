/**
 * Canada Post Developer Portal integration (modern APIs).
 *
 * - OAuth 2.0 client-credentials flow (X-IBM-Client-Id / X-IBM-Client-Secret)
 * - Rating API (POST /rating/v1/prices)
 * - Shipping API (POST /shipping/v1/{mailedBy}/{mobo}/shipments + label artifact)
 *
 * Credentials and shipping profile come from environment variables only:
 *   CANADAPOST_API_KEY           -> X-IBM-Client-Id
 *   CANADAPOST_SECRET_KEY        -> X-IBM-Client-Secret
 *   CANADAPOST_CUSTOMER_NUMBER   -> mailedBy / mobo in the shipping URL
 *   CANADAPOST_ORIGIN_POSTAL     -> requested shipping point + sender postal code
 *   CANADAPOST_ORIGIN_NAME / _PHONE / _ADDRESS / _CITY / _PROVINCE
 *   CANADAPOST_CONTRACT_ID       -> commercial contract number (Account settlement only)
 *   CANADAPOST_CONTRACT_NUMBER   -> older name for the same value (also accepted)
 *   CANADAPOST_PAYMENT_METHOD    -> "CreditCard" (default) or "Account"
 *   CANADAPOST_DEFAULT_LENGTH_CM / _WIDTH_CM / _HEIGHT_CM
 *                                -> packed parcel size (defaults 30 x 20 x 10 cm)
 *   CANADAPOST_API_BASE_URL      -> override the API host (defaults to production)
 *
 * Sandbox / test mode: Canada Post runs [Test] and [Production] apps on the
 * same endpoint — the app credentials decide what happens. Per the Developer
 * Portal: "Successful requests via [Test] apps return static, stubbed
 * responses" and "[Production] apps ... will incur actual billing charges".
 * Make sure CANADAPOST_API_KEY / CANADAPOST_SECRET_KEY belong to a [Test] app
 * while developing. CANADAPOST_SANDBOX only records that intent (it is
 * surfaced by previewShipmentPayload) — it cannot switch environments.
 * Use CANADAPOST_API_BASE_URL only if Canada Post issues a different host.
 *
 * Two Canada Post account rules are enforced here because they are the most
 * common cause of failed label creation:
 *   1711 - "Please select a different Method of Payment." Small Business
 *          (formerly Venture One) accounts have no line of credit, so they may
 *          only settle by CreditCard. Contract accounts settle by Account and
 *          must send their contractId.
 *   9162 - "Length, Height and Width are mandatory when the document flag is
 *          false." Every non-document parcel must carry dimensions.
 *
 * Per integration policy: when Canada Post fails, callers return a controlled
 * server error. There is NO automatic flat-rate fallback.
 */

/**
 * Canada Post serves [Test] and [Production] apps from the same portal host;
 * the credentials determine whether calls are stubbed or billed. The base URL
 * is resolved per call so CANADAPOST_API_BASE_URL can redirect every endpoint
 * (e.g. to a staging host) without touching code.
 */
const PRODUCTION_PORTAL_BASE =
  "https://api.canadapost-postescanada.ca/prod/devportal-portaildesdeveloppeurs";

function portalBase(): string {
  const override = process.env.CANADAPOST_API_BASE_URL?.trim();
  return override ? override.replace(/\/+$/, "") : PRODUCTION_PORTAL_BASE;
}

function portalUrl(path: string): string {
  return `${portalBase()}${path}`;
}

const TOKEN_PATH = "/cpc-api-native-oauth-provider/oauth2/token";
const RATES_PATH = "/rating/v1/prices";
const SHIPPING_PATH = "/shipping/v1";
const TRACKING_PATH = "/tracking/v1";

export interface CanadaPostRate {
  serviceCode: string;
  serviceName: string;
  price: number; // total due (CAD)
  transitDays: number | null;
  guaranteedDelivery: boolean;
  expectedDeliveryDate: string | null;
}

/** Packed parcel size in centimetres. */
export interface ParcelDimensions {
  lengthCm: number;
  widthCm: number;
  heightCm: number;
}

/**
 * Fallback packed size when the caller does not supply one. Canada Post
 * rejects any non-document parcel without dimensions (error 9162), so a
 * default box is always sent unless overridden by env vars.
 */
const FALLBACK_DIMENSIONS: ParcelDimensions = {
  lengthCm: 30,
  widthCm: 20,
  heightCm: 10,
};

function envPositiveNumber(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function envFlag(name: string): boolean {
  const raw = process.env[name]?.trim().toLowerCase();
  return raw === "true" || raw === "1" || raw === "yes";
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Resolve the parcel size sent to Canada Post: explicit request value first,
 * then env-configured default box, then the built-in fallback.
 */
function resolveDimensions(override?: Partial<ParcelDimensions>): ParcelDimensions {
  const dimensions: ParcelDimensions = {
    lengthCm: override?.lengthCm ?? envPositiveNumber("CANADAPOST_DEFAULT_LENGTH_CM", FALLBACK_DIMENSIONS.lengthCm),
    widthCm: override?.widthCm ?? envPositiveNumber("CANADAPOST_DEFAULT_WIDTH_CM", FALLBACK_DIMENSIONS.widthCm),
    heightCm: override?.heightCm ?? envPositiveNumber("CANADAPOST_DEFAULT_HEIGHT_CM", FALLBACK_DIMENSIONS.heightCm),
  };

  for (const [label, value] of Object.entries(dimensions)) {
    if (!Number.isFinite(value) || value <= 0) {
      throw new CanadaPostError(
        `Invalid parcel dimension ${label} (${value}). Canada Post requires positive length/width/height in centimetres.`
      );
    }
  }

  return dimensions;
}

interface SettlementInfo {
  paidByCustomer: string;
  intendedMethodOfPayment: "CreditCard" | "Account";
  contractId?: string;
}

/**
 * Build the settlement block. Canada Post error 1711 means the account cannot
 * use the requested method of payment:
 *   - Small Business / Venture One accounts (no commercial contract) have no
 *     line of credit -> must send CreditCard.
 *   - Contract accounts settle against their contract -> Account + contractId.
 * CANADAPOST_PAYMENT_METHOD overrides the auto-detection.
 * The contract number is read from CANADAPOST_CONTRACT_ID or the older
 * CANADAPOST_CONTRACT_NUMBER name.
 */
function resolveSettlement(customerNumber: string): SettlementInfo {
  const contractId =
    process.env.CANADAPOST_CONTRACT_ID?.trim() ||
    process.env.CANADAPOST_CONTRACT_NUMBER?.trim() ||
    "";
  const override = process.env.CANADAPOST_PAYMENT_METHOD?.trim().toLowerCase();

  let method: "CreditCard" | "Account";
  if (override === "account") {
    method = "Account";
  } else if (override === "creditcard" || override === "credit_card" || override === "credit-card") {
    method = "CreditCard";
  } else {
    method = contractId ? "Account" : "CreditCard";
  }

  if (method === "Account" && !contractId) {
    throw new CanadaPostError(
      "Payment method \"Account\" requires CANADAPOST_CONTRACT_ID (commercial contract accounts only). " +
        "Small Business accounts must settle by CreditCard."
    );
  }

  return {
    paidByCustomer: customerNumber,
    intendedMethodOfPayment: method,
    ...(method === "Account" ? { contractId } : {}),
  };
}

// ─── Error parsing ───────────────────────────────────────────────────────

interface CanadaPostErrorBody {
  title?: string;
  detail?: string;
  errorCode?: string;
  errorMessage?: string;
  errorDescription?: string;
  errors?: Array<{ errorCode?: string; message?: string }>;
}

/** actionable hints for the Canada Post validation codes we can hit. */
const ERROR_HINTS: Record<string, string> = {
  "1711":
    "This account cannot be billed as requested. Small Business (non-contract) accounts must use CreditCard; " +
    "contract accounts must set CANADAPOST_CONTRACT_ID and CANADAPOST_PAYMENT_METHOD=Account.",
  "2561":
    "Customer number and contract number combination is invalid - verify CANADAPOST_CUSTOMER_NUMBER / CANADAPOST_CONTRACT_ID.",
  "9174":
    "This account has no default payment card on its Canada Post profile. Sign in at canadapost-postescanada.ca -> Business -> " +
      "Customer view -> Payment methods (billing preferences) and save a card as DEFAULT. Contract shippers can instead set " +
      "CANADAPOST_CONTRACT_ID and CANADAPOST_PAYMENT_METHOD=Account.",
  "1182":
    "Canada Post could not authorize the default card on the profile (expired, declined by the issuer, prepaid cards often fail, " +
      "or a typo in number/expiry/CVC). Remove and re-add an active Visa/Mastercard/Amex as DEFAULT on the Canada Post profile, " +
      "then retry.",
  "7289":
    "The selected service code is not valid for this customer number / contract.",
  "9112":
    "The selected service is not available for this origin / destination pair.",
  "9162":
    "Parcels must include length, width and height. Set CANADAPOST_DEFAULT_LENGTH_CM, " +
    "CANADAPOST_DEFAULT_WIDTH_CM and CANADAPOST_DEFAULT_HEIGHT_CM (centimetres).",
};

/**
 * Turn a Canada Post error response into a readable message that keeps the
 * raw error codes (so the admin can act on them) and appends fix hints.
 */
function describeCanadaPostFailure(action: string, status: number, body: string): string {
  let parsed: CanadaPostErrorBody | null = null;
  try {
    parsed = JSON.parse(body) as CanadaPostErrorBody;
  } catch {
    parsed = null;
  }

  const codes: string[] = [];
  const details: string[] = [];

  if (parsed?.errors?.length) {
    for (const entry of parsed.errors) {
      const code = String(entry.errorCode ?? "").trim();
      const message = (entry.message ?? "").trim();
      if (code) codes.push(code);
      if (code || message) details.push(`${code || "?"}: ${message}`);
    }
  } else if (parsed) {
    if (parsed.errorCode) codes.push(String(parsed.errorCode));
    const message = parsed.errorMessage || parsed.errorDescription || "";
    if (parsed.errorCode || message) details.push(`${parsed.errorCode ?? "?"}: ${message}`);
  }

  if (!details.length) {
    details.push(parsed?.detail || body.slice(0, 300) || "no response body");
  }

  const hints = Array.from(new Set(codes.map((code) => ERROR_HINTS[code]).filter(Boolean)));

  return [
    `${action} failed (HTTP ${status})`,
    ...details.map((line) => ` — ${line}`),
    ...hints.map((hint) => ` — Fix: ${hint}`),
  ].join("");
}


interface TokenCache {
  token: string;
  expiresAt: number;
}

let cachedToken: TokenCache | null = null;

function isCanadaPostConfigured(): boolean {
  return Boolean(
    process.env.CANADAPOST_API_KEY?.trim() &&
    process.env.CANADAPOST_SECRET_KEY?.trim()
  );
}

async function getAccessToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 60_000) {
    return cachedToken.token;
  }

  const clientId = process.env.CANADAPOST_API_KEY!.trim();
  const clientSecret = process.env.CANADAPOST_SECRET_KEY!.trim();

  const res = await fetch(portalUrl(TOKEN_PATH), {
    method: "POST",
    headers: {
      "X-IBM-Client-Id": clientId,
      "X-IBM-Client-Secret": clientSecret,
      accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "scope=merchant&grant_type=client_credentials",
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new CanadaPostError(
      `Canada Post auth failed (HTTP ${res.status})${text ? ": " + text.slice(0, 200) : ""}`
    );
  }

  const data = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) {
    throw new CanadaPostError("Canada Post auth returned no access token");
  }

  cachedToken = {
    token: data.access_token,
    // expires_in is 3600s; refresh 5 min early
    expiresAt: now + (data.expires_in ?? 3600) * 1000 - 300_000,
  };
  return cachedToken.token;
}

export class CanadaPostError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CanadaPostError";
  }
}

// ─── Shipment creation (Phase 2) ─────────────────────────────────────────

interface ShipmentRequest {
  serviceCode: string;
  destination: {
    name: string;
    company?: string;
    phone?: string;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    provState: string;
    postalCode: string;
    country: "CA" | "US";
  };
  weightKg: number;
  /** Packed parcel size in cm. Falls back to the configured default box. */
  dimensions?: Partial<ParcelDimensions>;
  orderId: string; // customer reference printed on the label
}

interface CreateShipmentResult {
  shipmentId: string;
  trackingPin: string;
  labelUrl: string | null;
}

interface ShipmentContext {
  customerNumber: string;
  originPostal: string;
  settlement: SettlementInfo;
  dimensions: ParcelDimensions;
}

/** Resolve and validate everything a shipment payload needs from the env. */
function resolveShipmentContext(
  dimensionsOverride?: Partial<ParcelDimensions>
): ShipmentContext {
  if (!isCanadaPostConfigured()) {
    throw new CanadaPostError("Canada Post is not configured (missing API credentials)");
  }

  const originPostal =
    process.env.CANADAPOST_ORIGIN_POSTAL?.replace(/\s+/g, "").toUpperCase() || "";
  if (!originPostal) {
    throw new CanadaPostError("Canada Post origin postal code is not configured");
  }

  const customerNumber = process.env.CANADAPOST_CUSTOMER_NUMBER?.trim();
  if (!customerNumber) {
    throw new CanadaPostError("Canada Post customer number is not configured");
  }

  // Sender address is printed on the label and must be complete.
  if (!process.env.CANADAPOST_ORIGIN_ADDRESS?.trim() || !process.env.CANADAPOST_ORIGIN_CITY?.trim()) {
    throw new CanadaPostError(
      "Sender address is incomplete: set CANADAPOST_ORIGIN_ADDRESS and CANADAPOST_ORIGIN_CITY in the environment"
    );
  }

  return {
    customerNumber,
    originPostal,
    // Canada Post requires dimensions on every non-document parcel (error 9162)
    dimensions: resolveDimensions(dimensionsOverride),
    // ...and only accepts the payment method the account type allows (1711).
    settlement: resolveSettlement(customerNumber),
  };
}

/** Build the exact Create Shipment request body Canada Post expects. */
function buildShipmentPayload(req: ShipmentRequest, ctx: ShipmentContext) {
  const originName = process.env.CANADAPOST_ORIGIN_NAME?.trim() || "Arade";
  const originPhone = process.env.CANADAPOST_ORIGIN_PHONE?.trim() || "000-000-0000";
  const originAddress = process.env.CANADAPOST_ORIGIN_ADDRESS!.trim();
  const originCity = process.env.CANADAPOST_ORIGIN_CITY!.trim();
  const originProv = process.env.CANADAPOST_ORIGIN_PROVINCE?.trim() || "ON";

  return {
    // SMB accounts cannot use manifests (error 7302) — each label must be
    // transmitted and paid immediately via transmitShipment: true.
    transmitShipment: true,
    requestedShippingPoint: ctx.originPostal,
    deliverySpec: {
      serviceCode: req.serviceCode,
      sender: {
        name: originName,
        company: originName,
        contactPhone: originPhone,
        addressDetails: {
          addressLine1: originAddress,
          city: originCity,
          provState: originProv,
          countryCode: "CA",
          postalZipCode: ctx.originPostal,
        },
      },
      destination: {
        name: req.destination.name,
        ...(req.destination.company ? { company: req.destination.company } : {}),
        ...(req.destination.phone ? { clientVoiceNumber: req.destination.phone } : {}),
        addressDetails: {
          addressLine1: req.destination.addressLine1,
          ...(req.destination.addressLine2 ? { addressLine2: req.destination.addressLine2 } : {}),
          city: req.destination.city,
          provState: req.destination.provState,
          countryCode: req.destination.country,
          postalZipCode: req.destination.postalCode.replace(/\s+/g, "").toUpperCase(),
        },
      },
      parcelCharacteristics: {
        weight: Math.max(0.05, Math.round(req.weightKg * 100) / 100),
        // Required unless the parcel is flagged as a document (error 9162).
        // The API's document flag defaults to false for parcels, so the
        // dimensions below are what satisfies the requirement.
        dimensions: {
          length: round1(ctx.dimensions.lengthCm),
          width: round1(ctx.dimensions.widthCm),
          height: round1(ctx.dimensions.heightCm),
        },
        unpackaged: false,
      },
      printPreferences: { outputFormat: "8.5x11" },
      preferences: {
        showPackingInstructions: false,
        showPostageRate: true,
        showInsuredValue: true,
      },
      settlementInfo: ctx.settlement,
      references: { customerRef1: req.orderId },
    },
  };
}

export interface CanadaPostShipmentPreview {
  url: string;
  /** Non-secret view of the resolved configuration, for diagnostics. */
  config: {
    baseUrl: string;
    customerNumber: string;
    paymentMethod: "CreditCard" | "Account";
    contractId: string | null;
    dimensionsCm: { length: number; width: number; height: number };
    /** CANADAPOST_SANDBOX flag; it does NOT change the endpoint (see header). */
    sandboxDeclared: boolean;
  };
  payload: ReturnType<typeof buildShipmentPayload>;
}

/**
 * Build the exact Create Shipment request WITHOUT calling Canada Post.
 * Use this to verify the payload (dimensions, settlement method) before
 * spending a real label — see tests/canadapost.sandbox.test.ts.
 */
export function previewShipmentPayload(req: ShipmentRequest): CanadaPostShipmentPreview {
  const ctx = resolveShipmentContext(req.dimensions);

  return {
    url: `${portalUrl(SHIPPING_PATH)}/${ctx.customerNumber}/${ctx.customerNumber}/shipments`,
    config: {
      baseUrl: portalBase(),
      customerNumber: ctx.customerNumber,
      paymentMethod: ctx.settlement.intendedMethodOfPayment,
      contractId: ctx.settlement.contractId ?? null,
      dimensionsCm: {
        length: round1(ctx.dimensions.lengthCm),
        width: round1(ctx.dimensions.widthCm),
        height: round1(ctx.dimensions.heightCm),
      },
      sandboxDeclared: envFlag("CANADAPOST_SANDBOX"),
    },
    payload: buildShipmentPayload(req, ctx),
  };
}

/**
 * Create a Canada Post shipment and return the tracking PIN plus the
 * label link (a "provided endpoint" — use exactly as returned).
 * Throws CanadaPostError on failure.
 */
export async function createCanadaPostShipment(req: ShipmentRequest): Promise<CreateShipmentResult> {
  const ctx = resolveShipmentContext(req.dimensions);
  const token = await getAccessToken();

  const res = await fetch(
    `${portalUrl(SHIPPING_PATH)}/${ctx.customerNumber}/${ctx.customerNumber}/shipments`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(buildShipmentPayload(req, ctx)),
      cache: "no-store",
    }
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new CanadaPostError(describeCanadaPostFailure("Create shipment", res.status, text));
  }

  const data = (await res.json()) as {
    shipmentId?: string;
    trackingPin?: string;
    links?: Array<{ rel: string; href: string }>;
  };

  const labelUrl =
    data.links?.find((l) => l.rel === "label" || l.rel === "artifact")?.href || null;

  if (!data.shipmentId || !data.trackingPin) {
    throw new CanadaPostError("Create shipment returned no shipment id / tracking PIN");
  }

  return {
    shipmentId: String(data.shipmentId),
    trackingPin: String(data.trackingPin),
    labelUrl,
  };
}

/**
 * Fetch the PDF label for a shipment. Returns the raw PDF bytes.
 */
export async function getShipmentLabelPdf(
  labelOrArtifactUrl: string
): Promise<ArrayBuffer> {
  const token = await getAccessToken();
  const res = await fetch(labelOrArtifactUrl, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/pdf",
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new CanadaPostError(describeCanadaPostFailure("Label fetch", res.status, text));
  }
  return res.arrayBuffer();
}

// ─── Tracking (Phase 3, Tracking API 2.0.0) ─────────────────────────────

export interface CanadaPostTrackingSummary {
  pin: string;
  serviceName: string | null;
  mailedOnDate: string | null;
  expectedDeliveryDate: string | null;
  actualDeliveryDate: string | null;
  attemptedDate: string | null;
  /** Most recent significant event, "yyyymmdd:hhmmss" per Canada Post. */
  eventDateTime: string | null;
  eventDescription: string | null;
  eventType: string | null;
  eventLocation: string | null;
  destinationProvince: string | null;
}

interface RawTrackingItem {
  pin?: string | number;
  serviceName?: string;
  mailedOnDate?: string;
  expectedDeliveryDate?: string;
  actualDeliveryDate?: string;
  attemptedDate?: string;
  eventDateTime?: string;
  eventDescription?: string;
  eventType?: string;
  eventLocation?: string;
  destinationProvince?: string;
  error?: { code?: string; descEn?: string; descFr?: string } | null;
}

/**
 * Get the most recent tracking event for a parcel PIN via the Tracking API
 * (GET /tracking/v1/pins/{pin}/summaries).
 *
 * Returns null when Canada Post has no tracking data yet (label created but
 * not scanned, or the API reports an item-level error such as 004
 * "No Pin History") — that is a normal state, not a failure. Throws
 * CanadaPostError on transport/auth problems.
 */
export async function getTrackingSummary(pin: string): Promise<CanadaPostTrackingSummary | null> {
  const clean = pin?.trim();
  if (!clean) {
    throw new CanadaPostError("Tracking PIN is required");
  }
  if (!isCanadaPostConfigured()) {
    throw new CanadaPostError("Canada Post is not configured (missing API credentials)");
  }

  const token = await getAccessToken();
  const res = await fetch(
    `${portalUrl(TRACKING_PATH)}/pins/${encodeURIComponent(clean)}/summaries`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Accept-Language": "en-CA",
      },
      cache: "no-store",
    }
  );

  // 404 = no tracking record for this PIN yet (not an error for the UI).
  if (res.status === 404) return null;

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new CanadaPostError(describeCanadaPostFailure("Tracking lookup", res.status, text));
  }

  const items = (await res.json()) as RawTrackingItem[];
  if (!Array.isArray(items) || items.length === 0) return null;

  const first = items[0] ?? {};
  // Item-level error object (e.g. code 004 "No Pin History") means there is
  // no event data to show — treat like the empty case.
  if (first.error?.code) return null;

  return {
    pin: String(first.pin ?? clean),
    serviceName: first.serviceName || null,
    mailedOnDate: first.mailedOnDate || null,
    expectedDeliveryDate: first.expectedDeliveryDate || null,
    actualDeliveryDate: first.actualDeliveryDate || null,
    attemptedDate: first.attemptedDate || null,
    eventDateTime: first.eventDateTime || null,
    eventDescription: first.eventDescription || null,
    eventType: first.eventType || null,
    eventLocation: first.eventLocation || null,
    destinationProvince: first.destinationProvince || null,
  };
}

interface RateRequest {
  destinationPostalCode: string;
  destinationCountry: "CA" | "US";
  weightKg: number;
  /** Packed parcel size in cm; keeps the quote aligned with label creation. */
  dimensions?: Partial<ParcelDimensions>;
}

/**
 * Get live shipping rates from the Canada Post Rating API.
 * Throws CanadaPostError on any failure — callers surface a controlled
 * server error instead of falling back to flat fees.
 */
export async function getCanadaPostRates(req: RateRequest): Promise<CanadaPostRate[]> {
  if (!isCanadaPostConfigured()) {
    throw new CanadaPostError("Canada Post is not configured (missing API credentials)");
  }

  const originPostal =
    process.env.CANADAPOST_ORIGIN_POSTAL?.replace(/\s+/g, "").toUpperCase() || "";

  if (!originPostal) {
    throw new CanadaPostError("Canada Post origin postal code is not configured");
  }

  const customerNumber = process.env.CANADAPOST_CUSTOMER_NUMBER?.trim();
  const dimensions = resolveDimensions(req.dimensions);
  const destination =
    req.destinationCountry === "CA"
      ? { domestic: { postalCode: req.destinationPostalCode.replace(/\s+/g, "").toUpperCase() } }
      : { unitedStates: { zipCode: req.destinationPostalCode.replace(/\s+/g, "").toUpperCase() } };

  const payload: Record<string, unknown> = {
    quoteType: customerNumber ? "commercial" : "counter",
    parcelCharacteristics: {
      weight: Math.max(0.05, Math.round(req.weightKg * 100) / 100),
      // Same box size as label creation, so the quoted price matches the
      // price Canada Post charges when the label is bought.
      dimensions: {
        length: round1(dimensions.lengthCm),
        width: round1(dimensions.widthCm),
        height: round1(dimensions.heightCm),
      },
      unpackaged: false,
    },
    originPostalCode: originPostal,
    destination,
  };
  if (customerNumber) payload.customerNumber = customerNumber;

  const token = await getAccessToken();

  const res = await fetch(portalUrl(RATES_PATH), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new CanadaPostError(describeCanadaPostFailure("Canada Post rates", res.status, text));
  }

  const quotes = (await res.json()) as Array<{
    serviceCode: string;
    serviceName?: string;
    priceDetails?: { due?: number };
    serviceStandard?: {
      guaranteedDelivery?: boolean;
      expectedTransitTime?: number;
      expectedDeliveryDate?: string;
    };
  }>;

  if (!Array.isArray(quotes)) {
    throw new CanadaPostError("Canada Post returned an unexpected response");
  }

  return quotes.map((q) => ({
    serviceCode: q.serviceCode,
    serviceName: q.serviceName || q.serviceCode,
    price: Math.round((q.priceDetails?.due ?? 0) * 100) / 100,
    transitDays: q.serviceStandard?.expectedTransitTime ?? null,
    guaranteedDelivery: Boolean(q.serviceStandard?.guaranteedDelivery),
    expectedDeliveryDate: q.serviceStandard?.expectedDeliveryDate ?? null,
  }));
}
