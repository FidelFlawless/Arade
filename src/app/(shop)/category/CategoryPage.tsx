import { createClient } from "@/lib/supabase/server";
import CategoryContent from "./CategoryContent";

export interface Subcategory {
  id: string;
  name: string;
  slug: string;
}

export interface CategoryProduct {
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

export default async function CategoryPage({
  categorySlug,
  title,
  description,
}: CategoryPageProps) {
  const supabase = await createClient();

  const { data: mainCat } = await supabase
    .from("categories")
    .select("id")
    .eq("slug", categorySlug)
    .single();

  const subcategories: Subcategory[] = [];
  let products: CategoryProduct[] = [];

  if (mainCat) {
    const { data: subs } = await supabase
      .from("categories")
      .select("id, name, slug")
      .eq("parent_category_id", mainCat.id)
      .eq("is_active", true)
      .order("name");

    for (const sub of subs || []) {
      subcategories.push({ id: sub.id, name: sub.name, slug: sub.slug });
    }

    if (subcategories.length > 0 || mainCat) {
      const subIds = subcategories.map((s) => s.id);
      // Products live on subcategories, but also include any attached
      // directly to the top-level category. Always scoped to this tree —
      // never mixed with other top-level categories.
      const ids = [...subIds, mainCat.id];
      const { data } = await supabase
        .from("products")
        .select("*")
        .eq("is_active", true)
        .in("category_id", ids);
      products = (data || []) as CategoryProduct[];
    }
  }

  return (
    <CategoryContent
      categorySlug={categorySlug}
      title={title}
      description={description}
      subcategories={subcategories}
      products={products}
    />
  );
}