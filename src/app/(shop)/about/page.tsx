import { Metadata } from "next";
import BackButton from "@/components/ui/BackButton";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "About Arade Shop",
  description:
    "Good skincare starts with understanding your skin. Learn about Arade Shop, an online shop for branded skincare and body-care products.",
  path: "/about",
  ogTitle: "About Arade Shop",
});

const SECTIONS = [
  {
    heading: "Thoughtfully Chosen, With You in Mind",
    paragraphs: [
      "There is a lot of choice in skincare, and knowing where to begin can feel overwhelming. That is why we carefully curate our collection, choosing products from different brands for a range of skin concerns and everyday care needs.",
      "From cleansers and moisturisers to serums, sunscreens and body washes, our collection helps you explore options for hydration, uneven skin tone, blemish-prone skin and maintaining your skin’s natural glow. We believe a good routine should be something you can understand, enjoy and keep up with.",
    ],
  },
  {
    heading: "Care in How We Source",
    paragraphs: [
      "Trust matters, especially when it comes to products you use on your skin. We source our collection through carefully selected suppliers and manufacturers around the world, with attention to authenticity, product quality and condition.",
      "As a retailer of established brands, our role is to bring those products together in one convenient place. We take that responsibility seriously because you deserve to feel confident about what you are buying and who you are buying it from.",
    ],
  },
  {
    heading: "A Personal Approach to Skincare",
    paragraphs: [
      "No two people have exactly the same skin. A product that works beautifully for one person may not be the right fit for another, and your skin’s needs can change over time.",
      "At Arade Shop, we respect those differences. We aim to share clear product information, help you understand your options and encourage thoughtful choices. We believe in realistic expectations, consistent care and giving your skin the attention it deserves.",
      "For us, skincare is also about the everyday moments: washing your face after a long day, applying your favourite moisturiser or taking a few quiet minutes for yourself. Those small habits matter.",
    ],
  },
  {
    heading: "Customers at the Heart of Our Shop",
    paragraphs: [
      "Behind every order is a person placing their trust in us. We want that trust to be reflected in how we communicate, prepare your order and respond when you need support.",
      "As an online business, we work to make your experience straightforward and reassuring—from browsing our collection to receiving your purchase. Your questions, feedback and concerns matter to us. We want you to feel comfortable reaching out and confident that you will be treated with care and respect.",
    ],
  },
  {
    heading: "Growing a Community Around Care",
    paragraphs: [
      "Our vision goes beyond selling products. We want Arade Shop to become a welcoming space where people can discover skincare, share their experiences and feel supported in caring for themselves.",
      "We celebrate progress at every stage. There is no single version of beautiful skin, and caring for yourself should never feel like a competition. Whether your routine has three steps or a few more, we are happy to be part of your journey.",
    ],
  },
];

export default function AboutPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-20">
      <BackButton href="/" label="Back to home" />
      {/* Hero */}
      <div className="text-center mb-12">
        <h1 className="text-4xl lg:text-5xl font-serif text-foreground mb-6">
          About Arade Shop
        </h1>
        <div className="text-lg text-foreground/60 max-w-2xl mx-auto space-y-4 text-left">
          <p>
            Good skincare starts with understanding your skin and choosing
            products with care. At Arade Shop, we bring together branded
            skincare and body-care products to help you build a routine that
            fits your needs, your lifestyle and your budget.
          </p>
          <p>
            We are an online beauty shop with a simple purpose: to make
            shopping for skincare feel easier and more personal. Whether you
            are starting your first routine, looking for a favourite product or
            giving your current routine a little more attention, we want you to
            feel welcome here.
          </p>
        </div>
      </div>

      {/* Image */}
      <div className="rounded-2xl overflow-hidden bg-[#E0D0F0]/40 mb-16">
        <img
          src="/image.webp"
          alt="Arade Skincare Products"
          width={1536}
          height={1024}
          loading="lazy"
          decoding="async"
          className="w-full h-auto object-cover"
        />
      </div>

      {/* Content sections */}
      <div className="space-y-12 mb-20">
        {SECTIONS.map((section) => (
          <section key={section.heading}>
            <h2 className="text-2xl font-serif text-foreground mb-4">
              {section.heading}
            </h2>
            <div className="space-y-4 text-foreground/70">
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph.slice(0, 40)}>{paragraph}</p>
              ))}
            </div>
          </section>
        ))}
        <p className="text-foreground/70">
          Thank you for choosing Arade Shop and supporting our growing
          business. We look forward to helping you find your next skincare
          favourite.
        </p>
      </div>

      {/* CTA */}
      <div className="text-center bg-[#F3EAFB] rounded-2xl p-12">
        <h2 className="text-2xl font-serif text-foreground mb-4">
          Ready to Explore?
        </h2>
        <p className="text-foreground/60 mb-6 max-w-lg mx-auto">
          Discover our full collection of skincare and body-care products.
        </p>
        <a
          href="/shop"
          className="inline-block px-8 py-3.5 bg-primary text-white font-medium rounded-lg hover:bg-primary/90 transition-colors"
        >
          Shop Now
        </a>
      </div>
    </div>
  );
}
