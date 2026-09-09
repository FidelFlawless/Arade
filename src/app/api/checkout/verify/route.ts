import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("session_id");

  if (!sessionId) {
    return NextResponse.json({ error: "No session ID" }, { status: 400 });
  }

  // Find order by Stripe session ID
  const { data: order, error } = await supabaseAdmin
    .from("orders")
    .select("id, order_number, total, currency, payment_status")
    .eq("stripe_session_id", sessionId)
    .single();

  if (error || !order) {
    return NextResponse.json({ pending: true });
  }

  if (order.payment_status === "paid") {
    return NextResponse.json({ success: true, order });
  }

  // Still pending — webhook may not have fired yet
  return NextResponse.json({ pending: true });
}
