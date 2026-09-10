import CategoryPage from "@/app/(shop)/category/CategoryPage";
import type { Metadata } from "next";
import { absoluteUrl, getActiveCategory, JsonLd, truncateDescription } from "@/lib/seo";

const fallbackDescription = "Find dresses, tops and fashion accessories curated to express your personal style for every occasion.";

export async function generateMetadata(): Promise<Metadata> {
  const category = await getActiveCategory("fashion");
  const description = truncateDescription(category?.description, fallbackDescription);
  return {
    title: "Fashion Products",
    description,
    alternates: { canonical: absoluteUrl("/fashion") },
    openGraph: { title: "Fashion Products | Arade", description, url: absoluteUrl("/fashion"), type: "website" },
  };
}

export default async function FashionPage() {
  const category = await getActiveCategory("fashion");
  return <><JsonLd data={{ "@context": "https://schema.org", "@type": "CollectionPage", name: category?.name || "Fashion", description: category?.description || fallbackDescription, url: absoluteUrl("/fashion"), isPartOf: { "@type": "WebSite", name: "Arade", url: absoluteUrl("/") } }} /><CategoryPage categorySlug="fashion" title="Fashion" description="Find pieces that express your personal style. Dresses, tops and accessories curated for every occasion." /></>;
}
