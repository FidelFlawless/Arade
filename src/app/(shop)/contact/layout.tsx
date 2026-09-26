import { absoluteUrl, buildPageMetadata, JsonLd } from "@/lib/seo";

export const metadata = buildPageMetadata({
  title: "Contact Arade",
  description: "Contact Arade for help with products, orders, shipping and customer support.",
  path: "/contact",
  ogTitle: "Contact Arade | Customer Support",
});

// Uses only the real contact details already shown on the /contact page
// (defaults mirrored from src/app/(shop)/contact/page.tsx).
const contactSchema = {
  "@context": "https://schema.org",
  "@type": "ContactPage",
  name: "Contact Arade",
  url: absoluteUrl("/contact"),
  about: {
    "@type": "Organization",
    name: "Arade",
    url: absoluteUrl("/"),
    email: "support@aradeshop.com",
    telephone: "+1 (437) 566-2773",
    address: {
      "@type": "PostalAddress",
      addressRegion: "Ontario",
      addressCountry: "CA",
    },
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer support",
      email: "support@aradeshop.com",
      telephone: "+1 (437) 566-2773",
      availableLanguage: ["English"],
      hoursAvailable: [
        { "@type": "OpeningHoursSpecification", dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"], opens: "09:00", closes: "18:00" },
        { "@type": "OpeningHoursSpecification", dayOfWeek: "Saturday", opens: "10:00", closes: "16:00" },
      ],
    },
  },
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <JsonLd data={contactSchema} />
      {children}
    </>
  );
}
