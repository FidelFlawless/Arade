import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { deflateSync } from "node:zlib";
import {
  describeShipmentLinks,
  extractPdfText,
  inspectLabelArtifact,
  inspectZplLabel,
  pickLabelArtifactLink,
  pickLabelCandidateUrls,
} from "@/lib/canadapost";

/**
 * Guards the two ways a manifest can end up printed as a shipping label:
 * selecting the wrong entry out of Canada Post's `links` array, and accepting
 * an artifact whose bytes are actually a manifest (or a [Test] app's sample).
 */

const PIN = "7023210159049755";

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.slice().buffer as ArrayBuffer;
}

/** Minimal PDF whose content stream is stored uncompressed. */
function plainPdf(content: string): ArrayBuffer {
  const body = [
    "%PDF-1.4",
    "1 0 obj << /Type /Catalog >> endobj",
    `2 0 obj << /Length ${content.length} >> stream`,
    content,
    "endstream endobj",
    "%%EOF",
  ].join("\n");
  return toArrayBuffer(new TextEncoder().encode(body));
}

/** Same, but FlateDecode-compressed the way Canada Post ships its artifacts. */
function deflatedPdf(content: string): ArrayBuffer {
  const parts = [
    Buffer.from("%PDF-1.4\n2 0 obj << /Length 0 >> stream\n", "latin1"),
    deflateSync(Buffer.from(content, "latin1")),
    Buffer.from("\nendstream endobj\n%%EOF", "latin1"),
  ];
  const merged = Buffer.concat(parts, parts.reduce((sum, part) => sum + part.length, 0));
  return toArrayBuffer(new Uint8Array(merged));
}

describe("pickLabelArtifactLink", () => {
  it("uses only the entry whose rel is label", () => {
    const link = pickLabelArtifactLink([
      { rel: "self", href: "https://cp/shipments/1" },
      { rel: "publicLabel", href: "https://cp/public", mediaType: "application/pdf" },
      { rel: "artifact", href: "https://cp/manifest-hardcopy", mediaType: "application/pdf" },
      {
        rel: "label",
        href: "https://cp/artifacts/hash/shipping/1/0",
        mediaType: "application/pdf",
      },
    ]);

    expect(link?.href).toBe("https://cp/artifacts/hash/shipping/1/0");
  });

  it("never falls back to an artifact/manifest link", () => {
    // Get Manifest returns rel "artifact" for the manifest hardcopy.
    expect(
      pickLabelArtifactLink([{ rel: "artifact", href: "https://cp/manifest.pdf" }])
    ).toBeNull();
    expect(
      pickLabelArtifactLink([{ rel: "manifest", href: "https://cp/manifest.pdf" }])
    ).toBeNull();
    expect(pickLabelArtifactLink([])).toBeNull();
    expect(pickLabelArtifactLink(undefined)).toBeNull();
  });

  it("matches the rel case-insensitively and ignores empty hrefs", () => {
    expect(
      pickLabelArtifactLink([{ rel: "Label", href: "https://cp/label.pdf" }])?.href
    ).toBe("https://cp/label.pdf");
    expect(pickLabelArtifactLink([{ rel: "label", href: "" }])).toBeNull();
    expect(pickLabelArtifactLink([{ rel: "label" }])).toBeNull();
  });

  it("prefers an artifact explicitly typed as a label, whatever its rel is", () => {
    const link = pickLabelArtifactLink([
      { rel: "artifact", href: "https://cp/manifest.pdf", artifactType: "manifest" },
      { rel: "artifact", href: "https://cp/label.pdf", artifactType: "label" },
    ]);

    expect(link?.href).toBe("https://cp/label.pdf");
  });

  it("rejects an artifact typed as a manifest even when its rel says label", () => {
    expect(
      pickLabelArtifactLink([
        { rel: "label", href: "https://cp/detailed-manifest.pdf", documentType: "manifest" },
      ])
    ).toBeNull();
    expect(
      pickLabelArtifactLink([
        { rel: "label", href: "https://cp/deposit-summary.pdf", type: "Deposit Summary" },
      ])
    ).toBeNull();
    expect(
      pickLabelArtifactLink([
        { rel: "artifact", href: "https://cp/receipt.pdf", artifactType: "receipt" },
      ])
    ).toBeNull();
  });

  it("returns every PDF artifact to try, primary label link first", () => {
    const urls = pickLabelCandidateUrls([
      { rel: "self", href: "https://cp/self", mediaType: "application/json" },
      { rel: "publicLabel", href: "https://cp/public", mediaType: "application/pdf" },
      { rel: "label", href: "https://cp/artifacts/x/shipping/1/0", mediaType: "application/pdf" },
      { rel: "details", href: "https://cp/details", mediaType: "application/json" },
    ]);

    expect(urls[0]).toBe("https://cp/artifacts/x/shipping/1/0");
    expect(urls).toContain("https://cp/public");
    expect(urls).not.toContain("https://cp/self");
    expect(urls).toHaveLength(2);
  });

  it("describes every link so a failed selection can be diagnosed", () => {
    const inventory = describeShipmentLinks([
      { rel: "self", href: "https://cp/self", mediaType: "application/json" },
      { rel: "label", href: "https://cp/artifacts/x/shipping/1/0", mediaType: "application/pdf", index: 0 },
    ]);

    expect(inventory).toContain("rel=self");
    expect(inventory).toContain("rel=label");
    expect(inventory).toContain("index=0");
  });
});

describe("inspectLabelArtifact", () => {
  it("reads text out of a FlateDecode stream", () => {
    const pdf = deflatedPdf("BT (Parcels - Detailed Manifest) Tj ET");

    expect(extractPdfText(pdf)).toContain("Parcels - Detailed Manifest");
  });

  it("rejects the manifest hardcopy of a group shipment", () => {
    const result = inspectLabelArtifact(plainPdf("BT (Parcels - Detailed Manifest) Tj ET"), PIN);

    expect(result.verdict).toBe("not-a-label");
    expect(result.testDocument).toBe(false);
    expect(result.reason).toContain("manifest");
  });

  it("rejects a [Test] app sample and names the real cause", () => {
    const pdf = deflatedPdf("BT (Manifest / Manifeste 1/1 Page) Tj ET (fins de test uniquement) Tj ET");

    const result = inspectLabelArtifact(pdf, PIN);

    expect(result.verdict).toBe("not-a-label");
    expect(result.testDocument).toBe(true);
    expect(result.reason).toContain("[Test] app");
  });

  it("recognises a real label by its tracking PIN, even when the text is hex encoded", () => {
    const hex = Buffer.from(`PIN ${PIN}`, "latin1").toString("hex").toUpperCase();
    const result = inspectLabelArtifact(plainPdf(`BT <${hex}> Tj ET`), PIN);

    expect(result.verdict).toBe("label");
    expect(result.reason).toBeNull();
  });

  it("detects the watermark in the wording Canada Post really prints", () => {
    // "For Testing Purposes Only" — not "Test purposes only", which is how a
    // [Test] sample slipped through as a label.
    const result = inspectLabelArtifact(
      plainPdf("BT (For Testing Purposes Only) Tj ET"),
      PIN
    );

    expect(result.testDocument).toBe(true);
    expect(result.verdict).toBe("not-a-label");
    expect(result.reason).toContain("[Test] app");
  });

  it("accepts watermarked PDF as a valid label when CANADAPOST_SANDBOX is enabled", () => {
    process.env.CANADAPOST_SANDBOX = "true";
    try {
      const result = inspectLabelArtifact(
        plainPdf("BT (For Testing Purposes Only) Tj ET"),
        PIN
      );

      expect(result.testDocument).toBe(true);
      expect(result.verdict).toBe("label");
      expect(result.reason).toContain("[Test] app");
    } finally {
      delete process.env.CANADAPOST_SANDBOX;
    }
  });

  it("flags a document it cannot confirm instead of trusting it", () => {
    const result = inspectLabelArtifact(plainPdf("BT (something else entirely) Tj ET"), PIN);

    expect(result.verdict).toBe("unverified");
    expect(result.reason).toContain(PIN);
  });
});

/**
 * The artifact endpoint content-negotiates on Accept: the same URL serves the
 * PDF artifact and the ZPL printable label. On a [Test] app the PDF is a
 * deposit summary, so the ZPL representation is the document an admin prints.
 */
const ARTIFACT_URL =
  "https://api.canadapost-postescanada.ca/prod/devportal-portaildesdeveloppeurs" +
  "/shipping/v1/artifacts/f4afdd45b22bae36/shipping/10001624319/0";

/** ZPL the way Canada Post serves a label: a Code 128 barcode of the PIN. */
function labelZpl(pin = PIN): string {
  return [
    "^XA",
    "^CI13",
    "^PW812",
    "^LL1218",
    "^FO73,658^BY3,2,120",
    `^FO73,658^BCN,154,Y,N,N^FD${pin}^FS`,
    "^FO32,800^A0N,30,30^FDTRACKING NUMBER^FS",
    "^XZ",
  ].join("\n");
}

/**
 * The 4x6 label FORM a [Test] app actually serves: the real canvas and barcode
 * command from Canada Post's sample, watermarked, with the barcode field left
 * empty and no tracking PIN anywhere in it.
 */
function sandboxSampleZpl(): string {
  return [
    "",
    "^XA",
    "^CI13",
    "^MMT",
    "^PW812",
    "^LL1218",
    "^FO32,81^FT32,81^A0N,23,18^FDFor Testing Purposes Only^FS",
    "^FO32,104^FT32,104^A0N,23,18^FDdes fins de test uniquement^FS",
    "^FO296,162^A0N,19,18^FDExpedited Parcel^FS",
    "^FO22,284^FT22,284^A0N,30,24^FDPETE PICKUP^FS",
    "^FO73,658^BY3^BCN,154^FS",
    "^FO22,850^FT22,850^A0N,20,16^FDTRACKING NUMBER^FS",
    "^FO529,1010^FT529,1010^A0N,20,16^FDMANIFEST REQ^FS",
    "^FO235,1106^FT235,1106^A0N,20,16^FDPIN / NIP:^FS",
    "^XZ",
  ].join("\n");
}

describe("Canada Post artifact representations (PDF vs ZPL)", () => {
  let calls: { url: string; accept: string }[] = [];

  /** Stub the OAuth call plus the artifact endpoint, recording the Accept header. */
  function stubArtifact(handler: (accept: string) => Response) {
    calls = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const url =
          typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
        const accept = ((init?.headers as Record<string, string>) ?? {}).Accept ?? "";

        if (url.includes("/oauth2/token")) {
          return new Response(JSON.stringify({ access_token: "test-token", expires_in: 3600 }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }

        calls.push({ url, accept });
        return handler(accept);
      })
    );
  }

  beforeEach(() => {
    process.env.CANADAPOST_API_KEY = "test-client-id";
    process.env.CANADAPOST_SECRET_KEY = "test-client-secret";
    process.env.CANADAPOST_CUSTOMER_NUMBER = "0007023211";
    process.env.CANADAPOST_ORIGIN_POSTAL = "M5V 3L9";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("requests the printable label with Accept: application/zpl", async () => {
    stubArtifact(
      () =>
        new Response(labelZpl(), {
          status: 200,
          headers: { "Content-Type": "application/zpl" },
        })
    );
    const { getShipmentLabelZpl } = await import("@/lib/canadapost");

    const zpl = await getShipmentLabelZpl(ARTIFACT_URL);

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(ARTIFACT_URL);
    expect(calls[0].accept).toBe("application/zpl");
    expect(zpl).toContain("^BC");
    expect(inspectZplLabel(zpl, PIN).verdict).toBe("label");
  });

  it("requests the PDF artifact with Accept: application/pdf", async () => {
    stubArtifact(
      () =>
        new Response(plainPdf("BT (Parcels - Detailed Manifest) Tj ET"), {
          status: 200,
          headers: { "Content-Type": "application/pdf" },
        })
    );
    const { getShipmentLabelPdf } = await import("@/lib/canadapost");

    const pdf = await getShipmentLabelPdf(ARTIFACT_URL);

    expect(calls[0].accept).toBe("application/pdf");
    expect(inspectLabelArtifact(pdf, PIN).verdict).toBe("not-a-label");
  });

  it("treats 406 Not Acceptable (no such representation) as a Canada Post error", async () => {
    stubArtifact(() => new Response("", { status: 406 }));
    const { getShipmentLabelZpl, CanadaPostError } = await import("@/lib/canadapost");

    const error = (await getShipmentLabelZpl(ARTIFACT_URL).catch((e) => e)) as Error;

    expect(error).toBeInstanceOf(CanadaPostError);
    expect(error.message).toContain("Label (ZPL) fetch failed (HTTP 406)");
  });
});

describe("inspectZplLabel", () => {
  it("accepts a label whose barcode carries the tracking PIN", () => {
    const result = inspectZplLabel(labelZpl(), PIN);

    expect(result.verdict).toBe("label");
    expect(result.reason).toBeNull();
  });

  it("accepts a label that prints the PIN without a Code 128 command", () => {
    expect(inspectZplLabel(`^XA^FO10,10^A0N,20,20^FD${PIN}^FS^XZ`, PIN).verdict).toBe("label");
  });

  it("never accepts a deposit-summary or detailed-manifest ZPL document", () => {
    const summary = inspectZplLabel("^XA^PW812^LL1218^FDDEPOSIT SUMMARY^FS^XZ", PIN);
    const manifest = inspectZplLabel(
      "^XA^PW812^LL1218^FDParcels - Detailed Manifest^FS^XZ",
      PIN
    );

    expect(summary.verdict).toBe("not-a-label");
    expect(summary.reason).toContain("DEPOSIT SUMMARY");
    expect(manifest.verdict).toBe("not-a-label");
    expect(manifest.reason).toContain("DETAILED MANIFEST");
  });

  it("accepts a [Test] sample label form but reports it as test data", () => {
    const result = inspectZplLabel(sandboxSampleZpl(), PIN);

    // The "MANIFEST REQ" field caption on a label form is not a manifest
    // document, and the empty barcode is not evidence of a different document.
    expect(result.verdict).toBe("label");
    expect(result.testDocument).toBe(true);
    expect(result.hasTrackingData).toBe(false);
    expect(result.reason).toContain("[Test]");
  });

  it("detects the English-only watermark on a label form", () => {
    const zpl = ["^XA", "^PW812", "^LL1218", "^BY3^BCN,154^FS", "^FDFor Testing Purposes Only^FS", "^XZ"].join("\n");

    const result = inspectZplLabel(zpl, PIN);

    expect(result.verdict).toBe("label");
    expect(result.testDocument).toBe(true);
    expect(result.reason).toContain("[Test]");
    expect(result.reason).toContain("[Production]");
  });

  it("reports tracking data when the barcode field is filled", () => {
    const result = inspectZplLabel(labelZpl(), PIN);

    expect(result.hasTrackingData).toBe(true);
    expect(result.testDocument).toBe(false);
    expect(result.reason).toBeNull();
  });

  it("flags a ZPL stream with neither a barcode nor the PIN", () => {
    const result = inspectZplLabel("^XA^FO10,10^A0N,20,20^FDNOTHING HERE^FS^XZ", PIN);

    expect(result.verdict).toBe("unverified");
    expect(result.reason).toContain(PIN);
  });
});
