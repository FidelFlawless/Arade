"use client";

import { useRouter } from "next/navigation";
import { Heart, Droplet, Droplets, Flower2, Package } from "lucide-react";

interface Category { id: string; name: string; slug: string; }

const iconMap: Record<string, React.ReactNode> = {
  "body-care": <Heart className="w-6 h-6 text-primary" strokeWidth={1.5} />,
  "cleansers": <Droplet className="w-6 h-6 text-primary" strokeWidth={1.5} />,
  "moisturizers": <Droplets className="w-6 h-6 text-primary" strokeWidth={1.5} />,
  "soaps": <Flower2 className="w-6 h-6 text-primary" strokeWidth={1.5} />,
  "skincare-sets": <Package className="w-6 h-6 text-primary" strokeWidth={1.5} />,
};

export default function CategorySection({ categories }: { categories: Category[] }) {
  const router = useRouter();

  return (
    <section className="py-16 lg:py-20 bg-muted/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-foreground">Shop by Category</h2>
          <p className="mt-3 text-foreground/60">Find what your skin needs</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => router.push("/collection?category=" + encodeURIComponent(cat.slug))}
              className="bg-white rounded-xl p-6 text-center transition-all duration-200 border border-border hover:shadow-lg hover:-translate-y-1 cursor-pointer"
            >
              <div className="w-14 h-14 mx-auto mb-3 bg-primary/10 rounded-full flex items-center justify-center">
                {iconMap[cat.slug] || <Package className="w-6 h-6 text-primary" strokeWidth={1.5} />}
              </div>
              <h3 className="font-medium text-foreground text-sm">{cat.name}</h3>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
