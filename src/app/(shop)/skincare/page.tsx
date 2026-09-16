import CategoryPage from "@/app/(shop)/category/CategoryPage";
import type { Metadata } from "next";
import { absoluteUrl, buildPageMetadata, countActiveCategoryProducts, getActiveCategory, JsonLd, truncateDescription } from "@/lib/seo";

const fallbackDescription = "Shop carefully selected skincare products for healthy, radiant skin, including cleansers, moisturizers and skincare sets.";

export async function generateMetadata(): Promise<Metadata> {
  const [category, productCount] = await Promise.all([
    getActiveCategory("skincare"),
    countActiveCategoryProducts("skincare"),
  ]);
  const description = truncateDescription(category?.description, fallbackDescription);
  // Empty parent categories stay crawlable (follow) but are excluded from the
  // index until products exist; the page becomes indexable automatically as
  // soon as the category has active products.
  return buildPageMetadata({
    title: "Skincare Products",
    description,
    path: "/skincare",
    ogTitle: "Skincare Products | Arade",
    index: productCount > 0,
  });
}

export default async function SkincarePage() {
  const category = await getActiveCategory("skincare");
  return <><JsonLd data={{ "@context": "https://schema.org", "@graph": [ { "@type": "CollectionPage", name: category?.name || "Skincare", description: category?.description || fallbackDescription, url: absoluteUrl("/skincare"), isPartOf: { "@type": "WebSite", name: "Arade", url: absoluteUrl("/") } }, { "@type": "BreadcrumbList", itemListElement: [ { "@type": "ListItem", position: 1, name: "Home", item: absoluteUrl("/") }, { "@type": "ListItem", position: 2, name: category?.name || "Skincare", item: absoluteUrl("/skincare") } ] } ] }} /><CategoryPage categorySlug="skincare" title="Skincare" description="Carefully selected products for your skincare routine. Cleansers, moisturizers, soaps and more to keep your skin healthy and glowing." /></>;
}
