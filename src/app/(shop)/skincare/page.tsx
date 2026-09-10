import CategoryPage from "@/app/(shop)/category/CategoryPage";
import type { Metadata } from "next";
import { absoluteUrl, getActiveCategory, JsonLd, truncateDescription } from "@/lib/seo";

const fallbackDescription = "Shop carefully selected skincare products for healthy, radiant skin, including cleansers, moisturizers and skincare sets.";

export async function generateMetadata(): Promise<Metadata> {
  const category = await getActiveCategory("skincare");
  const description = truncateDescription(category?.description, fallbackDescription);
  return {
    title: "Skincare Products",
    description,
    alternates: { canonical: absoluteUrl("/skincare") },
    openGraph: { title: "Skincare Products | Arade", description, url: absoluteUrl("/skincare"), type: "website" },
  };
}

export default async function SkincarePage() {
  const category = await getActiveCategory("skincare");
  return <><JsonLd data={{ "@context": "https://schema.org", "@type": "CollectionPage", name: category?.name || "Skincare", description: category?.description || fallbackDescription, url: absoluteUrl("/skincare"), isPartOf: { "@type": "WebSite", name: "Arade", url: absoluteUrl("/") } }} /><CategoryPage categorySlug="skincare" title="Skincare" description="Carefully selected products for your skincare routine. Cleansers, moisturizers, soaps and more to keep your skin healthy and glowing." /></>;
}
