import type { Metadata } from "next";
import { absoluteUrl } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Learn how Arade collects, uses, and protects information when you shop with us.",
  alternates: { canonical: absoluteUrl("/privacy") },
};

export default function PrivacyPolicyPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-20">
      <h1 className="text-4xl lg:text-5xl font-serif text-foreground mb-4">Privacy Policy</h1>
      <p className="text-foreground/60 mb-10">Last updated: September 10, 2026</p>
      <div className="space-y-8 text-foreground/70 leading-relaxed">
        <section><h2 className="text-2xl font-serif text-foreground mb-3">Information We Collect</h2><p>When you create an account, place an order, contact us, or subscribe to our newsletter, we may collect your name, email address, phone number, shipping address, order details, and communication preferences.</p></section>
        <section><h2 className="text-2xl font-serif text-foreground mb-3">How We Use Information</h2><p>We use this information to process orders, provide customer support, manage your account, deliver purchases, send service messages, and improve the Arade shopping experience.</p></section>
        <section><h2 className="text-2xl font-serif text-foreground mb-3">Payments and Service Providers</h2><p>Payments are processed securely by Stripe. We do not store your complete card number. We may share only the information needed with service providers that help us operate our store, process payments, deliver orders, or manage subscriptions.</p></section>
        <section><h2 className="text-2xl font-serif text-foreground mb-3">Your Choices</h2><p>You may update your account information, unsubscribe from marketing emails, or contact us about access, correction, or deletion requests. Some information may need to be retained to complete orders, prevent fraud, or meet legal obligations.</p></section>
        <section><h2 className="text-2xl font-serif text-foreground mb-3">Contact Us</h2><p>For privacy questions, please contact us through the <a href="/contact" className="text-primary hover:underline">Contact page</a>.</p></section>
      </div>
    </div>
  );
}
