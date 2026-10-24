import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getShippingSettings } from "@/lib/shipping-settings";
import {
  STANDARD_SHIPPING_CODE,
  deliveryFeeFor,
  freeDeliveryRemaining,
  shippingOptionName,
} from "@/lib/shipping";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/shipping/rates
 * Body: { country: "CA"|"US", items: [{ productId, quantity }] }
 *
 * Returns Arade's own flat delivery option. Delivery is no longer priced with
 * live Canada Post rates: orders at/above the free-delivery threshold (set in
 * Admin -> Settings) are free, everything below is charged the configured flat
 * fee in the order currency. Canada Post is still used for labels and
 * tracking, but never to decide what the customer pays for delivery.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { country, items } = body;

    if (country !== "CA" && country !== "US") {
      return NextResponse.json(
        { error: "A valid country is required" },
        { status: 400 }
      );
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Cart is empty" }, { status: 400 });
    }

    const currency = country === "CA" ? "CAD" : "USD";

    const productIds = items.map((item: { productId: string }) => item.productId);
    const { data: dbProducts, error } = await supabaseAdmin
      .from("products")
      .select("id, price_cad, price_usd")
      .in("id", productIds)
      .eq("is_active", true);

    if (error || !dbProducts) {
      return NextResponse.json({ error: "Failed to verify products" }, { status: 500 });
    }

    // Server-side subtotal, never the browser's number.
    const subtotal = items.reduce(
      (sum: number, item: { productId: string; quantity: number }) => {
        const product = dbProducts.find((row) => row.id === item.productId);
        const price = Number(
          currency === "CAD" ? product?.price_cad : product?.price_usd
        ) || 0;
        return sum + price * item.quantity;
      },
      0
    );

    const settings = await getShippingSettings();
    const deliveryFee = deliveryFeeFor(subtotal, currency, settings);

    return NextResponse.json({
      success: true,
      currency,
      subtotal: Math.round(subtotal * 100) / 100,
      deliveryFee,
      freeDeliveryRemaining: freeDeliveryRemaining(subtotal, settings),
      freeDeliveryThreshold: settings.freeDeliveryThreshold,
      rates: [
        {
          serviceCode: STANDARD_SHIPPING_CODE,
          serviceName: shippingOptionName(deliveryFee),
          price: deliveryFee,
          transitDays: null,
        },
      ],
    });
  } catch (error: unknown) {
    console.error("Shipping rates error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
