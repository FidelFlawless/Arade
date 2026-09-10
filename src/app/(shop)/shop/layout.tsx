import type { Metadata } from "next";
import { absoluteUrl } from "@/lib/seo";

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

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return children;
}
