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
 * Label artifact vs manifest: Create Shipment returns a `links` array, and
 * only the `rel: "label"` entry is the parcel's printable label. In Canada
 * Post's manifest workflow `rel: "artifact"` is the manifest hardcopy
 * ("Parcels - Detailed Manifest"), so it is never accepted as a label.
 * Every downloaded artifact is also inspected before it is stored or served
 * (see inspectLabelArtifact): a [Test] app answers with Canada Post's stubbed
 * sample document, which would otherwise be filed as a shipping label.
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

import { inflateSync } from "node:zlib";

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
  "7302":
    "Small/Medium Business accounts cannot use manifest (group) shipping - every label must be purchased individually. " +
      "Keep transmitShipment: true; do not switch this account to group/manifest mode.",
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

/**
 * True for a real Canada Post service code such as `DOM.EP` or `USA.TP`.
 *
 * Checkout now stores the generic `standard` method code because delivery is
 * priced flat, so label creation has to resolve a real service code before
 * calling the Shipping API. Codes written by the old live-rate checkout match
 * this pattern and are used as-is.
 */
export function isCanadaPostServiceCode(
  code: string | null | undefined
): code is string {
  return Boolean(code && /^[A-Z]{2,4}\.[A-Z]{2,3}$/.test(code));
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
  /**
   * Artifact URLs to try as the label, primary first: the link Canada Post
   * types/labels as "label", then any other PDF artifact it published
   * (publicLabel, ...). Callers download them in order and keep the first one
   * that really is a printable label.
   */
  artifactCandidates: string[];
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
      printPreferences: { outputFormat: "8.5x11", encoding: "PDF" },
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
    links?: CanadaPostLink[];
  };

  const labelLink = pickLabelArtifactLink(data.links);
  const labelUrl = labelLink?.href || null;

  if (!data.shipmentId || !data.trackingPin) {
    throw new CanadaPostError("Create shipment returned no shipment id / tracking PIN");
  }

  // One line recording exactly which artifacts Canada Post published, so a
  // wrong document can be traced back to the link list instead of guessed at.
  if (labelLink) {
    console.info(
      `Canada Post shipment ${data.shipmentId}: label artifact -> ${describeShipmentLink(labelLink)}`
    );
  } else {
    console.warn(
      `Canada Post shipment ${data.shipmentId}: no label artifact in the response -> ${describeShipmentLinks(
        data.links
      )}`
    );
  }

  return {
    shipmentId: String(data.shipmentId),
    trackingPin: String(data.trackingPin),
    labelUrl,
    artifactCandidates: pickLabelCandidateUrls(data.links),
  };
}

// ─── Label artifact integrity ────────────────────────────────────────────

/** One entry of a Canada Post `links` array. */
export interface CanadaPostLink {
  rel?: string;
  href?: string;
  mediaType?: string;
  index?: number;
  /** Some responses type the artifact explicitly ("label", "manifest", ...). */
  artifactType?: string;
  documentType?: string;
  type?: string;
}

/** Artifact kinds that are explicitly a parcel label. */
const LABEL_ARTIFACT_TYPES = ["label", "shippinglabel", "etiquette"];

/**
 * Artifact kinds that are never a parcel label. A manifest ("Parcels -
 * Detailed Manifest" plus its deposit summary) and a receipt are separate
 * documents and must not be stored or printed as the shipment's label.
 */
const NON_LABEL_ARTIFACT_TYPES = [
  "artifact",
  "manifest",
  "manifeste",
  "detailedmanifest",
  "manifestedetaille",
  "depositsummary",
  "sommairedudepot",
  "receipt",
  "recu",
];

/** Normalised artifact type of a link ("label", "manifest", ...). */
function artifactTypeOf(link: CanadaPostLink): string {
  const raw = link.artifactType ?? link.documentType ?? link.type ?? "";
  return String(raw).trim().toLowerCase().replace(/[\s_-]/g, "");
}

/**
 * Pick the printable shipping label out of a Create Shipment / Get Shipment
 * link list, by ARTIFACT TYPE first:
 *
 *   1. a link typed as a label (artifactType/documentType/type = "label") wins;
 *   2. otherwise a link typed as a manifest / deposit summary / receipt is
 *      rejected outright — in the manifest workflow that paperwork is a
 *      different document from the parcel label;
 *   3. only then fall back to `rel: "label"`.
 *
 * Returns null when nothing label-shaped was published, so the caller can log
 * the full link inventory instead of quietly filing the wrong document.
 */
export function pickLabelArtifactLink(links?: CanadaPostLink[] | null): CanadaPostLink | null {
  if (!Array.isArray(links)) return null;

  const candidates = links.filter(
    (link) => typeof link?.href === "string" && link.href.length > 0
  );

  const typed = candidates.find((link) => LABEL_ARTIFACT_TYPES.includes(artifactTypeOf(link)));
  if (typed) return typed;

  const byRel = candidates.find((link) => {
    if ((link.rel ?? "").trim().toLowerCase() !== "label") return false;
    const type = artifactTypeOf(link);
    return !NON_LABEL_ARTIFACT_TYPES.includes(type);
  });

  return byRel ?? null;
}

/**
 * Every artifact URL worth trying as the label, primary first. Canada Post
 * publishes more than one PDF for some shipments (for example `label` and
 * `publicLabel`), so the caller verifies each in turn instead of trusting the
 * first one.
 */
export function pickLabelCandidateUrls(links?: CanadaPostLink[] | null): string[] {
  const urls: string[] = [];

  const primary = pickLabelArtifactLink(links);
  if (primary?.href) urls.push(primary.href);

  for (const link of links ?? []) {
    const href = link?.href;
    if (!href || urls.includes(href)) continue;
    const media = (link.mediaType ?? "").toLowerCase();
    const rel = (link.rel ?? "").toLowerCase();
    if (media.includes("pdf") || LABEL_ARTIFACT_TYPES.includes(artifactTypeOf(link))) urls.push(href);
    else if (rel === "publiclabel") urls.push(href);
  }

  return urls;
}

/** One link, rendered for logs: rel, artifact type, media type, index, href. */
export function describeShipmentLink(link: CanadaPostLink): string {
  const parts = [
    `rel=${link.rel ?? "?"}`,
    `type=${artifactTypeOf(link) || "?"}`,
    `media=${link.mediaType ?? "?"}`,
    link.index === undefined ? null : `index=${link.index}`,
  ].filter(Boolean);
  return `${parts.join(" ")} ${link.href ?? ""}`.trim();
}

/** Every link in a response, so a failed selection shows what CP did send. */
export function describeShipmentLinks(links?: CanadaPostLink[] | null): string {
  if (!Array.isArray(links) || links.length === 0) return "(no links returned)";
  return links.map((link) => `[${describeShipmentLink(link)}]`).join(" ");
}

/**
 * Phrases that only ever appear in a Canada Post artifact that is NOT a parcel
 * label: the manifest hardcopy and deposit summaries.
 */
const MANIFEST_MARKERS = [
  "detailed manifest",
  "manifeste détaillé",
  "manifest / manifeste",
  "deposit summary",
  "sommaire du dépôt",
  "sommaire du depot",
];

const NOT_A_LABEL_MARKERS = [
  ...MANIFEST_MARKERS,
  "fins de test uniquement",
  "test purposes only",
  "testing purposes only",
];

/**
 * Canada Post's [Test] watermark, in the wording it actually uses. The English
 * one reads "For Testing Purposes Only" — matching only "test purposes only"
 * misses it, which is exactly how a sample label passes for a real one.
 */
function isTestArtifact(text: string): boolean {
  const haystack = text.toUpperCase();
  return (
    /TEST(ING)? PURPOSES ONLY/.test(haystack) || haystack.includes("FINS DE TEST UNIQUEMENT")
  );
}

function latin1(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i++) out += String.fromCharCode(bytes[i]);
  return out;
}

/** Fonts commonly store text as ASCII hex strings; decode the long runs too. */
function decodeHexTextRuns(text: string): string {
  const decoded: string[] = [];
  for (const run of text.match(/[0-9A-Fa-f]{8,}/g) ?? []) {
    if (run.length % 2 !== 0) continue;
    let value = "";
    for (let i = 0; i < run.length; i += 2) {
      value += String.fromCharCode(parseInt(run.slice(i, i + 2), 16));
    }
    decoded.push(value);
  }
  return decoded.join("\n");
}

/**
 * Best-effort plain text of a PDF, for verifying what Canada Post actually
 * sent. Every stream is inflated when possible (falling back to the raw
 * bytes), and hex-encoded text runs are decoded as well.
 */
export function extractPdfText(pdf: ArrayBuffer): string {
  const raw = latin1(new Uint8Array(pdf));
  const parts: string[] = [raw];

  let cursor = 0;
  while (true) {
    const marker = raw.indexOf("stream", cursor);
    if (marker === -1) break;
    let body = marker + "stream".length;
    if (raw[body] === "\r") body++;
    if (raw[body] === "\n") body++;
    const end = raw.indexOf("endstream", body);
    if (end === -1) break;

    const chunk = new Uint8Array(pdf, body, end - body);
    try {
      parts.push(latin1(inflateSync(chunk)));
    } catch {
      parts.push(latin1(chunk));
    }
    cursor = end + "endstream".length;
  }

  const text = parts.join("\n");
  return `${text}\n${decodeHexTextRuns(text)}`;
}

export type LabelArtifactVerdict = "label" | "not-a-label" | "unverified";

export interface LabelArtifactInspection {
  verdict: LabelArtifactVerdict;
  /** Explanation safe to show an admin; null when there is nothing to say. */
  reason: string | null;
  /** The document carries Canada Post's test watermark. */
  testDocument: boolean;
}

/**
 * Decide whether downloaded bytes really are a printable shipping label.
 *
 * "not-a-label" is decisive: the document is a manifest or Canada Post's test
 * sample, and it must never be stored or served as the order's label.
 * "unverified" means no manifest/test marker was found but the tracking PIN was
 * not located either — store it, warn the admin, and let a human eyeball it.
 */
export function inspectLabelArtifact(
  pdf: ArrayBuffer,
  trackingPin?: string | null
): LabelArtifactInspection {
  const text = extractPdfText(pdf);
  const haystack = text.toLowerCase();
  const testDocument = isTestArtifact(text);

  // Manifests or deposit summaries are never parcel shipping labels
  const manifestMarker = MANIFEST_MARKERS.find((entry) => haystack.includes(entry));
  if (manifestMarker) {
    return {
      verdict: "not-a-label",
      testDocument,
      reason: testDocument
        ? `Canada Post [Test] app returned a manifest document ("${manifestMarker}"), not a shipping label.`
        : `Canada Post returned a manifest document ("${manifestMarker}"), not a shipping label. ` +
          'Manifest hardcopies use rel="artifact" and must never be printed as a parcel label.',
    };
  }

  const pin = trackingPin?.trim();
  if (pin && text.replace(/\s+/g, "").includes(pin)) {
    return { verdict: "label", testDocument, reason: null };
  }

  // In sandbox mode: Canada Post's [Test] app serves static watermarked sample
  // PDFs ("For Testing Purposes Only"). In sandbox this IS the valid PDF shipping label.
  if (envFlag("CANADAPOST_SANDBOX")) {
    return {
      verdict: "label",
      testDocument: true,
      reason: testDocument
        ? "Canada Post [Test] app sample label (watermarked for testing purposes)."
        : null,
    };
  }

  // In production: a document with test watermark when live label was expected
  // indicates test credentials were used.
  const marker = NOT_A_LABEL_MARKERS.find((entry) => haystack.includes(entry));
  if (marker) {
    return {
      verdict: "not-a-label",
      testDocument,
      reason: testDocument
        ? `Canada Post [Test] app returned a sample document ("${marker}"), not a shipping label. ` +
          "The sandbox returns a static label; real labels need [Production] API keys."
        : `Canada Post returned a manifest document ("${marker}"), not a shipping label. ` +
          'Manifest hardcopies use rel="artifact" and must never be printed as a parcel label.',
    };
  }

  return {
    verdict: "unverified",
    testDocument,
    reason: pin
      ? `The downloaded document could not be confirmed as a label: tracking PIN ${pin} was not found in it. Open it once before printing.`
      : "The downloaded document could not be confirmed as a label.",
  };
}

// ─── Artifact representations: PDF vs ZPL ────────────────────────────────

/**
 * The two representations Canada Post serves for the same shipment artifact
 * URL. The endpoint content-negotiates on `Accept`: with no Accept header it
 * answers 406 Not Acceptable, `application/pdf` returns the PDF artifact and
 * `application/zpl` returns the printable 4x6 label for a thermal printer.
 */
export const ARTIFACT_ACCEPT = {
  pdf: "application/pdf",
  zpl: "application/zpl",
} as const;

export type ArtifactFormat = keyof typeof ARTIFACT_ACCEPT;

/** What the PDF artifact of a shipment turned out to be. */
export type LabelPdfKind = "label" | "deposit_summary" | "unverified";

/**
 * Download one representation of a shipment artifact. The URL is the same for
 * both — only the Accept header differs.
 */
export async function getShipmentArtifact(
  labelOrArtifactUrl: string,
  format: ArtifactFormat = "pdf"
): Promise<ArrayBuffer> {
  const token = await getAccessToken();
  const res = await fetch(labelOrArtifactUrl, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: ARTIFACT_ACCEPT[format],
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new CanadaPostError(
      describeCanadaPostFailure(
        format === "zpl" ? "Label (ZPL) fetch" : "Label fetch",
        res.status,
        text
      )
    );
  }
  return res.arrayBuffer();
}

/**
 * Fetch the PDF artifact for a shipment. Returns the raw PDF bytes.
 */
export async function getShipmentLabelPdf(
  labelOrArtifactUrl: string
): Promise<ArrayBuffer> {
  return getShipmentArtifact(labelOrArtifactUrl, "pdf");
}

/**
 * Fetch the ZPL II representation of a shipment artifact — the printable
 * label. ZPL is an ASCII command stream, so the bytes are returned as text.
 */
export async function getShipmentLabelZpl(
  labelOrArtifactUrl: string
): Promise<string> {
  return latin1(new Uint8Array(await getShipmentArtifact(labelOrArtifactUrl, "zpl")));
}

/**
 * Convert ZPL II label commands into a printable 4x6 PDF using Labelary.
 */
export async function convertZplToPdf(zpl: string): Promise<ArrayBuffer> {
  const res = await fetch("https://api.labelary.com/v1/printers/8dpmm/labels/4x6/0/", {
    method: "POST",
    headers: {
      Accept: "application/pdf",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: zpl,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new CanadaPostError(`Labelary ZPL to PDF conversion failed (HTTP ${res.status}): ${text.slice(0, 100)}`);
  }

  return res.arrayBuffer();
}

/** What a ZPL stream turned out to be, plus whether it carries tracking data. */
export interface ZplLabelInspection extends LabelArtifactInspection {
  /** The ZPL prints the tracking PIN or fills a barcode field with data. */
  hasTrackingData: boolean;
}

/**
 * Phrase-level markers of a Canada Post shipment *document* in ZPL form: the
 * detailed manifest and the deposit summary. Deliberately not the bare word
 * "MANIFEST" — a parcel label form prints "MANIFEST REQ" as a field caption.
 */
const ZPL_DOCUMENT_MARKERS = [
  "DETAILED MANIFEST",
  "MANIFESTE DETAILLE",
  "DEPOSIT SUMMARY",
  "SOMMAIRE DU DEPOT",
];

/**
 * Decide whether a downloaded ZPL stream really is a printable parcel label.
 *
 * A label is a ZPL II program with a label canvas (`^PW`/`^LL`, i.e. the 4x6
 * stock) that draws a barcode (`^BY` + `^BC`/`^BQ`/`^B3`) or prints the
 * tracking PIN. A detailed manifest or a deposit summary is a different
 * document and is rejected. A label carrying Canada Post's "For Testing
 * Purposes Only" watermark is still the printable artifact of a [Test] app, so
 * it keeps the "label" verdict and reports `testDocument` — and, when its
 * barcode field is empty, `hasTrackingData: false`.
 */   export function inspectZplLabel( zpl: string,
    trackingPin?: string | null
  ): ZplLabelInspection {
  const upper = zpl.toUpperCase();
  const testDocument = isTestArtifact(zpl);

  const pin = trackingPin?.trim() ?? "";
  const hasPin = pin.length > 0 && zpl.includes(pin);
  const hasBarcode = /\^B[YCQ3]/.test(upper);
  const hasCanvas = /\^PW\d/.test(upper) && /\^LL\d/.test(upper);
  // A filled barcode field looks like ^BCN,120^FD<value>^FS; the field's data
  // comes after the ^BC parameters and before the closing ^FS.
  const hasBarcodeData = /\^B[YCQ3][^^]*\^FD[^^]/.test(zpl);
  const hasTrackingData = hasPin || hasBarcodeData;

  const marker = ZPL_DOCUMENT_MARKERS.find((entry) => upper.includes(entry));
  if (marker) {
    return {
      verdict: "not-a-label",
      testDocument,
      hasTrackingData,
      reason: testDocument
        ? `Canada Post returned a TEST document ("${marker}"), not a shipping label.`
        : `The ZPL artifact is a shipment document ("${marker}"), not a printable label.`,
    };
  }

  if ((hasBarcode && hasCanvas) || hasPin) {
    return {
      verdict: "label",
      testDocument,
      hasTrackingData,
      reason: testDocument
        ? "Canada Post served a [Test] sample label, watermarked and without tracking data — real labels need [Production] API keys."
        : hasTrackingData
          ? null
          : "Canada Post published a label canvas without tracking data in it; open it before printing.",
    };
  }

  return {
    verdict: "unverified",
    testDocument,
    hasTrackingData,
    reason: pin
      ? `The ZPL artifact could not be confirmed as a label: no label canvas/barcode, and tracking PIN ${pin} is not in it.`
      : "The ZPL artifact could not be confirmed as a label: no label canvas or barcode in it.",
  };
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
