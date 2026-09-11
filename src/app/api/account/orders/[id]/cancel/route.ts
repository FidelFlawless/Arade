import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: order, error: orderError } = await admin
    .from("orders")
    .select("id, order_status, payment_status")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (orderError || !order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  if (order.order_status !== "pending") {
    return NextResponse.json(
      { error: "Only pending orders can be cancelled" },
      { status: 409 }
    );
  }

  const { data, error } = await admin
    .from("orders")
    .update({ order_status: "cancelled" })
    .eq("id", id)
    .eq("user_id", user.id)
    .eq("order_status", "pending")
    .select("id, order_status")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Unable to cancel order" }, { status: 500 });
  }

  return NextResponse.json(data);
}
