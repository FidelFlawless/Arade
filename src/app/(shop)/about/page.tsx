export default function AboutPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-20">
      {/* Hero */}
      <div className="text-center mb-16">
        <h1 className="text-4xl lg:text-5xl font-bold text-foreground mb-6">
          About GlowSkin
        </h1>
        <p className="text-lg text-foreground/60 max-w-2xl mx-auto">
          We believe everyone deserves access to high-quality skincare products
          that deliver real results. GlowSkin was founded with a simple mission:
          to make professional skincare accessible to everyone.
        </p>
      </div>

      {/* Story */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center mb-20">
        <div>
          <h2 className="text-2xl font-bold text-foreground mb-4">Our Story</h2>
          <div className="space-y-4 text-foreground/70">
            <p>
              GlowSkin was born from a passion for skincare and a belief that
              everyone should feel confident in their own skin. Founded in Canada,
              we set out to create a brand that combines the best of nature and
              science.
            </p>
            <p>
              Every product in our collection is carefully formulated using
              premium ingredients that are both effective and gentle. We work
              with dermatologists and skincare experts to ensure each product
              meets the highest standards.
            </p>
            <p>
              Today, we serve customers across Canada and the United States,
              helping thousands of people achieve their skincare goals.
            </p>
          </div>
        </div>
        <div className="aspect-square bg-gradient-to-br from-secondary/50 to-accent/30 rounded-2xl flex items-center justify-center">
          <span className="text-8xl">✨</span>
        </div>
      </div>

      {/* Values */}
      <div className="mb-20">
        <h2 className="text-2xl font-bold text-foreground mb-8 text-center">
          Our Values
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            {
              icon: "🔬",
              title: "Science-Backed",
              description:
                "Every product is developed using the latest dermatological research and tested for safety and efficacy.",
            },
            {
              icon: "🌿",
              title: "Clean Ingredients",
              description:
                "We use premium, skin-loving ingredients while avoiding harmful chemicals and unnecessary additives.",
            },
            {
              icon: "🌍",
              title: "Sustainability",
              description:
                "We're committed to eco-friendly packaging and responsible sourcing to protect our planet.",
            },
          ].map((value) => (
            <div key={value.title} className="text-center p-6">
              <div className="text-4xl mb-4">{value.icon}</div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                {value.title}
              </h3>
              <p className="text-foreground/60">{value.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="text-center bg-secondary/30 rounded-2xl p-12">
        <h2 className="text-2xl font-bold text-foreground mb-4">
          Ready to Start Your Skincare Journey?
        </h2>
        <p className="text-foreground/60 mb-6 max-w-lg mx-auto">
          Discover our collection and find the perfect products for your skin type.
        </p>
        <a href="/shop" className="btn-primary inline-block">
          Shop Now
        </a>
      </div>
    </div>
  );
}
