import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminUser } from "@/lib/auth/admin";

// GET - List all orders (admin only)
export async function GET() {
  // Authorization runs first: the service-role client is only created once the
  // request has been verified as an authenticated admin.
  const auth = await requireAdminUser();
  if (!auth.allowed) return auth.response;

  const supabaseAdmin = createAdminClient();
  const { data, error } = await supabaseAdmin
    .from("orders")
    .select("*, profiles(full_name, email), order_items(id)")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// PUT - Update order status (admin only)
export async function PUT(req: NextRequest) {
  const auth = await requireAdminUser();
  if (!auth.allowed) return auth.response;

  const supabaseAdmin = createAdminClient();
  const body = await req.json();
  const { id, order_status } = body;
  if (!id) return NextResponse.json({ error: "Order ID required" }, { status: 400 });
  const { data, error } = await supabaseAdmin
    .from("orders")
    .update({ order_status })
    .eq("id", id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
