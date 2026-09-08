import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Leaf, Droplets, Rabbit, ShieldCheck, Droplet, Sparkles, Heart, Package, Flower2 } from "lucide-react";
import NewsletterForm from "@/components/newsletter/NewsletterForm";
import CategorySection from "@/components/home/CategorySection";
import ProductCard from "@/components/product/ProductCard";

export default async function HomePage() {
  const supabase = await createClient();
  
  const { data: featuredProducts } = await supabase
    .from("products")
    .select("*")
    .eq("is_active", true)
    .eq("is_featured", true)
    .limit(6);



  return (
    <div>
      {/* Hero Section */}
      <section className="relative bg-[#d5c4a8] overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-[5fr_5fr] gap-6 lg:gap-8 items-center min-h-[350px] lg:min-h-[520px]">
            {/* Left content */}
            <div className="py-8 sm:py-12 lg:py-0 z-10">
              <div className="flex items-center gap-3 mb-4 sm:mb-6">
                <span className="text-xs sm:text-sm font-medium tracking-widest text-primary uppercase">
                  Beauty · Skincare · Hair · Fashion
                </span>
                <span className="w-8 sm:w-12 h-[1px] bg-primary"></span>
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-serif text-foreground leading-[1.1]">
                Elevate Your{' '}
                <span className="text-primary italic">Style</span>
              </h1>
              <p className="mt-4 sm:mt-6 text-base sm:text-lg text-foreground/60 max-w-md leading-relaxed">
                Curated beauty, skincare, hair and fashion products to express your unique style with confidence.
              </p>
              <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row gap-3">
                <Link
                  href="/shop"
                  className="px-6 sm:px-8 py-3 sm:py-3.5 bg-primary text-white font-medium rounded-lg hover:bg-primary/90 transition-colors text-sm sm:text-base text-center w-full sm:w-auto"
                >
                  Shop Now
                </Link>
                <Link
                  href="/collection"
                  className="px-6 sm:px-8 py-3 sm:py-3.5 border-2 border-primary text-primary font-medium rounded-lg hover:bg-primary/5 transition-colors text-sm sm:text-base text-center w-full sm:w-auto"
                >
                  Explore Collections
                </Link>
              </div>
            </div>
            {/* Right image */}
            <div className="relative flex justify-center lg:justify-end items-center">
              <img
                src="/image.png"
                alt="Arade Beauty Products"
                className="w-full max-w-[320px] sm:max-w-[380px] lg:max-w-[500px] h-auto object-contain mix-blend-multiply" style={{ maskImage: "linear-gradient(to right, transparent 0%, black 15%)", WebkitMaskImage: "linear-gradient(to right, transparent 0%, black 15%)" }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Feature Icons Bar */}
      <section className="border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-border">
            <div className="flex items-center gap-4 py-6 px-4 lg:px-6">
              <Leaf className="w-8 h-8 text-primary flex-shrink-0" strokeWidth={1.5} />
              <div>
                <h3 className="font-semibold text-foreground text-sm">Curated Selection</h3>
                <p className="text-xs text-foreground/50 mt-0.5">Carefully chosen products you can trust.</p>
              </div>
            </div>
            <div className="flex items-center gap-4 py-6 px-4 lg:px-6">
              <Droplets className="w-8 h-8 text-primary flex-shrink-0" strokeWidth={1.5} />
              <div>
                <h3 className="font-semibold text-foreground text-sm">Quality Products</h3>
                <p className="text-xs text-foreground/50 mt-0.5">Premium beauty and fashion essentials.</p>
              </div>
            </div>
            <div className="flex items-center gap-4 py-6 px-4 lg:px-6">
              <Rabbit className="w-8 h-8 text-primary flex-shrink-0" strokeWidth={1.5} />
              <div>
                <h3 className="font-semibold text-foreground text-sm">Cruelty Free</h3>
                <p className="text-xs text-foreground/50 mt-0.5">We never test on animals.</p>
              </div>
            </div>
            <div className="flex items-center gap-4 py-6 px-4 lg:px-6">
              <ShieldCheck className="w-8 h-8 text-primary flex-shrink-0" strokeWidth={1.5} />
              <div>
                <h3 className="font-semibold text-foreground text-sm">Secure Payment</h3>
                <p className="text-xs text-foreground/50 mt-0.5">Your payment information is always protected.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Products */}
      {featuredProducts && featuredProducts.length > 0 && (
        <section className="py-16 lg:py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-foreground">Featured Products</h2>
              <p className="mt-3 text-foreground/60">Our most popular products</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {featuredProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={{
                    id: product.id,
                    name: product.name,
                    slug: product.slug,
                    price_cad: product.price_cad,
                    price_usd: product.price_usd,
                    images: product.images,
                    stock_quantity: product.stock_quantity,
                  }}
                />
              ))}
            </div>
            <div className="text-center mt-10">
              <Link href="/shop" className="btn-outline">
                View All Products
              </Link>
            </div>
          </div>
        </section>
      )}


      {/* Shop by Category */}
      <CategorySection />

      {/* New Collection Banner */}
      <section className="py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative bg-[#2c1810] overflow-hidden rounded-2xl">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 items-center min-h-[320px] sm:min-h-[380px] lg:min-h-[400px] px-6 sm:px-8 lg:px-12">
            {/* Left content */}
            <div className="py-8 sm:py-12 lg:py-16 z-10">
              <span className="text-xs sm:text-sm font-medium tracking-widest text-primary/80 uppercase">
                New Collection
              </span>
              <h2 className="mt-3 sm:mt-4 text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-serif text-white leading-tight">
                New{' '}
                <span className="text-primary italic">Collection</span>
              </h2>
              <p className="mt-3 sm:mt-4 text-sm sm:text-base text-white/60 max-w-md leading-relaxed">
                Discover our latest arrivals across beauty, skincare, hair and fashion. Fresh styles and favourites curated just for you.
              </p>
              <Link
                href="/collection"
                className="inline-flex mt-6 sm:mt-8 px-6 sm:px-8 py-3 sm:py-3.5 bg-primary text-white font-medium rounded-lg hover:bg-primary/90 transition-colors text-sm sm:text-base"
              >
                Explore Collection
              </Link>
            </div>
            {/* Right image */}
            <div className="relative flex justify-center lg:justify-end items-center py-6 sm:py-8 lg:py-0">
              <img
                src="/image.png"
                alt="Arade New Collection"
                className="w-full max-w-[250px] sm:max-w-[350px] lg:max-w-[480px] object-contain drop-shadow-2xl rounded-2xl"
              />
            </div>
          </div>
        </div>
      </div>
      </section>


      {/* Newsletter */}
      <section className="py-12 lg:py-16 bg-[#3d2a1e]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 lg:gap-12">
            <div className="text-center lg:text-left">
              <h2 className="text-3xl lg:text-4xl font-serif text-white">Stay Glowing</h2>
              <p className="mt-2 text-white/50 text-sm">
                Be the first to discover new products, exclusive offers, and style tips.
              </p>
            </div>
            <div className="flex-1 max-w-md">
              <NewsletterForm />
              <p className="mt-2 text-white/30 text-xs text-center lg:text-right">Unsubscribe anytime.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
