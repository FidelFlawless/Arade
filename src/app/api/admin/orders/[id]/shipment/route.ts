import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createCanadaPostShipment, CanadaPostError } from "@/lib/canadapost";
import { sendShippedEmail } from "@/lib/emails";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const DEFAULT_ITEM_WEIGHT_GRAMS = 250;

/**
 * POST /api/admin/orders/[id]/shipment
 * Creates the Canada Post shipment for a PAID order and stores the tracking
 * number + label link on the order. Admin only.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Admin auth check
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const token = authHeader.replace(/^Bearer\s+/i, "");
    const supabaseAuth = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data: { user } } = await supabaseAuth.auth.getUser(token);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select(
        `id, order_number, payment_status, shipping_method_code,
         shipping_first_name, shipping_last_name, shipping_phone,
         shipping_address_line1, shipping_address_line2, shipping_city,
         shipping_state_province, shipping_postal_code, shipping_country,
         tracking_number`
      )
      .eq("id", id)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (order.tracking_number) {
      return NextResponse.json(
        { error: `A shipment already exists for this order (tracking ${order.tracking_number})` },
        { status: 409 }
      );
    }

    if (order.payment_status !== "paid") {
      return NextResponse.json(
        { error: "Only paid orders can be shipped" },
        { status: 400 }
      );
    }

    if (!order.shipping_method_code) {
      return NextResponse.json(
        { error: "This order has no Canada Post service code (placed before the Canada Post integration?)" },
        { status: 400 }
      );
    }

    // Packed weight from order items
    const { data: thisItems } = await supabaseAdmin
      .from("order_items")
      .select("quantity, products(weight_grams)")
      .eq("order_id", id);

    const totalWeightKg =
      (thisItems || []).reduce((sum, item) => {
        const product = item.products as { weight_grams?: number } | null;
        const grams = (product?.weight_grams ?? DEFAULT_ITEM_WEIGHT_GRAMS) * item.quantity;
        return sum + grams;
      }, 0) / 1000 || 0.25;

    const destination = {
      name: `${order.shipping_first_name} ${order.shipping_last_name}`.trim(),
      phone: order.shipping_phone || undefined,
      addressLine1: order.shipping_address_line1,
      addressLine2: order.shipping_address_line2 || undefined,
      city: order.shipping_city,
      provState: order.shipping_state_province,
      postalCode: order.shipping_postal_code,
      country: order.shipping_country as "CA" | "US",
    };

    try {
      const shipment = await createCanadaPostShipment({
        serviceCode: order.shipping_method_code,
        destination,
        weightKg: totalWeightKg,
        orderId: order.order_number,
      });

      const { error: updateError } = await supabaseAdmin
        .from("orders")
        .update({
          tracking_number: shipment.trackingPin,
          label_url: shipment.labelUrl,
          order_status: "shipped",
        })
        .eq("id", id);

      if (updateError) {
        return NextResponse.json(
          { error: "Shipment created but failed to save tracking: " + updateError.message },
          { status: 500 }
        );
      }

      // Best-effort shipped-confirmation email (never blocks the response).
      sendShippedEmail(id, shipment.trackingPin).catch(() => undefined);

      return NextResponse.json({
        success: true,
        trackingNumber: shipment.trackingPin,
        labelUrl: shipment.labelUrl,
      });
    } catch (err) {
      if (err instanceof CanadaPostError) {
        console.error("Canada Post shipment error:", err.message);
        return NextResponse.json(
          { error: "Canada Post error: " + err.message },
          { status: 502 }
        );
      }
      throw err;
    }
  } catch (error: unknown) {
    console.error("Shipment creation error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
