import CategoryPage from "@/app/(shop)/category/CategoryPage";
import type { Metadata } from "next";
import { absoluteUrl, buildPageMetadata, countActiveCategoryProducts, getActiveCategory, JsonLd, truncateDescription } from "@/lib/seo";

const fallbackDescription = "Explore wigs, hair care and accessories selected to help you create and maintain your desired look.";

export async function generateMetadata(): Promise<Metadata> {
  const [category, productCount] = await Promise.all([
    getActiveCategory("hair"),
    countActiveCategoryProducts("hair"),
  ]);
  const description = truncateDescription(category?.description, fallbackDescription);
  // Empty parent categories stay crawlable (follow) but are excluded from the
  // index until products exist; the page becomes indexable automatically as
  // soon as the category has active products.
  return buildPageMetadata({
    title: "Hair Products",
    description,
    path: "/hair",
    ogTitle: "Hair Products | Arade",
    index: productCount > 0,
  });
}

export default async function HairPage() {
  const category = await getActiveCategory("hair");
  return <><JsonLd data={{ "@context": "https://schema.org", "@graph": [ { "@type": "CollectionPage", name: category?.name || "Hair", description: category?.description || fallbackDescription, url: absoluteUrl("/hair"), isPartOf: { "@type": "WebSite", name: "Arade", url: absoluteUrl("/") } }, { "@type": "BreadcrumbList", itemListElement: [ { "@type": "ListItem", position: 1, name: "Home", item: absoluteUrl("/") }, { "@type": "ListItem", position: 2, name: category?.name || "Hair", item: absoluteUrl("/hair") } ] } ] }} /><CategoryPage categorySlug="hair" title="Hair" description="Explore wigs, hair care and accessories. Quality products to help you achieve your desired look." /></>;
}
