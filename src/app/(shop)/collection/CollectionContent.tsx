"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import ProductCard from "@/components/product/ProductCard";

interface Collection {
  name: string;
  slug: string;
  description: string;
  image: string | null;
  productCount: number;
}

interface CollectionProduct {
  id: string;
  name: string;
  slug: string;
  price_cad: number;
  price_usd: number;
  images: string[];
  stock_quantity: number;
  category_id: string;
  is_featured: boolean;
  created_at: string;
}

interface CollectionCategory {
  id: string;
  name: string;
  slug: string;
}

interface CollectionContentProps {
  collections: Collection[];
  allProducts: CollectionProduct[];
  categories: CollectionCategory[];
  initialSlug: string | null;
  initialProducts: CollectionProduct[];
}

function selectProducts(all: CollectionProduct[], slug: string, categories: CollectionCategory[]): CollectionProduct[] {
  if (slug === "glow-radiance") return all.filter((p) => p.is_featured);
  const cat = categories.find((c) => c.slug === slug);
  return cat ? all.filter((p) => p.category_id === cat.id) : [];
}

export default function CollectionContent({
  collections,
  allProducts,
  categories,
  initialSlug,
  initialProducts,
}: CollectionContentProps) {
  const [selectedCollection, setSelectedCollection] = useState<string | null>(initialSlug);
  const [products, setProducts] = useState<CollectionProduct[]>(initialProducts);

  const loadProducts = (slug: string) => {
    if (selectedCollection === slug) {
      setSelectedCollection(null);
      setProducts([]);
      return;
    }
    setSelectedCollection(slug);
    setProducts(selectProducts(allProducts, slug, categories).slice(0, 12));
    setTimeout(() => {
      const el = document.getElementById("collection-products");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  };

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
              <img src="/image.webp" alt="Arade Collection" width={1536} height={1024} decoding="async" className="w-full max-w-[380px] lg:max-w-[520px] h-auto object-contain mix-blend-multiply" style={{ maskImage: "linear-gradient(to right,transparent 0%,black 15%)", WebkitMaskImage: "linear-gradient(to right,transparent 0%,black 15%)" }} />
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
                {col.image ? (
                  <Image src={col.image} alt={col.name} fill sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" loading="lazy" decoding="async" style={{ objectFit: "cover" }} className="group-hover:scale-105 transition-transform duration-500" />
                ) : <div className="w-full h-full flex items-center justify-center text-foreground/20">No Image</div>}
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
            {products.length > 0 ? (
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