"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Sparkles, Droplets, Scissors, Shirt } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parent_category_id: string | null;
}

const iconMap: Record<string, React.ReactNode> = {
  beauty: <Sparkles className="w-8 h-8 text-white" strokeWidth={1.5} />,
  skincare: <Droplets className="w-8 h-8 text-white" strokeWidth={1.5} />,
  hair: <Scissors className="w-8 h-8 text-white" strokeWidth={1.5} />,
  fashion: <Shirt className="w-8 h-8 text-white" strokeWidth={1.5} />,
};

const colorMap: Record<string, string> = {
  beauty: "bg-[#c4956a]",
  skincare: "bg-[#8b7355]",
  hair: "bg-[#6b5b4a]",
  fashion: "bg-[#5a4a3a]",
};

export default function CategorySection() {
  const [categories, setCategories] = useState<Category[]>([]);
  const supabase = createClient();

  useEffect(() => {
    loadCategories();
  }, []);

  async function loadCategories() {
    const { data } = await supabase
      .from("categories")
      .select("*")
      .is("parent_category_id", null)
      .eq("is_active", true)
      .order("name");
    if (data) setCategories(data);
  }

  // Custom display order: Skincare first, then Beauty, Hair, Fashion
  const categoryOrder = ['skincare', 'beauty', 'hair', 'fashion'];
  categories.sort((a, b) => {
    const aIndex = categoryOrder.indexOf(a.slug);
    const bIndex = categoryOrder.indexOf(b.slug);
    return (aIndex === -1 ? 99 : aIndex) - (bIndex === -1 ? 99 : bIndex);
  });

  if (categories.length === 0) return null;

  return (
    <section className="py-16 lg:py-20 bg-muted/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <span className="text-sm font-medium tracking-widest text-primary uppercase">
            Explore
          </span>
          <h2 className="mt-3 text-3xl lg:text-4xl font-serif text-foreground">
            Shop by Category
          </h2>
          <p className="mt-3 text-foreground/60">
            Beauty, skincare, hair and fashion, all in one place
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {categories.map((cat) => (
            <Link
              key={cat.id}
              href={`/${cat.slug}`}
              className={`group relative ${
                colorMap[cat.slug] || "bg-[#8b7355]"
              } rounded-2xl p-8 text-left transition-all duration-300 hover:shadow-xl hover:-translate-y-1 overflow-hidden min-h-[220px] flex flex-col justify-end`}
            >
              <div className="absolute top-6 right-6 w-16 h-16 bg-white/10 rounded-full flex items-center justify-center">
                {iconMap[cat.slug] || <Sparkles className="w-8 h-8 text-white" strokeWidth={1.5} />}
              </div>
              <h3 className="text-2xl font-serif text-white mb-2">{cat.name}</h3>
              {cat.description && (
                <p className="text-white/70 text-sm leading-relaxed mb-4">
                  {cat.description}
                </p>
              )}
              <span className="inline-flex items-center text-white/90 text-sm font-medium group-hover:text-white transition-colors">
                Shop {cat.name} →
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
