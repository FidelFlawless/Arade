"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { Search, X, Loader2, ArrowRight, ShoppingBag } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface SearchResult {
  id: string;
  name: string;
  slug: string;
  price_cad: number;
  price_usd: number;
  images: string[] | null;
  categories: { name: string }[] | null;
}

interface SearchPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SearchPanel({ isOpen, onClose }: SearchPanelProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  // Initialised with sensible defaults so the chips never render empty;
  // replaced by real tracked-search data when the panel opens.
  const [popular, setPopular] = useState<string[]>([
    "wig",
    "cream",
    "serum",
    "oil",
  ]);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const supabase = createClient();

  // Real popular searches from tracked site searches (catalog-derived
  // fallback while data accumulates).
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    fetch("/api/search/popular")
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled && Array.isArray(d.terms) && d.terms.length > 0) {
          setPopular(d.terms.slice(0, 6));
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  const searchProducts = useCallback(
    async (searchQuery: string) => {
      if (searchQuery.trim().length < 2) {
        setResults([]);
        setSearched(false);
        setLoading(false);
        return;
      }
      setLoading(true);
      setSearched(true);
      // Fire-and-forget: track the search for the popular-searches ranking.
      fetch("/api/search/log", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ term: searchQuery.trim() }),
      }).catch(() => {});
      const { data } = await supabase
        .from("products")
        .select("id, name, slug, price_cad, price_usd, images, categories(name)")
        .eq("is_active", true)
        .ilike("name", `%${searchQuery.trim()}%`)
        .limit(6);
      setResults(data || []);
      setLoading(false);
    },
    [supabase]
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      searchProducts(query);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, searchProducts]);

  const handleResultClick = () => {
    setQuery("");
    setResults([]);
    setSearched(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100]">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full bg-white shadow-2xl border-b border-border">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center gap-3">
            <Search className="w-5 h-5 text-foreground/40 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search for products..."
              className="flex-1 text-lg py-2 outline-none bg-transparent text-foreground placeholder-foreground/40"
            />
            {query && (
              <button onClick={() => { setQuery(""); setResults([]); setSearched(false); inputRef.current?.focus(); }} className="p-1 text-foreground/40 hover:text-foreground transition-colors">
                <X className="w-5 h-5" />
              </button>
            )}
            <button onClick={onClose} className="ml-2 text-sm text-foreground/50 hover:text-foreground transition-colors hidden sm:block">ESC</button>
            <button onClick={onClose} className="ml-2 p-1 text-foreground/40 hover:text-foreground transition-colors sm:hidden"><X className="w-5 h-5" /></button>
          </div>
          <div className="mt-4 max-h-[60vh] overflow-y-auto">
            {loading && (
              <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 text-primary animate-spin" /></div>
            )}
            {!loading && results.length > 0 && (
              <div className="space-y-1">
                {results.map((product) => (
                  <Link key={product.id} href={`/product/${product.slug}`} onClick={handleResultClick} className="flex items-center gap-4 p-3 rounded-xl hover:bg-muted transition-colors group">
                    <div className="relative w-14 h-14 bg-muted rounded-lg overflow-hidden shrink-0">
                      {product.images && product.images[0] ? (
                        <Image src={product.images[0]} alt={product.name} fill sizes="56px" loading="lazy" decoding="async" style={{ objectFit: "cover" }} />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-foreground/20"><ShoppingBag className="w-5 h-5" /></div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-foreground text-sm truncate group-hover:text-primary transition-colors">{product.name}</h4>
                      {product.categories?.[0]?.name && <p className="text-xs text-foreground/40 mt-0.5">{product.categories[0].name}</p>}
                    </div>
                    <span className="font-semibold text-primary text-sm shrink-0">C${product.price_cad}</span>
                  </Link>
                ))}
                <Link href={`/shop?search=${encodeURIComponent(query)}`} onClick={handleResultClick} className="flex items-center justify-center gap-2 py-3 mt-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors border-t border-border">
                  View all results for &quot;{query}&quot; <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            )}
            {!loading && searched && results.length === 0 && (
              <div className="text-center py-12">
                <ShoppingBag className="w-12 h-12 text-foreground/15 mx-auto mb-3" />
                <p className="text-foreground/50 text-sm">No products found for &quot;{query}&quot;</p>
                <p className="text-foreground/30 text-xs mt-1">Try a different search term</p>
              </div>
            )}
            {!loading && !searched && (
              <div className="py-4">
                <p className="text-xs text-foreground/40 uppercase tracking-wider mb-3">Popular searches</p>
                <div className="flex flex-wrap gap-2">
                  {popular.map((term) => (
                    <button key={term} onClick={() => setQuery(term)} className="px-3 py-1.5 text-xs text-foreground/60 bg-muted rounded-full hover:bg-primary/10 hover:text-primary transition-colors">{term}</button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}