import { createClient } from "@/lib/supabase/server";
import { createElement } from "react";

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://aradeshop.com").replace(/\/$/, "");
export const SITE_NAME = "Arade";
export const DEFAULT_OG_IMAGE = "/image.png";

export function absoluteUrl(path = "") {
  if (/^https?:\/\//i.test(path)) return path;
  return `${SITE_URL}/${path.replace(/^\//, "")}`;
}

export function truncateDescription(value: string | null | undefined, fallback: string) {
  const text = value?.replace(/\s+/g, " ").trim() || fallback;
  return text.length > 125 ? `${text.slice(0, 122).trimEnd()}...` : text;
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
