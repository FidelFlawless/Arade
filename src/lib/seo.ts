import { createClient } from "@/lib/supabase/server";
import { createElement } from "react";
import type { Metadata } from "next";

// Arade's canonical host is https://www.aradeshop.com. The apex domain
// (aradeshop.com) 308-redirects to www, so every absolute SEO URL - canonical,
// og:url, JSON-LD, sitemap and robots - must point at the www host directly
// rather than at a URL that redirects.
const CANONICAL_SITE_URL = "https://www.aradeshop.com";

const configuredSiteUrl = (process.env.NEXT_PUBLIC_SITE_URL || CANONICAL_SITE_URL).replace(/\/+$/, "");

// Normalizes a legacy apex-domain configuration to the canonical www host so
// stale environment values cannot reintroduce the canonical/host mismatch.
export const SITE_URL = /^https?:\/\/aradeshop\.com$/i.test(configuredSiteUrl)
  ? CANONICAL_SITE_URL
  : configuredSiteUrl;
export const SITE_NAME = "Arade";
export const DEFAULT_OG_IMAGE = "/og-image.webp";

export function absoluteUrl(path = "") {
  if (/^https?:\/\//i.test(path)) return path;
  return `${SITE_URL}/${path.replace(/^\//, "")}`;
}

export function truncateDescription(value: string | null | undefined, fallback: string) {
  const text = value?.replace(/\s+/g, " ").trim() || fallback;
  return text.length > 125 ? `${text.slice(0, 122).trimEnd()}...` : text;
}

/**
 * Build complete page-level metadata.
 *
 * Next.js shallow-merges metadata, so a page-level `openGraph` object REPLACES
 * the root layout's `openGraph` wholesale. Pages that exported a partial
 * openGraph (title/description/url only) silently lost og:site_name and
 * og:image. This helper always emits the full object set - title, description,
 * canonical, complete openGraph (siteName/images/url/type) and twitter card -
 * so every public page carries consistent metadata without duplicating it
 * page by page.
 */
export function buildPageMetadata(options: {
  title: string;
  description: string;
  /** Path beginning with "/" - resolved against the canonical www host. */
  path: string;
  /** Optional distinct OpenGraph/Twitter title (defaults to the page title). */
  ogTitle?: string;
  index?: boolean;
}): Metadata {
  const { title, description, path, ogTitle, index = true } = options;
  const url = absoluteUrl(path);
  const ogImage = absoluteUrl(DEFAULT_OG_IMAGE);

  return {
    title,
    description,
    alternates: { canonical: url },
    robots: index ? { index: true, follow: true } : { index: false, follow: true },
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      title: ogTitle ?? title,
      description,
      url,
      images: [{ url: ogImage, alt: "Arade beauty and fashion products" }],
    },
    twitter: {
      card: "summary_large_image",
      title: ogTitle ?? title,
      description,
      images: [ogImage],
    },
  };
}

/**
 * Count active products across a top-level category tree (the category itself
 * plus its active subcategories) - the same scope the category page renders.
 * Used to keep empty parent categories out of the index while they are empty.
 */
export async function countActiveCategoryProducts(slug: string): Promise<number> {
  const supabase = await createClient();

  const { data: mainCat } = await supabase
    .from("categories")
    .select("id")
    .eq("slug", slug)
    .eq("is_active", true)
    .single();
  if (!mainCat) return 0;

  const { data: subs } = await supabase
    .from("categories")
    .select("id")
    .eq("parent_category_id", mainCat.id)
    .eq("is_active", true);

  const ids = [...(subs || []).map((sub) => sub.id), mainCat.id];
  const { count } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("is_active", true)
    .in("category_id", ids);

  return count ?? 0;
}

export function JsonLd({ data }: { data: Record<string, unknown> }) {
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return createElement("script", {
    type: "application/ld+json",
    dangerouslySetInnerHTML: { __html: json },
  });
}

export async function getActiveCategory(slug: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("categories")
    .select("name, slug, description, image_url, parent_category_id, is_active")
    .eq("slug", slug)
    .eq("is_active", true)
    .single();
  return data;
}
