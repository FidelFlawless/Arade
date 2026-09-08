import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET - List all orders
export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("orders")
    .select("*, profiles(full_name, email), order_items(id)")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// PUT - Update order status
export async function PUT(req: NextRequest) {
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
