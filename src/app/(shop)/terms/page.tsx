import type { Metadata } from "next";
import { absoluteUrl } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Terms and Conditions",
  description: "Read the terms and conditions that govern your use of the Arade website and purchases.",
  alternates: { canonical: absoluteUrl("/terms") },
};

export default function TermsPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-20">
      <h1 className="text-4xl lg:text-5xl font-serif text-foreground mb-4">Terms and Conditions</h1>
      <p className="text-foreground/60 mb-10">Last updated: September 10, 2026</p>
      <div className="space-y-8 text-foreground/70 leading-relaxed">
        <section>
          <h2 className="text-2xl font-serif text-foreground mb-3">Acceptance of Terms</h2>
          <p>By accessing or using the Arade website, placing an order, or creating an account, you agree to these Terms and Conditions. If you do not agree, please do not use our website.</p>
        </section>

        <section>
          <h2 className="text-2xl font-serif text-foreground mb-3">About Arade</h2>
          <p>Arade is a beauty, skincare, hair, and fashion e-commerce store based in Ontario, Canada. We curate and sell products from various brands to customers in Canada and the United States.</p>
        </section>

        <section>
          <h2 className="text-2xl font-serif text-foreground mb-3">Products and Descriptions</h2>
          <p>We aim to provide accurate product descriptions, images, and pricing. However, colours and appearance may vary slightly due to screen settings. Product availability is subject to change without notice. Arade is not responsible for typographical errors in pricing or product information.</p>
        </section>

        <section>
          <h2 className="text-2xl font-serif text-foreground mb-3">Pricing and Currency</h2>
          <p>All prices are displayed in the currency applicable to your selected country (CAD for Canada, USD for the United States). Prices do not include applicable taxes, which are calculated at checkout. Arade reserves the right to change prices at any time without prior notice.</p>
        </section>

        <section>
          <h2 className="text-2xl font-serif text-foreground mb-3">Orders and Payment</h2>
          <p>When you place an order, you are making an offer to purchase products. We may accept or decline any order. Payment is processed securely through Stripe. You agree to provide current, complete, and accurate billing and shipping information. Arade is not responsible for orders that cannot be processed due to incorrect information.</p>
        </section>

        <section>
          <h2 className="text-2xl font-serif text-foreground mb-3">Shipping and Delivery</h2>
          <p>We currently ship to addresses in Canada and the United States. Delivery timelines are estimates and not guaranteed. Arade is not liable for delays caused by carriers, customs, weather, or events beyond our control. Please refer to our <a href="/shipping" className="text-primary hover:underline">Shipping Policy</a> for full details.</p>
        </section>

        <section>
          <h2 className="text-2xl font-serif text-foreground mb-3">Returns and Refunds</h2>
          <p>Returns may be requested within 14 days of delivery, subject to eligibility requirements. Refunds are issued to the original payment method after the returned item is received and inspected. Please refer to our <a href="/returns" className="text-primary hover:underline">Return Policy</a> for full details.</p>
        </section>

        <section>
          <h2 className="text-2xl font-serif text-foreground mb-3">User Accounts</h2>
          <p>You are responsible for maintaining the confidentiality of your account credentials and for all activity under your account. You agree to provide accurate information when creating an account and to update it as needed. Arade reserves the right to suspend or terminate accounts that violate these terms.</p>
        </section>

        <section>
          <h2 className="text-2xl font-serif text-foreground mb-3">Prohibited Conduct</h2>
          <p>You agree not to use the website for any unlawful purpose, attempt to gain unauthorized access to any part of the site, interfere with its operation, use automated systems to access the site without permission, or submit false or misleading information.</p>
        </section>

        <section>
          <h2 className="text-2xl font-serif text-foreground mb-3">Intellectual Property</h2>
          <p>All content on the Arade website, including text, images, logos, graphics, and design, is the property of Arade or its licensors and is protected by applicable intellectual property laws. You may not reproduce, distribute, or use any content without prior written permission.</p>
        </section>

        <section>
          <h2 className="text-2xl font-serif text-foreground mb-3">Limitation of Liability</h2>
          <p>To the maximum extent permitted by law, Arade shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of the website or purchase of products. Our total liability for any claim shall not exceed the amount you paid for the product in question.</p>
        </section>

        <section>
          <h2 className="text-2xl font-serif text-foreground mb-3">Indemnification</h2>
          <p>You agree to indemnify and hold Arade harmless from any claims, losses, or damages arising from your use of the website or violation of these Terms and Conditions.</p>
        </section>

        <section>
          <h2 className="text-2xl font-serif text-foreground mb-3">Changes to These Terms</h2>
          <p>We may update these Terms and Conditions from time to time. Changes will be posted on this page with an updated date. Your continued use of the website after changes are posted constitutes your acceptance of the revised terms.</p>
        </section>

        <section>
          <h2 className="text-2xl font-serif text-foreground mb-3">Contact Us</h2>
          <p>If you have any questions about these Terms and Conditions, please contact us through the <a href="/contact" className="text-primary hover:underline">Contact page</a>.</p>
        </section>
      </div>
    </div>
  );
}
