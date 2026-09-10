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
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = await createClient();
  const [{ data: categories }, { data: products }] = await Promise.all([
    supabase
      .from("categories")
      .select("slug, updated_at")
      .is("parent_category_id", null)
      .eq("is_active", true),
    supabase
      .from("products")
      .select("slug, updated_at")
      .eq("is_active", true),
  ]);

  const pages: MetadataRoute.Sitemap = staticPages.map((page) => ({
    url: absoluteUrl(page.path),
    changeFrequency: page.changeFrequency,
    priority: page.priority,
  }));

  const categoryPages = (categories || []).map((category) => ({
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