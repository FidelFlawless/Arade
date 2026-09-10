import type { Metadata } from "next";
import { absoluteUrl } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Contact Arade",
  description: "Contact Arade for help with products, orders, shipping and customer support.",
  alternates: { canonical: absoluteUrl("/contact") },
  openGraph: {
    title: "Contact Arade | Customer Support",
    description: "Contact Arade for help with products, orders, shipping and customer support.",
    url: absoluteUrl("/contact"),
    type: "website",
  },
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children;
}
