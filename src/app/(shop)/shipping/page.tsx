import type { Metadata } from "next";
import { absoluteUrl } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Shipping Policy",
  description: "Review Arade shipping destinations, delivery timelines, and delivery fees.",
  alternates: { canonical: absoluteUrl("/shipping") },
};

export default function ShippingPolicyPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-20">
      <h1 className="text-4xl lg:text-5xl font-serif text-foreground mb-4">Shipping Policy</h1>
      <p className="text-foreground/60 mb-10">Delivery information for Arade orders.</p>
      <div className="space-y-8 text-foreground/70 leading-relaxed">
        <section><h2 className="text-2xl font-serif text-foreground mb-3">Where We Deliver</h2><p>Arade currently ships to addresses in Canada and the United States.</p></section>
        <section><h2 className="text-2xl font-serif text-foreground mb-3">Delivery Times</h2><p>Standard delivery typically takes 5 to 10 business days after an order has been processed. Delivery estimates may vary based on destination, carrier conditions, and seasonal demand.</p></section>
        <section><h2 className="text-2xl font-serif text-foreground mb-3">Delivery Fees</h2><p>Orders of C$180 or more qualify for free delivery. Orders below the free-delivery threshold are charged the delivery fee shown at checkout for the selected country and currency.</p></section>
        <section><h2 className="text-2xl font-serif text-foreground mb-3">Order Tracking</h2><p>When your order is shipped, its status will be updated in your account. For help with an order, please contact our support team with your order number.</p></section>
      </div>
    </div>
  );
}
