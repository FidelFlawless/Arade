import { absoluteUrl } from "@/lib/seo";

/**
 * "Parent > Leaf" product_type from the ACTUAL database category tree.
 * Never uses the static constants; returns null when the category is unknown.
 */
export function buildProductType(
  product: FeedProductRow,
  categoriesById: Map<string, FeedCategoryRow>
): string | null {
  if (!product.category_id) return null;
  const leaf = categoriesById.get(product.category_id);
  if (!leaf?.name) return null;
  if (!leaf.parent_category_id) return cleanText(leaf.name);
  const parent = categoriesById.get(leaf.parent_category_id);
  const parentName = parent?.name ? cleanText(parent.name) : null;
  const leafName = cleanText(leaf.name);
  return parentName ? `${parentName} > ${leafName}` : leafName;
}

/**
 * Build one <item> block, or null when the product row is malformed/incomplete
 * (so a single bad row can never break the whole feed).
 */
export function buildFeedItem(
  product: FeedProductRow,
  categoriesById: Map<string, FeedCategoryRow>,
  googleCategoriesBySlug: Map<string, string>,
  country: FeedCountry
): string | null {
  try {
    const sku = cleanText(product.sku);
    const name = cleanText(product.name);
    const description = cleanText(product.description);
    const slug = cleanText(product.slug);
    const brand = cleanText(product.brand);

    if (!sku || !name || !description || !slug) return null;

    const price = feedPrice(product, country);
    if (!price) return null;

    const images = resolveFeedImages(product.images);
    if (images.length === 0) return null;

    const productType = buildProductType(product, categoriesById);

    const leaf = product.category_id ? categoriesById.get(product.category_id) : null;
    const googleCategory = (leaf?.slug && googleCategoriesBySlug.get(leaf.slug)) || null;

    const lines: string[] = [
      "<item>",
      `  <g:id>${escapeXml(sku)}</g:id>`,
      `  <title>${escapeXml(name)}</title>`,
      `  <description>${escapeXml(description)}</description>`,
      `  <g:link>${escapeXml(absoluteUrl(`/product/${slug}`))}</g:link>`,
      `  <g:image_link>${escapeXml(images[0])}</g:image_link>`,
    ];

    for (const additional of images.slice(1, 1 + MAX_ADDITIONAL_IMAGES)) {
      lines.push(`  <g:additional_image_link>${escapeXml(additional)}</g:additional_image_link>`);
    }

    lines.push(`  <g:condition>${FEED_CONDITION}</g:condition>`);
    lines.push(`  <g:availability>${feedAvailability(product)}</g:availability>`);
    lines.push(`  <g:price>${escapeXml(price)}</g:price>`);

    // Brand only when genuinely present - never fabricated.
    if (brand) lines.push(`  <g:brand>${escapeXml(brand)}</g:brand>`);

    // Explicitly declare that unique identifiers (GTIN/MPN) do not exist for these products.
    // Prevents Google Merchant Center disapprovals / warnings for custom/artisan items.
    lines.push("  <g:identifier_exists>no</g:identifier_exists>");

    if (productType) lines.push(`  <g:product_type>${escapeXml(productType)}</g:product_type>`);
    if (googleCategory) {
      lines.push(`  <g:google_product_category>${escapeXml(googleCategory)}</g:google_product_category>`);
    }

    lines.push("</item>");
    return lines.join("\n");
  } catch {
    // A malformed row must never break the entire XML response.
    return null;
  }
}

/** Build the complete RSS 2.0 + g: namespace feed document. */
export function buildFeedXml(
  products: FeedProductRow[],
  categories: FeedCategoryRow[],
  country: FeedCountry
): { xml: string; emitted: number; skipped: number } {
  const categoriesById = new Map(categories.map((category) => [category.id, category]));
  const googleCategoriesBySlug = new Map(Object.entries(GOOGLE_PRODUCT_CATEGORY_BY_LEAF_SLUG));

  const items: string[] = [];
  let skipped = 0;

  for (const product of products) {
    const item = buildFeedItem(product, categoriesById, googleCategoriesBySlug, country);
    if (item) items.push(item);
    else skipped += 1;
  }

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">',
    "<channel>",
    `  <title>${escapeXml("Arade Products")}</title>`,
    `  <link>${escapeXml(absoluteUrl("/"))}</link>`,
    `  <description>${escapeXml("Google Merchant Center product feed for Arade.")}</description>`,
    ...items,
    "</channel>",
    "</rss>",
    "",
  ].join("\n");

  return { xml, emitted: items.length, skipped };
}


/**
 * Google Merchant Center product feed builders (pure functions, no I/O).
 *
 * Data sources: only public, anon-readable catalog columns (products,
 * categories). No customer, order, payment, settings or auth data is accepted
 * or emitted. No GTIN/MPN/taxonomy values are ever invented here.
 *
 * Reference: Google Merchant Center product data specification (RSS 2.0 with
 * the http://base.google.com/ns/1.0 "g:" namespace).
 */

export type FeedCountry = "CA" | "US";

/**
 * Product condition. The storefront's Product JSON-LD already declares
 * schema.org/NewCondition for every product (existing convention), so the feed
 * mirrors that. NOTE: formal business sign-off of "new" for all products is
 * still pending (Stage 2H-1); change this single constant if that changes.
 */
export const FEED_CONDITION = "new";

/** Google allows at most 10 additional images per item (11 total). */
const MAX_ADDITIONAL_IMAGES = 10;

export interface FeedProductRow {
  sku: string | null;
  name: string | null;
  description: string | null;
  slug: string | null;
  images: string[] | null;
  stock_quantity: number | null;
  is_active: boolean | null;
  price_cad: number | null;
  price_usd: number | null;
  brand: string | null;
  category_id: string | null;
}

export interface FeedCategoryRow {
  id: string;
  name: string | null;
  slug: string | null;
  parent_category_id: string | null;
}

/**
 * Google product taxonomy mapping, keyed by Arade leaf-category slug.
 *
 * INTENTIONALLY EMPTY: no verified taxonomy mapping exists yet (Stage 2H-1).
 * Never guess taxonomy values. Once the business approves mappings, add
 * entries here (Google integer category IDs or full taxonomy paths) and the
 * feed will emit <g:google_product_category> automatically.
 *
 * Populated leaf categories still needing a mapping decision (live DB):
 *   moisturizers, soaps, skincare-sets, body-care, cream, serum,
 *   cleansers-scrubs, wigs
 */
export const GOOGLE_PRODUCT_CATEGORY_BY_LEAF_SLUG: Record<string, string> = {};

/** Strict country validation - never silently default to a market. */
export function resolveFeedCountry(value: string | null | undefined): FeedCountry | null {
  if (value === "CA" || value === "US") return value;
  return null;
}

/**
 * Escape text for XML text/attribute nodes and strip control characters that
 * are illegal in XML 1.0 (keeps the feed well-formed for any catalog content).
 */
export function escapeXml(value: string): string {
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

/** GMC price format: "<amount> <currency>" with exactly 2 decimals. */
export function formatGmcPrice(amount: number, currency: "CAD" | "USD"): string {
  if (!Number.isFinite(amount) || amount <= 0) return "";
  return `${amount.toFixed(2)} ${currency}`;
}

/** Storefront-supported states only: in_stock / out_of_stock (no preorder). */
export function feedAvailability(product: FeedProductRow): "in_stock" | "out_of_stock" {
  return (product.stock_quantity ?? 0) > 0 ? "in_stock" : "out_of_stock";
}

/** Country-specific price string, or null when the product has no valid price. */
export function feedPrice(product: FeedProductRow, country: FeedCountry): string | null {
  const amount = country === "CA" ? product.price_cad : product.price_usd;
  const price = formatGmcPrice(Number(amount), country === "CA" ? "CAD" : "USD");
  return price || null;
}

/**
 * Resolve product images to valid public absolute URLs.
 * Relative paths (legacy rows) are resolved against the canonical www host;
 * anything else (private paths, data URIs, garbage) is skipped.
 */
export function resolveFeedImages(images: unknown): string[] {
  if (!Array.isArray(images)) return [];
  const resolved: string[] = [];
  for (const image of images) {
    if (typeof image !== "string") continue;
    const trimmed = image.trim();
    if (!trimmed) continue;
    if (/^https?:\/\//i.test(trimmed)) {
      resolved.push(trimmed);
    } else if (trimmed.startsWith("/")) {
      resolved.push(absoluteUrl(trimmed));
    }
  }
  return resolved;
}

let cacheResetHandler: (() => void) | null = null;

export function registerFeedCacheReset(handler: () => void): void {
  cacheResetHandler = handler;
}

export function __resetFeedCacheForTests(): void {
  cacheResetHandler?.();
}
