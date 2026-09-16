import { absoluteUrl, buildPageMetadata, JsonLd } from "@/lib/seo";

export const metadata = buildPageMetadata({
  title: "Shop Products",
  description: "Browse Arade's active collection of beauty, skincare, hair and fashion products.",
  path: "/shop",
  ogTitle: "Shop Products | Arade",
});

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: absoluteUrl("/") },
    { "@type": "ListItem", position: 2, name: "Shop", item: absoluteUrl("/shop") },
  ],
};

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <JsonLd data={breadcrumbSchema} />
      {children}
    </>
  );
}
