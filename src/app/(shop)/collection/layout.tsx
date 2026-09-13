import type { Metadata } from "next";
import { absoluteUrl, JsonLd } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Collections",
  description: "Explore Arade's curated collections across beauty, skincare, hair and fashion.",
  alternates: { canonical: absoluteUrl("/collection") },
  openGraph: {
    title: "Collections | Arade",
    description: "Explore Arade's curated collections across beauty, skincare, hair and fashion.",
    url: absoluteUrl("/collection"),
    type: "website",
  },
};

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
