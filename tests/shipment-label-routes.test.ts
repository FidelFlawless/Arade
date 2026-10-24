import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The two admin routes the label feature lives in, driven end to end with a
 * mocked Supabase client and the exact response shapes Canada Post returns:
 *
 *   POST /api/admin/orders/[id]/shipment  creates + stores BOTH artifacts
 *   GET  /api/admin/orders/[id]/label     serves the PDF artifact
 *   GET  /api/admin/orders/[id]/label?format=zpl   serves the printable ZPL
 *
 * The Supabase mock records every `update()` payload, so what the route would
 * write to the order is asserted directly, and the fetch mock answers the
 * artifact endpoint by Accept header, as the real API does.
 */

const state = vi.hoisted(() => ({
  order: null as Record<string, unknown> | null,
  items: [] as unknown[],
  updates: [] as Record<string, unknown>[],
  updateError: null as { message: string } | null,
  emails: [] as string[],
  allowed: true,
}));

vi.mock("@supabase/supabase-js", () => {
  /** Awaitable query result that also supports `.single()`. */
  function result(data: unknown) {
    const settled = Promise.resolve({ data, error: null });
    return {
      single: async () => ({ data, error: null }),
      then: settled.then.bind(settled),
      catch: settled.catch.bind(settled),
      finally: settled.finally.bind(settled),
    };
  }

  return {
    createClient: () => ({
      from: (table: string) => ({
        select: () => ({ eq: () => result(table === "order_items" ? state.items : state.order) }),
        update: (values: Record<string, unknown>) => {
          state.updates.push(values);
          // Like a real pre-migration database: only a write that references
          // the missing artifact column is rejected.
          return {
            eq: async () => ("label_zpl_url" in values ? { error: state.updateError } : { error: null }),
          };
        },
      }),
    }),
  };
});

vi.mock("@/lib/auth/admin", () => ({
  requireAdminUser: async () =>
    state.allowed
      ? { allowed: true }
      : {
          allowed: false,
          response: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
        },
}));

vi.mock("@/lib/emails", () => ({
  sendShippedEmail: async (id: string) => {
    state.emails.push(id);
  },
}));

const CUSTOMER_NUMBER = "0001221118";
const SHIPMENT_ID = "672111754570780329";
const TRACKING_PIN = "7023210159049755";
const ARTIFACT_URL =
  "https://api.canadapost-postescanada.ca/prod/devportal-portaildesdeveloppeurs" +
  `/shipping/v1/artifacts/f4afdd45b22bae36/shipping/10001624319/0`;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Minimal PDF whose content stream is stored uncompressed. */
function pdf(content: string): ArrayBuffer {
  const body = [
    "%PDF-1.4",
    "1 0 obj << /Type /Catalog >> endobj",
    `2 0 obj << /Length ${content.length} >> stream`,
    content,
    "endstream endobj",
    "%%EOF",
  ].join("\n");
  return new TextEncoder().encode(body).slice().buffer as ArrayBuffer;
}

/** The 4x6 label FORM a [Test] app serves as ZPL: watermarked, no PIN in it. */
function sandboxZpl(): string {
  return [
    "^XA",
    "^PW812",
    "^LL1218",
    "^FO32,81^A0N,23,18^FDFor Testing Purposes Only^FS",
    "^FO296,162^A0N,19,18^FDExpedited Parcel^FS",
    "^FO73,658^BY3^BCN,154^FS",
    "^FO22,850^A0N,20,16^FDTRACKING NUMBER^FS",
    "^XZ",
  ].join("\n");
}

/** A production-shaped label: the barcode field carries the tracking PIN. */
function productionZpl(): string {
  return ["^XA", "^PW812", "^LL1218", `^FO73,658^BY3^BCN,154^FD${TRACKING_PIN}^FS`, "^XZ"].join(
    "\n"
  );
}

let artifactCalls: string[] = [];
let ratingCalls = 0;
let shipmentPayloads: Record<string, unknown>[] = [];

/** Answer the OAuth call, Create Shipment, and the artifact endpoint. */
function stubCanadaPost(options: { pdfContent: string; zpl: string }) {
  artifactCalls = [];
  ratingCalls = 0;
  shipmentPayloads = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;

      if (url.includes("/oauth2/token")) {
        return jsonResponse({ access_token: "test-token", expires_in: 3600 });
      }
      if (url.includes("/rating/v1/prices")) {
        ratingCalls += 1;
        return jsonResponse([
          {
            serviceCode: "DOM.XP",
            serviceName: "Xpresspost",
            priceDetails: { due: 8.5 },
            serviceStandard: { expectedTransitTime: 2 },
          },
          {
            serviceCode: "DOM.EP",
            serviceName: "Expedited Parcel",
            priceDetails: { due: 12.5 },
            serviceStandard: { expectedTransitTime: 4 },
          },
        ]);
      }
      if (url.endsWith("/shipments")) {
        shipmentPayloads.push(JSON.parse(String(init?.body ?? "{}")));
        return jsonResponse({
          shipmentId: SHIPMENT_ID,
          shipmentStatus: "created",
          trackingPin: TRACKING_PIN,
          links: [
            { rel: "self", href: "https://cp/shipments/1", mediaType: "application/json" },
            {
              rel: "label",
              href: ARTIFACT_URL,
              mediaType: "application/pdf",
              index: 0,
            },
          ],
        });
      }
      if (url === ARTIFACT_URL) {
        const accept = ((init?.headers as Record<string, string>) ?? {}).Accept ?? "";
        artifactCalls.push(accept);
        if (accept === "application/zpl") {
          return new Response(options.zpl, {
            status: 200,
            headers: { "Content-Type": "application/zpl" },
          });
        }
        return new Response(pdf(options.pdfContent), {
          status: 200,
          headers: { "Content-Type": "application/pdf" },
        });
      }
      throw new Error(`Unexpected fetch to ${url}`);
    })
  );
}

function paidOrder(): Record<string, unknown> {
  return {
    id: "11111111-2222-3333-4444-555555555555",
    order_number: "ARD-TEST-1",
    payment_status: "paid",
    shipping_method_code: "DOM.EP",
    shipping_method_name: "Expedited Parcel",
    shipping_first_name: "Jane",
    shipping_last_name: "Doe",
    shipping_phone: "514-555-0100",
    shipping_address_line1: "456 Recipient Ave",
    shipping_address_line2: null,
    shipping_city: "Laval",
    shipping_state_province: "QC",
    shipping_postal_code: "H7T 1A1",
    shipping_country: "CA",
    tracking_number: null,
    label_url: null,
    label_zpl_url: null,
    label_pdf_kind: null,
  };
}

type RouteRequest = Parameters<typeof import("@/app/api/admin/orders/[id]/label/route").GET>[0];

function request(url: string): RouteRequest {
  return new Request(url) as unknown as RouteRequest;
}

async function loadShipmentRoute() {
  return import("@/app/api/admin/orders/[id]/shipment/route");
}

async function loadLabelRoute() {
  return import("@/app/api/admin/orders/[id]/label/route");
}

beforeEach(() => {
  state.order = paidOrder();
  state.items = [];
  state.updates = [];
  state.updateError = null;
  state.emails = [];
  state.allowed = true;

  process.env.CANADAPOST_API_KEY = "test-client-id";
  process.env.CANADAPOST_SECRET_KEY = "test-client-secret";
  process.env.CANADAPOST_CUSTOMER_NUMBER = CUSTOMER_NUMBER;
  process.env.CANADAPOST_ORIGIN_POSTAL = "M5V 3L9";
  process.env.CANADAPOST_ORIGIN_ADDRESS = "123 Sender Street";
  process.env.CANADAPOST_ORIGIN_CITY = "Toronto";
  process.env.CANADAPOST_ORIGIN_PROVINCE = "ON";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://db.example.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";
});

describe("POST /api/admin/orders/[id]/shipment", () => {
  it("stores the PDF artifact and the ZPL printable label for a [Test] app", async () => {
    // Sandbox reality: the PDF is a test/manifest sample, the ZPL is the label.
    const { POST } = await loadShipmentRoute();
    stubCanadaPost({
      pdfContent: "BT (Parcels - Detailed Manifest) Tj (fins de test uniquement) Tj ET",
      zpl: sandboxZpl(),
    });

    const res = await POST(request("http://localhost/api/admin/orders/x/shipment"), {
      params: Promise.resolve({ id: "x" }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({
      success: true,
      trackingNumber: TRACKING_PIN,
      labelUrl: ARTIFACT_URL,
      labelZplUrl: ARTIFACT_URL,
      labelPdfKind: "deposit_summary",
    });

    // Both representations were fetched, each with its own Accept header.
    expect(artifactCalls).toEqual(["application/pdf", "application/zpl"]);

    // Both artifacts are stored on the order.
    expect(state.updates).toEqual([
      {
        tracking_number: TRACKING_PIN,
        label_url: ARTIFACT_URL,
        label_zpl_url: ARTIFACT_URL,
        label_pdf_kind: "deposit_summary",
        order_status: "shipped",
      },
    ]);
    expect(state.emails).toEqual(["x"]);

    // The admin is told what the PDF artifact really is.
    expect(body.warning).toContain("not a shipping label");
    expect(body.warning).toContain("printable label is available in ZPL");

    // Legacy orders already hold a real Canada Post code: no extra quote call.
    expect(ratingCalls).toBe(0);
  });

  it("resolves a real Canada Post service code for flat-rate orders", async () => {
    const { POST } = await loadShipmentRoute();
    // Flat-rate checkout stores the generic "standard" method code.
    state.order = {
      ...paidOrder(),
      shipping_method_code: "standard",
      shipping_method_name: "Standard Delivery",
    };
    stubCanadaPost({
      pdfContent: `BT (PIN ${TRACKING_PIN}) Tj ET`,
      zpl: productionZpl(),
    });

    const res = await POST(request("http://localhost/api/admin/orders/x/shipment"), {
      params: Promise.resolve({ id: "x" }),
    });

    expect(res.status).toBe(200);
    // One quote is made to turn "standard" into a service Canada Post accepts.
    expect(ratingCalls).toBe(1);
    const deliverySpec = shipmentPayloads[0].deliverySpec as { serviceCode: string };
    // Expedited Parcel wins over the cheaper Xpresspost quote.
    expect(deliverySpec.serviceCode).toBe("DOM.EP");
  });

  it("stores the PDF as the label when the artifact really is one", async () => {
    const { POST } = await loadShipmentRoute();
    stubCanadaPost({
      pdfContent: `BT (PIN ${TRACKING_PIN}) Tj ET`,
      zpl: productionZpl(),
    });

    const res = await POST(request("http://localhost/api/admin/orders/x/shipment"), {
      params: Promise.resolve({ id: "x" }),
    });
    const body = await res.json();

    expect(body.labelPdfKind).toBe("label");
    expect(body.labelZplUrl).toBe(ARTIFACT_URL);
    expect(body.warning).toBeUndefined();
    expect(state.updates[0]).toMatchObject({ label_pdf_kind: "label" });
  });

  it("refuses a shipment for an order that is not paid", async () => {
    const { POST } = await loadShipmentRoute();
    state.order = { ...paidOrder(), payment_status: "pending" };
    stubCanadaPost({ pdfContent: "BT (x) Tj ET", zpl: productionZpl() });

    const res = await POST(request("http://localhost/api/admin/orders/x/shipment"), {
      params: Promise.resolve({ id: "x" }),
    });

    expect(res.status).toBe(400);
    expect(state.updates).toEqual([]);
  });

  it("never loses the tracking PIN when the artifact columns do not exist yet", async () => {
    const { POST } = await loadShipmentRoute();
    // Pre-migration database: PostgREST rejects the write naming the column.
    state.updateError = { message: "column orders.label_zpl_url does not exist" };
    stubCanadaPost({
      pdfContent: "BT (Parcels - Detailed Manifest) Tj (fins de test uniquement) Tj ET",
      zpl: sandboxZpl(),
    });

    const res = await POST(request("http://localhost/api/admin/orders/x/shipment"), {
      params: Promise.resolve({ id: "x" }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.trackingNumber).toBe(TRACKING_PIN);
    expect(body.labelZplUrl).toBeNull();
    expect(body.warning).toContain("20261013_order_label_artifacts.sql");

    // First attempt kept the artifacts, retry kept the tracking PIN.
    expect(state.updates).toHaveLength(2);
    expect(state.updates[1]).toEqual({
      tracking_number: TRACKING_PIN,
      label_url: ARTIFACT_URL,
      order_status: "shipped",
    });
  });
});

describe("admin order detail page", () => {
  it("loads as a client component with the label controls", async () => {
    const page = await import("@/app/admin/orders/[id]/page");
    const source = await import("node:fs").then((fs) =>
      fs.readFileSync("src/app/admin/orders/[id]/page.tsx", "utf8")
    );

    expect(typeof page.default).toBe("function");
    expect(source).toContain("Download Label (PDF)");
    expect(source).toContain("/api/admin/orders/${id}/label");
  });
});

describe("GET /api/admin/orders/[id]/label", () => {
  it("serves the PDF artifact named as the deposit summary it is", async () => {
    const { GET } = await loadLabelRoute();
    state.order = {
      ...paidOrder(),
      tracking_number: TRACKING_PIN,
      label_url: ARTIFACT_URL,
      label_pdf_kind: "deposit_summary",
    };
    stubCanadaPost({
      pdfContent: "BT (Parcels - Detailed Manifest) Tj (fins de test uniquement) Tj ET",
      zpl: sandboxZpl(),
    });

    const res = await GET(request("http://localhost/api/admin/orders/x/label"), {
      params: Promise.resolve({ id: "x" }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(res.headers.get("x-arade-artifact")).toBe("deposit_summary");
    expect(res.headers.get("content-disposition")).toContain(
      `deposit-summary-${TRACKING_PIN}.pdf`
    );
  });

  it("serves the printable label as a ZPL download", async () => {
    const { GET } = await loadLabelRoute();
    state.order = {
      ...paidOrder(),
      tracking_number: TRACKING_PIN,
      label_url: ARTIFACT_URL,
      label_zpl_url: ARTIFACT_URL,
      label_pdf_kind: "deposit_summary",
    };
    stubCanadaPost({
      pdfContent: "BT (Parcels - Detailed Manifest) Tj ET",
      zpl: sandboxZpl(),
    });

    const res = await GET(request("http://localhost/api/admin/orders/x/label?format=zpl"), {
      params: Promise.resolve({ id: "x" }),
    });
    const body = await res.text();

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/zpl; charset=utf-8");
    expect(res.headers.get("content-disposition")).toContain(`label-${TRACKING_PIN}.zpl`);
    expect(res.headers.get("x-arade-artifact")).toBe("printable-label");
    expect(body).toContain("^BC");
    expect(artifactCalls).toEqual(["application/zpl"]);
  });

  it("falls back to label_url for ZPL on a database without the new columns", async () => {
    const { GET } = await loadLabelRoute();
    // Row read with select("*") on a pre-migration database: new keys absent.
    state.order = { ...paidOrder(), tracking_number: TRACKING_PIN, label_url: ARTIFACT_URL };
    stubCanadaPost({
      pdfContent: "BT (Parcels - Detailed Manifest) Tj ET",
      zpl: productionZpl(),
    });

    const res = await GET(request("http://localhost/api/admin/orders/x/label?format=zpl"), {
      params: Promise.resolve({ id: "x" }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("x-arade-artifact")).toBe("printable-label");
  });

  it("refuses a manifest ZPL instead of serving it as the label", async () => {
    const { GET } = await loadLabelRoute();
    state.order = { ...paidOrder(), tracking_number: TRACKING_PIN, label_url: ARTIFACT_URL };
    stubCanadaPost({
      pdfContent: "BT (x) Tj ET",
      zpl: "^XA^PW812^LL1218^FDParcels - Detailed Manifest^FS^XZ",
    });

    const res = await GET(request("http://localhost/api/admin/orders/x/label?format=zpl"), {
      params: Promise.resolve({ id: "x" }),
    });
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toContain("DETAILED MANIFEST");
  });

  it("404s when the order has no stored artifact", async () => {
    const { GET } = await loadLabelRoute();
    stubCanadaPost({ pdfContent: "BT (x) Tj ET", zpl: productionZpl() });

    const res = await GET(request("http://localhost/api/admin/orders/x/label?format=zpl"), {
      params: Promise.resolve({ id: "x" }),
    });

    expect(res.status).toBe(404);
  });

  it("requires an admin session", async () => {
    const { GET } = await loadLabelRoute();
    state.allowed = false;
    stubCanadaPost({ pdfContent: "BT (x) Tj ET", zpl: productionZpl() });

    const res = await GET(request("http://localhost/api/admin/orders/x/label"), {
      params: Promise.resolve({ id: "x" }),
    });

    expect(res.status).toBe(401);
    expect(artifactCalls).toEqual([]);
  });
});
