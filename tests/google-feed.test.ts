import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

/**
 * Stage 2H-2 — Google Merchant Center product feed tests.
 *
 * Self-contained: mocks the public Supabase server client inline so the route
 * is exercised end-to-end (HTTP Response + XML) without hitting the network.
 *
 * Covers all 21 minimum checks required by the Stage 2H-2 specification.
 */

const mocks = vi.hoisted(() => {
  const results: Record<string, { list?: unknown[] }> = {};

  const buildQuery = (table: string) => {
    let rows = (results[table]?.list ?? []) as Record<string, unknown>[];
    const query: Record<string, unknown> = {
      eq: (col: string, val: unknown) => {
        rows = rows.filter((r) => r[col] === val);
        return query;
      },
      select: () => query,
      in: () => query,
      order: () => query,
      limit: () => query,
      neq: () => query,
    };
    query.then = (resolve: (value: unknown) => unknown) =>
      Promise.resolve({ data: rows, error: null }).then(resolve);
    return query;
  };

  return { results, buildQuery };
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ from: (table: string) => mocks.buildQuery(table) }),
}));

import { GET as feedGET } from "@/app/api/feeds/google-products.xml/route";
import {
  __resetFeedCacheForTests,
  type FeedCategoryRow,
  type FeedProductRow,
} from "@/lib/feeds/google-products";

const BASE_URL = "http://localhost:3000";

function feedRequest(query = "") {
  return new Request(`${BASE_URL}/api/feeds/google-products.xml${query}`) as never;
}

function makeProduct(overrides: Partial<FeedProductRow> = {}): FeedProductRow {
  return {
    sku: "SKU-1",
    name: "Test Product",
    description: "A factual test description.",
    slug: "test-product",
    images: ["https://adlrsmjmgiqifgfejkjn.supabase.co/storage/v1/object/public/products/a.png"],
    stock_quantity: 5,
    is_active: true,
    price_cad: 24.5,
    price_usd: 18.25,
    brand: "TestBrand",
    category_id: "leaf-1",
    ...overrides,
  };
}

const CATEGORIES: (FeedCategoryRow & { is_active: boolean })[] = [
  { id: "parent-1", name: "Skincare", slug: "skincare", parent_category_id: null, is_active: true },
  { id: "leaf-1", name: "Body Care", slug: "body-care", parent_category_id: "parent-1", is_active: true },
  { id: "leaf-2", name: "Wigs", slug: "wigs", parent_category_id: "parent-2", is_active: true },
];

const CATALOG_PRODUCTS: FeedProductRow[] = [
  makeProduct({ sku: "SKU-CA-1", name: "Glow & Radiance Lotion", price_cad: 24.5, price_usd: 18.25 }),
  makeProduct({
    sku: "SKU-OUT-1",
    name: "Out of Stock Item",
    slug: "out-of-stock-item",
    stock_quantity: 0,
    price_cad: 30,
    price_usd: 22,
    brand: null,
  }),
  makeProduct({
    sku: "SKU-IMG-1",
    name: "Multi Image Item",
    slug: "multi-image-item",
    images: [
      "https://adlrsmjmgiqifgfejkjn.supabase.co/storage/v1/object/public/products/one.png",
      "https://adlrsmjmgiqifgfejkjn.supabase.co/storage/v1/object/public/products/two.png",
      "https://adlrsmjmgiqifgfejkjn.supabase.co/storage/v1/object/public/products/three.png",
    ],
  }),
];

function loadCatalog() {
  mocks.results.products = { list: CATALOG_PRODUCTS };
  mocks.results.categories = { list: CATEGORIES };
}

beforeEach(() => {
  vi.resetAllMocks();
  __resetFeedCacheForTests();
  Object.keys(mocks.results).forEach((key) => delete mocks.results[key]);
  loadCatalog();
});

describe("Stage 2H-2 — Feed Specifications (21 checks)", () => {
  // Check 1: CA feed returns HTTP 200
  it("check 1: CA feed returns HTTP 200", async () => {
    const res = await feedGET(feedRequest("?country=CA"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/xml");
  });

  // Check 2: US feed returns HTTP 200
  it("check 2: US feed returns HTTP 200", async () => {
    const res = await feedGET(feedRequest("?country=US"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/xml");
  });

  // Check 3: missing country returns 400
  it("check 3: missing country returns 400", async () => {
    const res = await feedGET(feedRequest());
    expect(res.status).toBe(400);
    expect(await res.text()).toMatch(/country/i);
  });

  // Check 4: invalid country returns 400
  it("check 4: invalid country returns 400", async () => {
    const res = await feedGET(feedRequest("?country=MX"));
    expect(res.status).toBe(400);
  });

  // Check 5: CA products use price_cad
  it("check 5: CA products use price_cad", async () => {
    const res = await feedGET(feedRequest("?country=CA"));
    const xml = await res.text();
    expect(xml).toContain("<g:price>24.50 CAD</g:price>");
  });

  // Check 6: US products use price_usd
  it("check 6: US products use price_usd", async () => {
    const res = await feedGET(feedRequest("?country=US"));
    const xml = await res.text();
    expect(xml).toContain("<g:price>18.25 USD</g:price>");
  });

  // Check 7: CA currency is CAD
  it("check 7: CA currency is CAD", async () => {
    const res = await feedGET(feedRequest("?country=CA"));
    const xml = await res.text();
    expect(xml).toContain(" CAD</g:price>");
    expect(xml).not.toContain(" USD</g:price>");
  });

  // Check 8: US currency is USD
  it("check 8: US currency is USD", async () => {
    const res = await feedGET(feedRequest("?country=US"));
    const xml = await res.text();
    expect(xml).toContain(" USD</g:price>");
    expect(xml).not.toContain(" CAD</g:price>");
  });

  // Check 9: IDs are SKUs
  it("check 9: IDs are SKUs", async () => {
    const res = await feedGET(feedRequest("?country=CA"));
    const xml = await res.text();
    expect(xml).toContain("<g:id>SKU-CA-1</g:id>");
  });

  // Check 10: only active products appear
  it("check 10: only active products appear", async () => {
    __resetFeedCacheForTests();
    mocks.results.products = {
      list: [
        makeProduct({ sku: "SKU-ACTIVE", is_active: true }),
        makeProduct({ sku: "SKU-INACTIVE", is_active: false }),
      ],
    };
    const res = await feedGET(feedRequest("?country=CA"));
    const xml = await res.text();
    expect(xml).toContain("<g:id>SKU-ACTIVE</g:id>");
    expect(xml).not.toContain("<g:id>SKU-INACTIVE</g:id>");
  });

  // Check 11: stock > 0 → in_stock
  it("check 11: stock > 0 maps to in_stock", async () => {
    const res = await feedGET(feedRequest("?country=CA"));
    const xml = await res.text();
    expect(xml).toContain("<g:availability>in_stock</g:availability>");
  });

  // Check 12: stock <= 0 → out_of_stock
  it("check 12: stock <= 0 maps to out_of_stock", async () => {
    const res = await feedGET(feedRequest("?country=CA"));
    const xml = await res.text();
    expect(xml).toContain("<g:availability>out_of_stock</g:availability>");
  });

  // Check 13: product links use www.aradeshop.com
  it("check 13: product links use www.aradeshop.com", async () => {
    const res = await feedGET(feedRequest("?country=CA"));
    const xml = await res.text();
    expect(xml).toContain("https://www.aradeshop.com/product/test-product");
    expect(xml).not.toContain("http://aradeshop.com");
  });

  // Check 14: image URLs are absolute
  it("check 14: image URLs are absolute", async () => {
    const res = await feedGET(feedRequest("?country=CA"));
    const xml = await res.text();
    expect(xml).toContain("<g:image_link>https://adlrsmjmgiqifgfejkjn.supabase.co/storage/v1/object/public/products/");
  });

  // Check 15: additional images are emitted when present
  it("check 15: additional images are emitted when present", async () => {
    const res = await feedGET(feedRequest("?country=CA"));
    const xml = await res.text();
    expect(xml).toContain("<g:additional_image_link>https://adlrsmjmgiqifgfejkjn.supabase.co/storage/v1/object/public/products/two.png</g:additional_image_link>");
    expect(xml).toContain("<g:additional_image_link>https://adlrsmjmgiqifgfejkjn.supabase.co/storage/v1/object/public/products/three.png</g:additional_image_link>");
  });

  // Check 16: missing brand does not generate a fake brand
  it("check 16: missing brand does not generate a fake brand", async () => {
    const res = await feedGET(feedRequest("?country=CA"));
    const xml = await res.text();
    expect(xml).toContain("<g:brand>TestBrand</g:brand>");
    expect(xml).not.toMatch(/<g:brand>\s*<\/g:brand>/);
    expect(xml).not.toContain("Generic");
    expect(xml).not.toContain("Unknown");
  });

  // Check 17: GTIN is never fabricated
  it("check 17: GTIN is never fabricated", async () => {
    const res = await feedGET(feedRequest("?country=CA"));
    const xml = await res.text();
    expect(xml).not.toContain("<g:gtin>");
    expect(xml).not.toContain("<g:mpn>");
  });

  // Check 18: XML special characters are escaped
  it("check 18: XML special characters are escaped", async () => {
    __resetFeedCacheForTests();
    mocks.results.products = {
      list: [
        makeProduct({
          name: "Glow & Sheen <Special> Lotion",
          description: "Contains Shea & Coconut 'Pure' oils.",
        }),
      ],
    };
    const res = await feedGET(feedRequest("?country=CA"));
    const xml = await res.text();
    expect(xml).toContain("Glow &amp; Sheen &lt;Special&gt; Lotion");
    expect(xml).toContain("Contains Shea &amp; Coconut &apos;Pure&apos; oils.");
  });

  // Check 19: malformed products do not break the entire XML response
  it("check 19: malformed products do not break the entire XML response", async () => {
    __resetFeedCacheForTests();
    mocks.results.products = {
      list: [
        makeProduct(),
        makeProduct({ sku: null, name: "No SKU Item" }),
        makeProduct({ slug: "no-image", images: [], name: "No Image Item" }),
        makeProduct({ slug: "no-price", price_cad: null, price_usd: null, name: "No Price Item" }),
        makeProduct({ slug: "no-desc", description: null, name: "No Description Item" }),
      ],
    };
    const res = await feedGET(feedRequest("?country=CA"));
    expect(res.status).toBe(200);
    const xml = await res.text();
    expect(xml).toMatch(/^<\?xml version="1.0" encoding="UTF-8"\?>/);
    expect(xml.trim().endsWith("</rss>")).toBe(true);
    expect(xml.split("<item>").length - 1).toBe(1);
    expect(xml).toContain("<g:id>SKU-1</g:id>");
  });

  // Check 20: service-role key is not used
  it("check 20: service-role key is not used", () => {
    const content = readFileSync("src/app/api/feeds/google-products.xml/route.ts", "utf-8");
    expect(content).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY|createAdminClient|lib\/supabase\/admin/);
  });

  // Check 21: private customer/order/payment data is not exposed
  it("check 21: private customer/order/payment data is not exposed", async () => {
    const res = await feedGET(feedRequest("?country=CA"));
    const xml = await res.text();
    for (const forbidden of [
      "email",
      "customer",
      "order",
      "payment",
      "stripe",
      "paypal",
      "delivery_fee",
      "service_role",
      "token",
    ]) {
      expect(xml.toLowerCase()).not.toContain(forbidden);
    }
  });

  it("includes g:identifier_exists no and derives product_type from DB category tree", async () => {
    const res = await feedGET(feedRequest("?country=CA"));
    const xml = await res.text();
    expect(xml).toContain("<g:identifier_exists>no</g:identifier_exists>");
    expect(xml).toContain("<g:product_type>Skincare &gt; Body Care</g:product_type>");
  });
});
