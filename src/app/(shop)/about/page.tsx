import { Metadata } from "next";
import { SITE_NAME } from "@/lib/constants";
import { Gem, Leaf, Globe } from "lucide-react";

export const metadata: Metadata = {
  title: "About Us",
  description: "Learn about Arade, your destination for beauty, skincare, hair and fashion.",
};

export default function AboutPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-20">
      {/* Hero */}
      <div className="text-center mb-16">
        <h1 className="text-4xl lg:text-5xl font-serif text-foreground mb-6">
          About {SITE_NAME}
        </h1>
        <p className="text-lg text-foreground/60 max-w-2xl mx-auto">
          We believe everyone deserves access to carefully curated beauty, skincare,
          hair and fashion products. Arade was founded with a simple mission: to
          help you express your unique style with confidence.
        </p>
      </div>

      {/* Story */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center mb-20">
        <div>
          <h2 className="text-2xl font-serif text-foreground mb-4">Our Story</h2>
          <div className="space-y-4 text-foreground/70">
            <p>
              Arade was born from a passion for beauty in all its forms and a belief
              that everyone should feel confident in how they look and present
              themselves. Founded in Canada, we set out to create a destination that
              brings together the best in beauty, skincare, hair and fashion.
            </p>
            <p>
              Every product in our collection is carefully selected from trusted
              brands and suppliers. We focus on quality, authenticity and products
              that truly make a difference in your daily routine.
            </p>
            <p>
              Today, we serve customers across Canada and the United States,
              helping thousands of people discover products they love.
            </p>
          </div>
        </div>
        <div className="rounded-2xl overflow-hidden bg-[#d5c4a8]/40">
          <img src="/image.png" alt="Arade Beauty Products" className="w-full h-auto object-cover" />
        </div>
      </div>

      {/* Values */}
      <div className="mb-20">
        <h2 className="text-2xl font-serif text-foreground mb-8 text-center">
          Our Values
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            {
              Icon: Gem,
              title: "Curated Quality",
              description:
                "Every product is carefully selected to meet our standards for quality, authenticity and value.",
            },
            {
              Icon: Leaf,
              title: "Trusted Selection",
              description:
                "We work with trusted brands and suppliers to bring you products you can rely on.",
            },
            {
              Icon: Globe,
              title: "Canada & USA",
              description:
                "Proudly serving customers across Canada and the United States with free delivery on orders over $180.",
            },
          ].map((value) => (
            <div key={value.title} className="text-center p-6">
              <value.Icon className="w-10 h-10 text-primary mx-auto mb-4" strokeWidth={1.5} />
              <h3 className="text-lg font-semibold text-foreground mb-2">
                {value.title}
              </h3>
              <p className="text-foreground/60">{value.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Categories */}
      <div className="mb-20">
        <h2 className="text-2xl font-serif text-foreground mb-8 text-center">
          What We Offer
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { name: "Beauty", desc: "Makeup, fragrances and beauty essentials." },
            { name: "Skincare", desc: "Cleansers, moisturizers and skincare sets." },
            { name: "Hair", desc: "Wigs, hair care and accessories." },
            { name: "Fashion", desc: "Dresses, tops and fashion accessories." },
          ].map((cat) => (
            <div key={cat.name} className="bg-[#f5f0ea] rounded-xl p-6 text-center">
              <h3 className="font-serif text-lg text-foreground mb-2">{cat.name}</h3>
              <p className="text-sm text-foreground/60">{cat.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="text-center bg-[#f5f0ea] rounded-2xl p-12">
        <h2 className="text-2xl font-serif text-foreground mb-4">
          Ready to Explore?
        </h2>
        <p className="text-foreground/60 mb-6 max-w-lg mx-auto">
          Discover our full collection of beauty, skincare, hair and fashion products.
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
