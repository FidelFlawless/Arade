import type { MetadataRoute } from "next";
import { createClient } from "@/lib/supabase/server";
import { absoluteUrl } from "@/lib/seo";

const staticPages = [
  { path: "/", priority: 1, changeFrequency: "weekly" as const },
  { path: "/shop", priority: 0.9, changeFrequency: "daily" as const },
  { path: "/collection", priority: 0.8, changeFrequency: "weekly" as const },
  { path: "/about", priority: 0.6, changeFrequency: "monthly" as const },
  { path: "/contact", priority: 0.5, changeFrequency: "monthly" as const },
  { path: "/faq", priority: 0.5, changeFrequency: "monthly" as const },
  { path: "/privacy", priority: 0.3, changeFrequency: "yearly" as const },
  { path: "/terms", priority: 0.3, changeFrequency: "yearly" as const },
  { path: "/shipping", priority: 0.5, changeFrequency: "yearly" as const },
  { path: "/returns", priority: 0.5, changeFrequency: "yearly" as const },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = await createClient();
  const [{ data: categories }, { data: products }] = await Promise.all([
    supabase
      .from("categories")
      .select("id, slug, parent_category_id, updated_at")
      .eq("is_active", true),
    supabase
      .from("products")
      .select("slug, category_id, updated_at")
      .eq("is_active", true),
  ]);

  const pages: MetadataRoute.Sitemap = staticPages.map((page) => ({
    url: absoluteUrl(page.path),
    changeFrequency: page.changeFrequency,
    priority: page.priority,
  }));

  // Only list top-level categories that actually contain active products
  // (directly or in a subcategory). Empty parents are noindex, so they must
  // not be advertised in the sitemap; they reappear automatically once a
  // product is assigned to their tree.
  const categoryById = new Map((categories || []).map((c) => [c.id, c]));
  const parentsWithProducts = new Set<string>();
  for (const product of products || []) {
    let current = categoryById.get(product.category_id);
    const seen = new Set<string>();
    while (current && !seen.has(current.id)) {
      seen.add(current.id);
      if (!current.parent_category_id) {
        parentsWithProducts.add(current.id);
        break;
      }
      current = categoryById.get(current.parent_category_id);
    }
  }

  const categoryPages = (categories || [])
    .filter((c) => !c.parent_category_id && parentsWithProducts.has(c.id))
    .map((category) => ({
      url: absoluteUrl(`/${category.slug}`),
      lastModified: category.updated_at,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }));

  const productPages = (products || []).map((product) => ({
    url: absoluteUrl(`/product/${product.slug}`),
    lastModified: product.updated_at,
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  return [...pages, ...categoryPages, ...productPages];
}