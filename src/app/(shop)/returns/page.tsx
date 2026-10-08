import { buildPageMetadata } from "@/lib/seo";

export const metadata = buildPageMetadata({
  title: "Return Policy",
  description:
    "Learn how to request a return, refund, or exchange for your Arade order.",
  path: "/returns",
});

export default function ReturnPolicyPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-20">
      <h1 className="text-4xl lg:text-5xl font-serif text-foreground mb-4">
        Return &amp; Refund Policy
      </h1>
      <p className="text-foreground/60 mb-10">
        At Arade Shop, we want you to feel confident about your purchase. If
        something isn&apos;t right with your order, please contact us so we can
        help.
      </p>

      <div className="space-y-10 text-foreground/70 leading-relaxed">
        <section>
          <h2 className="text-2xl font-serif text-foreground mb-4">
            Returns
          </h2>
          <p className="mb-4">
            You may request a return within 14 days of receiving your order.
            Products must be unopened, unused and in their original packaging,
            with all seals intact. Proof of purchase is required.
          </p>
          <p className="mb-4">
            For hygiene reasons, we cannot accept change-of-mind returns for
            opened, used or unsealed skincare and personal-care products.
          </p>
          <p>
            Items clearly marked &quot;final sale&quot; and gift cards are
            excluded from change-of-mind returns.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-serif text-foreground mb-4">
            Damaged, Faulty or Incorrect Items
          </h2>
          <p>
            Please check your order when it arrives. If an item is damaged,
            leaking, faulty or incorrect, contact us as soon as possible,
            ideally within 7 days of delivery, with your order number and
            clear photographs of the product and packaging.
          </p>
          <p>
            We will review the issue and arrange an appropriate replacement or
            refund. Where a return is necessary, we will cover the return
            shipping costs for confirmed faults or errors on our part. The
            unopened-product restriction does not apply to these claims.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-serif text-foreground mb-4">
            How to Request a Return
          </h2>
          <p>
            Contact{" "}
            <a
              href="mailto:support@aradeshop.com"
              className="text-primary hover:underline"
            >
              support@aradeshop.com
            </a>{" "}
            with your order number, the item you wish to return and your reason.
          </p>
          <p>
            Please wait for return instructions before sending anything back.
            Once approved, send your return within 14 days of approval. We
            recommend using tracked shipping and keeping your receipt.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-serif text-foreground mb-4">
            Shipping Costs
          </h2>
          <p>
            Customers are responsible for return shipping on change-of-mind
            returns. Original delivery charges are not refundable for these
            returns.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-serif text-foreground mb-4">
            Refunds
          </h2>
          <p>
            After receiving and inspecting your return, we will confirm whether
            it meets our return conditions. Approved refunds will be issued to
            your original payment method within 5 business days. Your bank or
            payment provider may take additional time to display the refund.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-serif text-foreground mb-4">
            Exchanges
          </h2>
          <p>
            If you would like a different product, please request a return for
            the eligible unopened item and place a separate order for your
            preferred product.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-serif text-foreground mb-4">
            Skin Reactions and Results
          </h2>
          <p>
            Everyone&apos;s skin is different, and results can vary. Opened
            products are not eligible for change-of-mind returns solely because
            they did not produce the expected results or did not suit your
            skin. If you experience a reaction or suspect a product quality
            issue, please contact us so we can review your concern.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-serif text-foreground mb-4">
            Your Consumer Rights
          </h2>
          <p>
            This policy does not limit any rights or remedies available under
            applicable consumer protection laws, including those relating to
            faulty, unsafe or misrepresented products.
          </p>
        </section>
      </div>
    </div>
  );
}
