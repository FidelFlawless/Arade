import type { Metadata } from "next";
import { absoluteUrl } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Return Policy",
  description: "Learn how to request a return, refund, or exchange for an Arade order.",
  alternates: { canonical: absoluteUrl("/returns") },
};

export default function ReturnPolicyPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-20">
      <h1 className="text-4xl lg:text-5xl font-serif text-foreground mb-4">Return Policy</h1>
      <p className="text-foreground/60 mb-10">Information about returns, refunds, and exchanges.</p>
      <div className="space-y-8 text-foreground/70 leading-relaxed">
        <section><h2 className="text-2xl font-serif text-foreground mb-3">Eligibility</h2><p>Returns may be requested within 14 days of delivery. Items must be unused, in their original packaging, and in resalable condition. Some personal-care products may not be eligible for return for hygiene reasons.</p></section>
        <section><h2 className="text-2xl font-serif text-foreground mb-3">How to Start a Return</h2><p>Contact us through the <a href="/contact" className="text-primary hover:underline">Contact page</a> with your order number, the product you want to return, and the reason for your request. Please wait for return instructions before sending anything back.</p></section>
        <section><h2 className="text-2xl font-serif text-foreground mb-3">Refunds</h2><p>Once an approved return is received and inspected, eligible refunds are issued to the original payment method. Processing times are typically 5 to 10 business days after approval.</p></section>
        <section><h2 className="text-2xl font-serif text-foreground mb-3">Exchanges and Damaged Items</h2><p>Contact us as soon as possible if an item arrives damaged or you receive the wrong product. Exchanges may be available for eligible items of equal value, subject to stock.</p></section>
      </div>
    </div>
  );
}
