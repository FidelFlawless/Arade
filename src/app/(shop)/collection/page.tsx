import { createClient } from "@/lib/supabase/server";
import CollectionContent from "./CollectionContent";

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

function getDesc(name: string): string {
  const d: Record<string, string> = { Cleansers: "Gentle formulas to purify and refresh.", Moisturizers: "Hydrating creams for all-day soft skin.", Soaps: "Luxurious cleansing bars for daily use.", "Skincare Sets": "Curated bundles for a complete routine.", "Body care": "Nourishing products for head-to-toe radiance." };
  return d[name] || "Explore our curated " + name.toLowerCase() + " collection.";
}

export default async function CollectionPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const supabase = await createClient();

  const [catsRes, prodsRes] = await Promise.all([
    supabase.from("categories").select("id, name, slug").order("name"),
    supabase
      .from("products")
      .select("id, name, slug, price_cad, price_usd, images, stock_quantity, category_id, is_active, is_featured, created_at")
      .eq("is_active", true),
  ]);

  const categories = catsRes.data || [];
  const allProducts: CollectionProduct[] = prodsRes.data || [];

  const collections: Collection[] = categories.map((cat) => {
    const catProds = allProducts.filter((p) => p.category_id === cat.id);
    return {
      name: cat.name,
      slug: cat.slug,
      description: getDesc(cat.name),
      image: catProds[0] && catProds[0].images && catProds[0].images[0] ? catProds[0].images[0] : null,
      productCount: catProds.length,
    };
  });
  const featured = allProducts.filter((p) => p.is_featured);
  collections.unshift({
    name: "Glow & Radiance",
    slug: "glow-radiance",
    description: "Products picked for radiant, glowing skin.",
    image: featured[0] && featured[0].images && featured[0].images[0] ? featured[0].images[0] : null,
    productCount: featured.length,
  });

  const params = await searchParams;
  const rawCat = params.category;
  const catParam = Array.isArray(rawCat) ? rawCat[0] : rawCat;
  const selected = catParam ? collections.find((c) => c.slug === catParam) : undefined;

  let initialSlug: string | null = null;
  let initialProducts: CollectionProduct[] = [];
  if (selected) {
    initialSlug = selected.slug;
    const cat = categories.find((c) => c.slug === selected.slug);
    initialProducts = (selected.slug === "glow-radiance"
      ? allProducts.filter((p) => p.is_featured)
      : cat ? allProducts.filter((p) => p.category_id === cat.id) : []
    ).slice(0, 12);
  }

  return (
    <CollectionContent
      collections={collections}
      allProducts={allProducts}
      categories={categories}
      initialSlug={initialSlug}
      initialProducts={initialProducts}
    />
  );
}