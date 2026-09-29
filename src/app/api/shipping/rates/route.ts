import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getCanadaPostRates, CanadaPostError } from "@/lib/canadapost";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Default packed weight per item in grams if a product has no weight set.
const DEFAULT_ITEM_WEIGHT_GRAMS = 250;

/**
 * POST /api/shipping/rates
 * Body: { country: "CA"|"US", postalCode: string, items: [{ productId, quantity }] }
 *
 * Returns live Canada Post rates. On any Canada Post failure this returns a
 * controlled server error — there is NO flat-rate fallback.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { country, postalCode, items } = body;

    if ((country !== "CA" && country !== "US") || !postalCode) {
      return NextResponse.json(
        { error: "A valid country and postal code are required" },
        { status: 400 }
      );
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Cart is empty" }, { status: 400 });
    }

    const productIds = items.map((i: { productId: string }) => i.productId);
    const { data: dbProducts, error } = await supabaseAdmin
      .from("products")
      .select("id, weight_grams")
      .in("id", productIds)
      .eq("is_active", true);

    if (error || !dbProducts) {
      return NextResponse.json({ error: "Failed to verify products" }, { status: 500 });
    }

    // Total packed weight in kg (items are shipped in one parcel).
    const totalWeightKg =
      items.reduce((sum: number, item: { productId: string; quantity: number }) => {
        const p = dbProducts.find((row) => row.id === item.productId);
        const grams = (p?.weight_grams ?? DEFAULT_ITEM_WEIGHT_GRAMS) * item.quantity;
        return sum + grams;
      }, 0) / 1000;

    try {
      const rates = await getCanadaPostRates({
        destinationCountry: country,
        destinationPostalCode: postalCode,
        weightKg: totalWeightKg,
      });
      return NextResponse.json({ success: true, rates });
    } catch (err) {
      if (err instanceof CanadaPostError) {
        console.error("Canada Post rates error:", err.message);
        return NextResponse.json(
          { error: "Shipping is temporarily unavailable. Please try again in a moment." },
          { status: 502 }
        );
      }
      throw err;
    }
  } catch (error: unknown) {
    console.error("Shipping rates error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
