import type { Metadata } from "next";
import { absoluteUrl } from "@/lib/seo";

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

export default function CollectionLayout({ children }: { children: React.ReactNode }) {
  return children;
}
