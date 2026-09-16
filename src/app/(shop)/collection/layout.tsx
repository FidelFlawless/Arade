import { absoluteUrl, buildPageMetadata, JsonLd } from "@/lib/seo";

export const metadata = buildPageMetadata({
  title: "Collections",
  description: "Explore Arade's curated collections across beauty, skincare, hair and fashion.",
  path: "/collection",
  ogTitle: "Collections | Arade",
});

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: absoluteUrl("/") },
    { "@type": "ListItem", position: 2, name: "Collections", item: absoluteUrl("/collection") },
  ],
};

export default function CollectionLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <JsonLd data={breadcrumbSchema} />
      {children}
    </>
  );
}
