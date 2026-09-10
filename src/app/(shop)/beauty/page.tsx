import CategoryPage from "@/app/(shop)/category/CategoryPage";
import type { Metadata } from "next";
import { absoluteUrl, getActiveCategory, JsonLd, truncateDescription } from "@/lib/seo";

const fallbackDescription = "Discover beauty essentials curated for your everyday routine, from makeup and fragrances to beauty tools.";

export async function generateMetadata(): Promise<Metadata> {
  const category = await getActiveCategory("beauty");
  const description = truncateDescription(category?.description, fallbackDescription);
  return {
    title: "Beauty Products",
    description,
    alternates: { canonical: absoluteUrl("/beauty") },
    openGraph: { title: "Beauty Products | Arade", description, url: absoluteUrl("/beauty"), type: "website" },
  };
}

export default async function BeautyPage() {
  const category = await getActiveCategory("beauty");
  return <><JsonLd data={{ "@context": "https://schema.org", "@type": "CollectionPage", name: category?.name || "Beauty", description: category?.description || fallbackDescription, url: absoluteUrl("/beauty"), isPartOf: { "@type": "WebSite", name: "Arade", url: absoluteUrl("/") } }} /><CategoryPage categorySlug="beauty" title="Beauty" description="Discover beauty essentials curated for your everyday routine. From makeup to fragrances, find everything you need to express your style." /></>;
}
