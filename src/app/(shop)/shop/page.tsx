"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import ProductCard from "@/components/product/ProductCard";

export default function ShopPage() {
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("");
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    const loadData = async () => {
      const [prodsRes, catsRes] = await Promise.all([
        supabase.from("products").select("*, categories(name, slug)").eq("is_active", true),
        supabase.from("categories").select("*").not("parent_category_id", "is", null).order("name"),
      ]);
      setAllProducts(prodsRes.data || []);
      setCategories(catsRes.data || []);
      setLoading(false);
    };
    loadData();
  }, []);

  const filteredProducts = useMemo(() => {
    let result = allProducts;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((p) => p.name.toLowerCase().includes(q));
    }
    if (category) {
      result = result.filter((p) => p.categories?.slug === category);
    }
    switch (sort) {
      case "price-asc":
        result = [...result].sort((a, b) => a.price_cad - b.price_cad);
        break;
      case "price-desc":
        result = [...result].sort((a, b) => b.price_cad - a.price_cad);
        break;
      case "newest":
        result = [...result].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
      default:
        result = [...result].sort((a, b) => (b.is_featured ? 1 : 0) - (a.is_featured ? 1 : 0));
    }
    return result;
  }, [allProducts, search, category, sort]);

  const activeCategoryName = categories.find((c) => c.slug === category)?.name;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
          {activeCategoryName || "All Products"}
        </h1>
      </div>
      <div className="lg:hidden mb-4">
        <div className="relative">
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search products..." className="w-full pl-10 pr-4 py-2.5 border border-border rounded-lg text-sm bg-white outline-none" />
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
        </div>
      </div>
      {/* Mobile: Category Chips + Sort */}
      <div className="lg:hidden mb-4">
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4" style={{ scrollbarWidth: "none" }}>
          <button onClick={() => setCategory("")}
            className={"shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap " +
              (!category ? "bg-primary text-white" : "bg-white border border-border text-foreground/70 hover:border-primary/50")}
          >All Products</button>
          {categories.map((cat) => (
            <button key={cat.id} onClick={() => setCategory(category === cat.slug ? "" : cat.slug)}
              className={"shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap " +
                (category === cat.slug ? "bg-primary text-white" : "bg-white border border-border text-foreground/70 hover:border-primary/50")}
            >{cat.name}</button>
          ))}
        </div>
        <div className="mt-3">
          <select value={sort} onChange={(e) => setSort(e.target.value)} className="w-full px-4 py-2.5 border border-border rounded-lg text-sm bg-white outline-none">
            <option value="">Sort by: Featured</option>
            <option value="price-asc">Price: Low to High</option>
            <option value="price-desc">Price: High to Low</option>
            <option value="newest">Newest</option>
          </select>
        </div>
      </div>
      {/* Desktop: Search + Sort row */}
      <div className="hidden lg:flex items-center gap-4 mb-6">
        <div className="flex-1 relative">
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search products..." className="w-full pl-10 pr-4 py-2.5 border border-border rounded-lg text-sm bg-white outline-none" />
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
        </div>
        <select value={sort} onChange={(e) => setSort(e.target.value)} className="px-4 py-2.5 border border-border rounded-lg text-sm bg-white outline-none">
          <option value="">Sort by: Featured</option>
          <option value="price-asc">Price: Low to High</option>
          <option value="price-desc">Price: High to Low</option>
          <option value="newest">Newest</option>
        </select>
      </div>
      <p className="text-foreground/60 text-sm mb-6">{filteredProducts.length} products found</p>
      <div className="flex flex-col lg:flex-row gap-8">
        <aside className="hidden lg:block lg:w-64 shrink-0">
          <div className="card">
            <h3 className="font-semibold text-foreground mb-4">Categories</h3>
            <div className="space-y-2">
              <button onClick={() => setCategory("")} className={"block w-full text-left text-sm py-2 px-3 rounded-lg transition-colors " + (!category ? "bg-primary/10 text-primary font-medium" : "text-foreground/60 hover:bg-muted")}>All Products</button>
              {categories.map((cat) => (
                <button key={cat.id} onClick={() => setCategory(category === cat.slug ? "" : cat.slug)} className={"block w-full text-left text-sm py-2 px-3 rounded-lg transition-colors " + (category === cat.slug ? "bg-primary/10 text-primary font-medium" : "text-foreground/60 hover:bg-muted")}>{cat.name}</button>
              ))}
            </div>
          </div>
        </aside>
        <div className="flex-1">
          {loading ? (
            <div className="text-center py-16">
              <div className="inline-block w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
              <p className="mt-3 text-foreground/60 text-sm">Loading products...</p>
            </div>
          ) : filteredProducts.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 lg:gap-6">
              {filteredProducts.map((product) => (
                <ProductCard key={product.id} product={{ id: product.id, name: product.name, slug: product.slug, price_cad: product.price_cad, price_usd: product.price_usd, images: product.images, stock_quantity: product.stock_quantity }} />
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <p className="text-foreground/60">No products found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}