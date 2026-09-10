import type { Metadata } from "next";
import FaqContent from "./FaqContent";
import { absoluteUrl } from "@/lib/seo";

export const metadata: Metadata = {
  title: "FAQ | Arade",
  description: "Frequently asked questions about Arade products, orders, shipping, returns and more.",
  alternates: { canonical: absoluteUrl("/faq") },
  openGraph: {
    title: "Frequently Asked Questions | Arade",
    description: "Frequently asked questions about Arade products, orders, shipping, returns and more.",
    url: absoluteUrl("/faq"),
    type: "website",
  },
};

export default function FaqPage() {
  return <FaqContent />;
}
