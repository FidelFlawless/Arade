import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET - List all customers with order stats
export async function GET() {
  const { data: profiles, error } = await supabaseAdmin
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Get order counts for each customer
  const customers = await Promise.all(
    (profiles || []).map(async (profile) => {
      const { data: orders } = await supabaseAdmin
        .from("orders")
        .select("total")
        .eq("user_id", profile.id);
      return {
        ...profile,
        orders_count: orders?.length || 0,
        total_spent: orders?.reduce((sum, o) => sum + (o.total || 0), 0) || 0,
      };
    })
  );

  return NextResponse.json(customers);
}
