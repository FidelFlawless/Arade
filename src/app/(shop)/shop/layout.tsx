import type { Metadata } from "next";
import { absoluteUrl, JsonLd } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Shop Products",
  description: "Browse Arade's active collection of beauty, skincare, hair and fashion products.",
  alternates: { canonical: absoluteUrl("/shop") },
  openGraph: {
    title: "Shop Products | Arade",
    description: "Browse Arade's active collection of beauty, skincare, hair and fashion products.",
    url: absoluteUrl("/shop"),
    type: "website",
  },
};

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
