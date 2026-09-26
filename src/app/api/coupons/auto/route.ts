import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { validateCoupon } from "@/lib/coupons";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/coupons/auto?currency=CAD&subtotal=123.45
 *
 * Returns the first-order welcome coupon pre-applied for the current
 * signed-in user, if they are eligible. Used by the checkout page to
 * auto-apply the discount — the customer still sees it clearly and can
 * remove it. Requires the caller's auth token; guests get nothing.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const currency = searchParams.get("currency") === "USD" ? "USD" : "CAD";
    const subtotal = Number(searchParams.get("subtotal")) || 0;

    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace(/^Bearer\s+/i, "");
    if (!token) {
      return NextResponse.json({ available: false });
    }

    const { data: userData } = await supabaseAdmin.auth.getUser(token);
    if (!userData?.user) {
      return NextResponse.json({ available: false });
    }

    // Find the active first-order coupon (first match wins).
    const { data: coupon } = await supabaseAdmin
      .from("coupons")
      .select("code")
      .eq("first_order_only", true)
      .eq("active", true)
      .limit(1)
      .maybeSingle();

    if (!coupon) {
      return NextResponse.json({ available: false });
    }

    const result = await validateCoupon(coupon.code, currency, subtotal, {
      userId: userData.user.id,
      userEmail: userData.user.email || null,
      userCreatedAt: userData.user.created_at || null,
      shipping: null,
    });

    if (!result.ok) {
      return NextResponse.json({ available: false });
    }

    return NextResponse.json({
      available: true,
      code: result.code,
      discount: result.discount,
    });
  } catch {
    return NextResponse.json({ available: false });
  }
}
