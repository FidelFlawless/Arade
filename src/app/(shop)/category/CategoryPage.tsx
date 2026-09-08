"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Search, SlidersHorizontal, X } from "lucide-react";
import ProductCard from "@/components/product/ProductCard";

interface Subcategory {
  id: string;
  name: string;
  slug: string;
}

interface Product {
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

interface CategoryPageProps {
  categorySlug: string;
  title: string;
  description: string;
}

export default function CategoryPage({
  categorySlug,
  title,
  description,
}: CategoryPageProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [selectedSub, setSelectedSub] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("featured");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCategoryData();
  }, [categorySlug]);

  useEffect(() => {
    loadProducts();
  }, [selectedSub, sortBy, searchQuery]);

  async function loadCategoryData() {
    const supabase = createClient();

    // Get main category
    const { data: mainCat } = await supabase
      .from("categories")
      .select("id")
      .eq("slug", categorySlug)
      .single();

    if (!mainCat) {
      setLoading(false);
      return;
    }

    // Get subcategories
    const { data: subs } = await supabase
      .from("categories")
      .select("id, name, slug")
      .eq("parent_category_id", mainCat.id)
      .eq("is_active", true)
      .order("name");

    setSubcategories(subs || []);
    loadProducts(mainCat.id);
  }

  async function loadProducts(parentId?: string) {
    setLoading(true);
    const supabase = createClient();

    // Get main category ID if not provided
    if (!parentId) {
      const { data: mainCat } = await supabase
        .from("categories")
        .select("id")
        .eq("slug", categorySlug)
        .single();
      if (!mainCat) {
        setLoading(false);
        return;
      }
      parentId = mainCat.id;
    }

    // Get subcategory IDs under this parent
    const { data: subs } = await supabase
      .from("categories")
      .select("id")
      .eq("parent_category_id", parentId);

    const subIds = subs?.map((s) => s.id) || [];

    if (subIds.length === 0) {
      // Also check if the main category itself has products
      setProducts([]);
      setLoading(false);
      return;
    }

    // Query products in these subcategories
    let query = supabase
      .from("products")
      .select("*")
      .eq("is_active", true)
      .in("category_id", subIds);

    // Filter by selected subcategory
    if (selectedSub) {
      query = query.eq("category_id", selectedSub);
    }

    // Search filter
    if (searchQuery.trim()) {
      query = query.ilike("name", `%${searchQuery.trim()}%`);
    }

    // Sort
    switch (sortBy) {
      case "newest":
        query = query.order("created_at", { ascending: false });
        break;
      case "price-low":
        query = query.order("price_cad", { ascending: true });
        break;
      case "price-high":
        query = query.order("price_cad", { ascending: false });
        break;
      case "featured":
      default:
        query = query.order("is_featured", { ascending: false }).order("created_at", { ascending: false });
        break;
    }

    const { data } = await query;
    setProducts(data || []);
    setLoading(false);
  }

  return (
    <div className="min-h-screen">
      {/* Category Hero */}
      <section className="bg-[#f5f0ea] py-12 lg:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <span className="text-sm font-medium tracking-widest text-primary uppercase">
            {title}
          </span>
          <h1 className="mt-3 text-3xl sm:text-4xl lg:text-5xl font-serif text-foreground">
            {title}
          </h1>
          <p className="mt-4 text-foreground/60 max-w-xl">{description}</p>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar - Desktop */}
          <aside className="hidden lg:block w-64 flex-shrink-0">
            <div className="sticky top-24">
              <h3 className="font-semibold text-foreground mb-4">Subcategories</h3>
              <div className="space-y-1">
                <button
                  onClick={() => setSelectedSub(null)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                    !selectedSub
                      ? "bg-primary text-white"
                      : "text-foreground/70 hover:bg-muted"
                  }`}
                >
                  All {title}
                </button>
                {subcategories.map((sub) => (
                  <button
                    key={sub.id}
                    onClick={() => setSelectedSub(sub.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                      selectedSub === sub.id
                        ? "bg-primary text-white"
                        : "text-foreground/70 hover:bg-muted"
                    }`}
                  >
                    {sub.name}
                  </button>
                ))}
              </div>
            </div>
          </aside>

          {/* Main content */}
          <div className="flex-1">
            {/* Mobile subcategory chips */}
            <div className="lg:hidden mb-4 overflow-x-auto">
              <div className="flex gap-2 pb-2">
                <button
                  onClick={() => setSelectedSub(null)}
                  className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                    !selectedSub
                      ? "bg-primary text-white"
                      : "bg-muted text-foreground/70"
                  }`}
                >
                  All
                </button>
                {subcategories.map((sub) => (
                  <button
                    key={sub.id}
                    onClick={() => setSelectedSub(sub.id)}
                    className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                      selectedSub === sub.id
                        ? "bg-primary text-white"
                        : "bg-muted text-foreground/70"
                    }`}
                  >
                    {sub.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Search and Sort */}
            <div className="flex flex-col sm:flex-row gap-3 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/40" />
                <input
                  type="text"
                  placeholder={`Search ${title.toLowerCase()}...`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:border-primary bg-white"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground/40 hover:text-foreground"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-4 py-2.5 border border-border rounded-lg text-sm bg-white focus:outline-none focus:border-primary"
              >
                <option value="featured">Featured</option>
                <option value="newest">Newest</option>
                <option value="price-low">Price: Low to High</option>
                <option value="price-high">Price: High to Low</option>
              </select>
            </div>

            {/* Product count */}
            <p className="text-sm text-foreground/60 mb-4">
              {loading ? "Loading..." : `${products.length} product${products.length !== 1 ? "s" : ""}`}
            </p>

            {/* Product grid */}
            {loading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 lg:gap-6">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="animate-pulse">
                    <div className="bg-muted rounded-xl aspect-square" />
                    <div className="mt-3 space-y-2">
                      <div className="bg-muted rounded h-4 w-3/4" />
                      <div className="bg-muted rounded h-4 w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : products.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 lg:gap-6">
                {products.map((product) => (
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
            ) : (
              <div className="text-center py-16">
                <p className="text-foreground/60 mb-4">No products found in this category.</p>
                <button
                  onClick={() => {
                    setSelectedSub(null);
                    setSearchQuery("");
                  }}
                  className="px-6 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
                >
                  Clear Filters
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
