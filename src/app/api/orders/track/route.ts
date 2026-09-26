import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/orders/track?order=ARD-XXXX&email=customer@example.com
 *
 * Guest order status lookup. Requires BOTH the order number and the email
 * used at checkout to match the same order, so neither value alone reveals
 * anything. Read-only: returns status info, never addresses or payment ids.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const orderNumber = (searchParams.get("order") || "").trim().toUpperCase();
    const email = (searchParams.get("email") || "").trim().toLowerCase();

    if (!orderNumber || !email) {
      return NextResponse.json(
        { error: "Both order number and email are required" },
        { status: 400 }
      );
    }

    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .select(
        `id, order_number, order_status, payment_status, currency,
         subtotal, delivery_fee, discount, total, created_at,
         shipping_email, user_id,
         order_items (product_name, quantity, unit_price, subtotal)`
      )
      .eq("order_number", orderNumber)
      .single();

    // Not found OR email mismatch return the same generic response,
    // so probing order numbers reveals nothing.
    if (error || !order) {
      return NextResponse.json({ found: false }, { status: 404 });
    }

    const orderEmail = (order.shipping_email || "").toLowerCase();
    if (!orderEmail || orderEmail !== email) {
      return NextResponse.json({ found: false }, { status: 404 });
    }

    return NextResponse.json({
      found: true,
      order: {
        order_number: order.order_number,
        order_status: order.order_status,
        payment_status: order.payment_status,
        currency: order.currency,
        subtotal: Number(order.subtotal),
        delivery_fee: Number(order.delivery_fee),
        discount: Number(order.discount || 0),
        total: Number(order.total),
        created_at: order.created_at,
        items: (order.order_items || []).map((item: { product_name: string; quantity: number; unit_price: number | string; subtotal: number | string }) => ({
          product_name: item.product_name,
          quantity: item.quantity,
          unit_price: Number(item.unit_price),
          subtotal: Number(item.subtotal),
        })),
      },
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
