import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  buildFeedXml,
  registerFeedCacheReset,
  resolveFeedCountry,
  type FeedCategoryRow,
  type FeedCountry,
  type FeedProductRow,
} from "@/lib/feeds/google-products";

/**
 * Google Merchant Center product feed.
 *
 * GET /api/feeds/google-products.xml?country=CA  -> CAD feed (Canada)
 * GET /api/feeds/google-products.xml?country=US  -> USD feed (United States)
 *
 * - Reads ONLY anon-readable public catalog data (products + categories) via
 *   the normal public Supabase client. Never uses the service-role key or the
 *   privileged admin client factory.
 * - Emits only public product/catalog information - never customer, order,
 *   payment, settings or auth data.
 * - The country parameter is required and strictly validated (CA | US); there
 *   is no silent default because each feed carries exactly one currency.
 * - Catalog data is memoised for 10 minutes in-process and responses are also
 *   CDN-cacheable (s-maxage), so Google fetches never hammer Supabase while
 *   the feed still reflects catalog changes automatically within the TTL.
 */

const DATA_CACHE_TTL_MS = 10 * 60 * 1000;

interface CatalogData {
  products: FeedProductRow[];
  categories: FeedCategoryRow[];
}

let dataCache: { at: number; data: CatalogData } | null = null;

registerFeedCacheReset(() => {
  dataCache = null;
});

async function fetchCatalog(): Promise<CatalogData> {
  const supabase = await createClient();

  const [productsResult, categoriesResult] = await Promise.all([
    supabase
      .from("products")
      .select(
        "sku, name, description, slug, images, stock_quantity, is_active, price_cad, price_usd, brand, category_id"
      )
      .eq("is_active", true),
    supabase
      .from("categories")
      .select("id, name, slug, parent_category_id, is_active")
      .eq("is_active", true),
  ]);

  if (productsResult.error || categoriesResult.error) {
    throw new Error(
      productsResult.error?.message || categoriesResult.error?.message || "Feed query failed"
    );
  }

  return {
    products: (productsResult.data || []) as unknown as FeedProductRow[],
    categories: (categoriesResult.data || []) as unknown as CatalogData["categories"],
  };
}

async function getCatalog(): Promise<CatalogData> {
  if (dataCache && Date.now() - dataCache.at < DATA_CACHE_TTL_MS) {
    return dataCache.data;
  }
  const data = await fetchCatalog();
  dataCache = { at: Date.now(), data };
  return data;
}

export async function GET(req: NextRequest) {
  const country: FeedCountry | null = resolveFeedCountry(
    new URL(req.url).searchParams.get("country")
  );

  if (!country) {
    return new Response(
      "Missing or invalid 'country' query parameter. Append ?country=CA for the Canadian (CAD) feed or ?country=US for the United States (USD) feed.",
      {
        status: 400,
        headers: { "content-type": "text/plain; charset=utf-8" },
      }
    );
  }

  try {
    const { products, categories } = await getCatalog();
    const { xml, skipped } = buildFeedXml(products, categories, country);

    if (skipped > 0) {
      // Log only counts - never product or customer data.
      console.warn(`google feed (${country}): skipped ${skipped} malformed product row(s)`);
    }

    return new Response(xml, {
      status: 200,
      headers: {
        "content-type": "application/xml; charset=utf-8",
        "cache-control": "public, s-maxage=1800, stale-while-revalidate=3600",
      },
    });
  } catch (error) {
    console.error("google feed generation failed:", error instanceof Error ? error.message : error);
    return new Response("Feed temporarily unavailable. Please retry.", {
      status: 500,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
}
