import { createClient } from "@/lib/supabase/server";
import ShopContent from "./ShopContent";

export default async function ShopPage() {
  const supabase = await createClient();

  const [prodsRes, catsRes] = await Promise.all([
    supabase.from("products").select("*, categories(name, slug)").eq("is_active", true),
    supabase.from("categories").select("*").not("parent_category_id", "is", null).order("name"),
  ]);

  return <ShopContent products={prodsRes.data || []} categories={catsRes.data || []} />;
}