import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendOrderConfirmationEmail } from "@/lib/emails";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID!;
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET!;
const PAYPAL_ENV = process.env.PAYPAL_ENVIRONMENT || "sandbox";

const PAYPAL_BASE =
  PAYPAL_ENV === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";

async function getPayPalAccessToken(): Promise<string> {
  const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString("base64");

  const response = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!response.ok) {
    throw new Error("Failed to get PayPal access token");
  }

  const data = await response.json();
  return data.access_token;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { paypalOrderId } = body;

    if (!paypalOrderId) {
      return NextResponse.json({ error: "Missing PayPal order ID" }, { status: 400 });
    }

    // 1. Check for duplicate capture (idempotency)
    const { data: existingPayment } = await supabaseAdmin
      .from("payments")
      .select("id, status")
      .eq("paypal_order_id", paypalOrderId)
      .single();

    if (existingPayment && existingPayment.status === "succeeded") {
      return NextResponse.json({ success: true, alreadyCaptured: true });
    }

    // 2. Capture the PayPal order
    const accessToken = await getPayPalAccessToken();

    const captureResponse = await fetch(
      `${PAYPAL_BASE}/v2/checkout/orders/${paypalOrderId}/capture`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
      }
    );

    if (!captureResponse.ok) {
      const errorData = await captureResponse.json().catch(() => ({}));
      console.error("PayPal capture error:", errorData);

      // Check if already captured
      if (captureResponse.status === 422) {
        const errorDetails = errorData?.details || [];
        const alreadyCaptured = errorDetails.some(
          (d: { issue?: string }) => d.issue === "ORDER_ALREADY_CAPTURED"
        );
        if (alreadyCaptured) {
          return NextResponse.json({ success: true, alreadyCaptured: true });
        }
      }

      return NextResponse.json(
        { error: "Failed to capture PayPal payment" },
        { status: 500 }
      );
    }

    const captureData = await captureResponse.json();

    // 3. Verify capture status
    const captureStatus = captureData.status;
    if (captureStatus !== "COMPLETED") {
      return NextResponse.json(
        { error: `PayPal capture status: ${captureStatus}` },
        { status: 500 }
      );
    }

    // 4. Find the Arade order using the reference_id (order_number) or the custom_id (order.id)
    const purchaseUnit = captureData.purchase_units?.[0];
    const referenceId = purchaseUnit?.reference_id;
    const customId = purchaseUnit?.custom_id; // This is the Arade order ID

    let order = null;

    // Try by order ID first (custom_id)
    if (customId) {
      const { data } = await supabaseAdmin
        .from("orders")
        .select("id, order_number, total, currency, payment_status")
        .eq("id", customId)
        .single();
      order = data;
    }

    // Fallback: try by order_number (reference_id)
    if (!order && referenceId) {
      const { data } = await supabaseAdmin
        .from("orders")
        .select("id, order_number, total, currency, payment_status")
        .eq("order_number", referenceId)
        .single();
      order = data;
    }

    // Fallback: try by stripe_session_id containing the PayPal order ID
    if (!order) {
      const { data } = await supabaseAdmin
        .from("orders")
        .select("id, order_number, total, currency, payment_status")
        .eq("stripe_session_id", `paypal:${paypalOrderId}`)
        .single();
      order = data;
    }

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // 5. Verify the captured amount matches the order total
    const capturedAmount = parseFloat(
      purchaseUnit?.payments?.captures?.[0]?.amount?.value || "0"
    );

    if (Math.abs(capturedAmount - order.total) > 0.01) {
      console.error(
        `Amount mismatch: PayPal captured ${capturedAmount}, order total ${order.total}`
      );
      // Still proceed but log the discrepancy
    }

    // 6. If already paid, don't process again (idempotency)
    if (order.payment_status === "paid") {
      return NextResponse.json({ success: true, alreadyCaptured: true });
    }

    // 7. Mark order as paid
    const captureId = purchaseUnit?.payments?.captures?.[0]?.id || "";

    const { error: updateError } = await supabaseAdmin
      .from("orders")
      .update({
        payment_status: "paid",
        payment_id: captureId,
        order_status: "processing",
      })
      .eq("id", order.id);

    if (updateError) {
      console.error("Failed to update order:", updateError);
      return NextResponse.json({ error: "Failed to update order" }, { status: 500 });
    }

    // 8. Create payment record
    await supabaseAdmin.from("payments").insert({
      order_id: order.id,
      provider: "paypal",
      paypal_order_id: paypalOrderId,
      amount: capturedAmount || order.total,
      currency: order.currency,
      status: "succeeded",
    });

    // 9. Decrement stock for each order item
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

    console.log(`Order ${order.id} marked as PAID via PayPal (${paypalOrderId})`);

    // Send the order confirmation email (fire-and-forget; never blocks checkout)
    sendOrderConfirmationEmail(order.id).then((sent) => {
      if (!sent) console.error(`Confirmation email failed for order ${order.id}`);
    });

    return NextResponse.json({
      success: true,
      orderId: order.id,
      orderNumber: order.order_number,
      total: order.total,
      currency: order.currency,
    });
  } catch (error: unknown) {
    console.error("PayPal capture error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
