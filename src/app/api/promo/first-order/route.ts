import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/promo/first-order
 *
 * Public, minimal promo info for the welcome modal: whether an active
 * first-order coupon exists and its headline values. Exposes nothing
 * sensitive (no ids, no usage counts, no internal fields).
 */
export async function GET() {
  try {
    const { data: coupon } = await supabaseAdmin
      .from("coupons")
      .select("discount_type, discount_value_cad, active, first_order_only, max_uses, used_count")
      .eq("first_order_only", true)
      .eq("active", true)
      .limit(1)
      .maybeSingle();

    if (
      !coupon ||
      (coupon.max_uses !== null && (coupon.used_count || 0) >= coupon.max_uses)
    ) {
      return NextResponse.json({ active: false });
    }

    return NextResponse.json({
      active: true,
      discount_type: coupon.discount_type,
      discount_value_cad: Number(coupon.discount_value_cad),
    });
  } catch {
    return NextResponse.json({ active: false });
  }
}
