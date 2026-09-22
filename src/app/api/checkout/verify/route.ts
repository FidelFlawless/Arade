import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("session_id");
  const paypalOrderId = searchParams.get("paypal_order_id");

  if (!sessionId && !paypalOrderId) {
    return NextResponse.json({ error: "No session or order ID" }, { status: 400 });
  }

  let order = null;

  if (sessionId) {
    // Stripe flow — find by Stripe session ID
    const { data, error } = await supabaseAdmin
      .from("orders")
      .select("id, order_number, total, currency, payment_status")
      .eq("stripe_session_id", sessionId)
      .single();

    if (error || !data) {
      return NextResponse.json({ pending: true });
    }
    order = data;
  }

  if (paypalOrderId && !order) {
    // PayPal flow — find by PayPal order ID stored in stripe_session_id
    const { data, error } = await supabaseAdmin
      .from("orders")
      .select("id, order_number, total, currency, payment_status")
      .eq("stripe_session_id", `paypal:${paypalOrderId}`)
      .single();

    if (error || !data) {
      return NextResponse.json({ pending: true });
    }
    order = data;
  }

  if (!order) {
    return NextResponse.json({ pending: true });
  }

  if (order.payment_status === "paid") {
    // Supabase returns NUMERIC columns as strings - coerce before the
    // client calls .toFixed(2) on them
    return NextResponse.json({
      success: true,
      order: {
        ...order,
        total: Number(order.total),
      },
    });
  }

  // Still pending — capture may not have fired yet
  return NextResponse.json({ pending: true });
}
