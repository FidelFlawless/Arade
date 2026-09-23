import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import { sendOrderConfirmationEmail } from "@/lib/emails";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function getStripe() {
  const rawKey = process.env.STRIPE_SECRET_KEY || "";
  const cleanKey = rawKey.replace(/[^\x20-\x7E]/g, "").trim();
  return new Stripe(cleanKey);
}

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

  // If already marked as paid in DB
  if (order.payment_status === "paid") {
    return NextResponse.json({
      success: true,
      order: {
        ...order,
        total: Number(order.total),
      },
    });
  }

  // Fallback for Stripe: if webhook hasn't fired yet (e.g. testing on localhost or webhook delay)
  if (sessionId && order.payment_status !== "paid") {
    try {
      const stripe = getStripe();
      const session = await stripe.checkout.sessions.retrieve(sessionId);

      if (session.payment_status === "paid") {
        // Mark order as paid
        await supabaseAdmin
          .from("orders")
          .update({
            payment_status: "paid",
            payment_id: (session.payment_intent as string) || session.id,
            order_status: "processing",
          })
          .eq("id", order.id);

        // Check if payment record already inserted
        const { data: existingPayment } = await supabaseAdmin
          .from("payments")
          .select("id")
          .eq("stripe_checkout_session_id", session.id)
          .maybeSingle();

        if (!existingPayment) {
          await supabaseAdmin.from("payments").insert({
            order_id: order.id,
            provider: "stripe",
            stripe_checkout_session_id: session.id,
            stripe_payment_intent_id: (session.payment_intent as string) || null,
            amount: (session.amount_total || 0) / 100,
            currency: session.currency?.toUpperCase() || order.currency,
            status: "paid",
          });

          // Decrement stock for each item
          const { data: orderItems } = await supabaseAdmin
            .from("order_items")
            .select("product_id, quantity")
            .eq("order_id", order.id);

          if (orderItems) {
            for (const item of orderItems) {
              await supabaseAdmin.rpc("decrement_stock" as never, {
                p_product_id: item.product_id,
                p_quantity: item.quantity,
              } as never);
            }
          }

          sendOrderConfirmationEmail(order.id).catch(console.error);
        }

        return NextResponse.json({
          success: true,
          order: {
            ...order,
            payment_status: "paid",
            total: Number(order.total),
          },
        });
      }
    } catch (verifyError) {
      console.error("Stripe verify direct check error:", verifyError);
    }
  }

  // Still pending
  return NextResponse.json({ pending: true });
}
