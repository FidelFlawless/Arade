import CategoryPage from "@/app/(shop)/category/CategoryPage";
import type { Metadata } from "next";
import { absoluteUrl, getActiveCategory, JsonLd, truncateDescription } from "@/lib/seo";

const fallbackDescription = "Explore wigs, hair care and accessories selected to help you create and maintain your desired look.";

export async function generateMetadata(): Promise<Metadata> {
  const category = await getActiveCategory("hair");
  const description = truncateDescription(category?.description, fallbackDescription);
  return {
    title: "Hair Products",
    description,
    alternates: { canonical: absoluteUrl("/hair") },
    openGraph: { title: "Hair Products | Arade", description, url: absoluteUrl("/hair"), type: "website" },
  };
}

export default async function HairPage() {
  const category = await getActiveCategory("hair");
  return <><JsonLd data={{ "@context": "https://schema.org", "@type": "CollectionPage", name: category?.name || "Hair", description: category?.description || fallbackDescription, url: absoluteUrl("/hair"), isPartOf: { "@type": "WebSite", name: "Arade", url: absoluteUrl("/") } }} /><CategoryPage categorySlug="hair" title="Hair" description="Explore wigs, hair care and accessories. Quality products to help you achieve your desired look." /></>;
}
