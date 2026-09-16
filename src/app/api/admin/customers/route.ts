import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminUser } from "@/lib/auth/admin";

// GET - List all customers with order stats (admin only)
export async function GET() {
  // Authorization runs first: the service-role client is only created once the
  // request has been verified as an authenticated admin.
  const auth = await requireAdminUser();
  if (!auth.allowed) return auth.response;

  const supabaseAdmin = createAdminClient();
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
