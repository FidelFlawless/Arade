import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/beauty", "/skincare", "/hair", "/fashion", "/collection", "/product/"],
      disallow: ["/admin", "/account", "/auth", "/cart", "/checkout", "/order", "/api/"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}