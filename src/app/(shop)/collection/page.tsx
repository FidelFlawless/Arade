"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import ProductCard from "@/components/product/ProductCard";
import Link from "next/link";
import { Loader2 } from "lucide-react";

interface Collection {
  name: string;
  slug: string;
  description: string;
  image: string | null;
  productCount: number;
}

export default function CollectionPage() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    const loadCollections = async () => {
      const [catsRes, prodsRes] = await Promise.all([
        supabase.from("categories").select("*").order("name"),
        supabase.from("products").select("id, category_id, images, is_active, is_featured").eq("is_active", true),
      ]);
      const categories = catsRes.data || [];
      const products = prodsRes.data || [];
      const cols = [];
      for (const cat of categories) {
        const catProds = products.filter(p => p.category_id === cat.id);
        cols.push({ name: cat.name, slug: cat.slug, description: getDesc(cat.name), image: catProds[0] && catProds[0].images && catProds[0].images[0] ? catProds[0].images[0] : null, productCount: catProds.length });
      }
      const featured = products.filter(p => p.is_featured);
      cols.unshift({ name: "Glow & Radiance", slug: "glow-radiance", description: "Products picked for radiant, glowing skin.", image: featured[0] && featured[0].images && featured[0].images[0] ? featured[0].images[0] : null, productCount: featured.length });
      setCollections(cols);
      setLoading(false);
      const catParam = searchParams.get("category");
      if (catParam) {
        setTimeout(() => loadProducts(catParam), 200);
      }
    };
    loadCollections();
  }, []);

  const productsRef = { current: null as HTMLDivElement | null };

  const loadProducts = async (slug: string) => {
    if (selectedCollection === slug) { setSelectedCollection(null); setProducts([]); return; }
    setSelectedCollection(slug);
    setProductsLoading(true);
    let q = supabase.from("products").select("*, categories(name, slug)").eq("is_active", true);
    if (slug === "glow-radiance") { q = q.eq("is_featured", true); }
    else { const { data: c } = await supabase.from("categories").select("id").eq("slug", slug).single(); if (c) q = q.eq("category_id", c.id); }
    const { data } = await q.limit(12);
    setProducts(data || []);
    setProductsLoading(false);
    setTimeout(() => {
      const el = document.getElementById("collection-products");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  };

  if (loading) return <div className="min-h-[60vh] flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div>
      {/* Hero */}
      <section className="relative bg-[#d5c4a8] overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
          <div className="grid grid-cols-1 lg:grid-cols-[4fr_6fr] gap-8 items-center min-h-[350px] lg:min-h-[450px]">
            <div className="py-8 lg:py-0 z-10">
              <div className="flex items-center gap-3 mb-6">
                <span className="text-sm font-medium tracking-widest text-primary uppercase">Our Collections</span>
                <span className="w-12 h-[1px] bg-primary"></span>
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-serif text-foreground leading-[1.1]">
                Curated skincare for{" "}
                <span className="text-primary italic">every beauty routine.</span>
              </h1>
              <p className="mt-6 text-lg text-foreground/60 max-w-md leading-relaxed">
                Thoughtfully chosen products to cleanse, nourish and reveal your natural glow.
              </p>
            </div>
            <div className="relative flex justify-end items-center -mr-4 sm:-mr-8 lg:-mr-0">
              <img src="/hero-product.png" alt="Arade Collection" className="w-full max-w-[380px] lg:max-w-[520px] h-auto object-contain mix-blend-multiply" style={{maskImage:"linear-gradient(to right,transparent 0%,black 15%)",WebkitMaskImage:"linear-gradient(to right,transparent 0%,black 15%)"}} />
            </div>
          </div>
        </div>
      </section>

      {/* Collections Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <div className="text-center mb-12">
          <h2 className="text-sm font-medium tracking-widest text-primary uppercase mb-3">Featured Collections</h2>
          <p className="text-3xl lg:text-4xl font-serif text-foreground">Explore by Category</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {collections.map((col) => (
            <button key={col.slug} onClick={() => loadProducts(col.slug)} className={"group text-left rounded-2xl overflow-hidden border transition-all duration-300 hover:shadow-lg cursor-pointer " + (selectedCollection === col.slug ? "border-primary shadow-lg ring-1 ring-primary/20" : "border-border bg-white")}>
              <div className="aspect-[16/10] bg-muted relative overflow-hidden">
                {col.image ? <img src={col.image} alt={col.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" /> : <div className="w-full h-full flex items-center justify-center text-foreground/20">No Image</div>}
              </div>
              <div className="p-5">
                <h3 className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors">{col.name}</h3>
                <p className="mt-1 text-sm text-foreground/50">{col.productCount} products</p>
                <p className="mt-2 text-sm text-foreground/60 line-clamp-2">{col.description}</p>
                <div className="mt-3 text-sm font-medium text-primary flex items-center gap-1">Explore Collection <span className="group-hover:translate-x-1 transition-transform">&rarr;</span></div>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Products */}
      {selectedCollection && (
        <section id="collection-products" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
          <div className="border-t border-border pt-12">
            <nav className="text-sm text-foreground/50 mb-6">
              <Link href="/" className="hover:text-primary">Home</Link> / 
              <Link href="/collection" className="hover:text-primary">Collection</Link> / 
              <span className="text-foreground">{collections.find((c) => c.slug === selectedCollection)?.name}</span>
            </nav>
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-bold text-foreground">{collections.find((c) => c.slug === selectedCollection)?.name}</h2>
              <button onClick={() => { setSelectedCollection(null); setProducts([]); }} className="text-sm text-primary hover:text-primary/80">Clear filter</button>
            </div>
            {productsLoading ? (
              <div className="text-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" /></div>
            ) : products.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
                {products.map((p) => (
                  <ProductCard key={p.id} product={{ id: p.id, name: p.name, slug: p.slug, price_cad: p.price_cad, price_usd: p.price_usd, images: p.images, stock_quantity: p.stock_quantity }} />
                ))}
              </div>
            ) : <div className="text-center py-16 text-foreground/50">No products found.</div>}
          </div>
        </section>
      )}
    </div>
  );
}

function getDesc(name: string): string {
  const d: Record<string, string> = { Cleansers: "Gentle formulas to purify and refresh.", Moisturizers: "Hydrating creams for all-day soft skin.", Soaps: "Luxurious cleansing bars for daily use.", "Skincare Sets": "Curated bundles for a complete routine.", "Body care": "Nourishing products for head-to-toe radiance." };
  return d[name] || "Explore our curated " + name.toLowerCase() + " collection.";
}