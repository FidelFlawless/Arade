import type { Metadata } from "next";
import FaqContent from "./FaqContent";
import { faqCategories } from "./faqData";
import { absoluteUrl, JsonLd } from "@/lib/seo";

// Title intentionally omits "| Arade" — the root title template ("%s | Arade")
// appends the brand, producing the final title "FAQ | Arade".
export const metadata: Metadata = {
  title: "FAQ",
  description: "Frequently asked questions about Arade products, orders, shipping, returns and more.",
  alternates: { canonical: absoluteUrl("/faq") },
  openGraph: {
    title: "Frequently Asked Questions | Arade",
    description: "Frequently asked questions about Arade products, orders, shipping, returns and more.",
    url: absoluteUrl("/faq"),
    type: "website",
  },
};

// FAQPage JSON-LD generated strictly from the visible FAQ content (faqData.ts).
const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  url: absoluteUrl("/faq"),
  mainEntity: faqCategories.flatMap((category) =>
    category.questions.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    }))
  ),
};

export default function FaqPage() {
  return (
    <>
      <JsonLd data={faqSchema} />
      <FaqContent />
    </>
  );
}
