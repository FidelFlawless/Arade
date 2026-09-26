import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { validateCoupon } from "@/lib/coupons";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface ValidateBody {
  code?: string;
  currency?: "CAD" | "USD";
  subtotal?: number;
  shipping?: {
    first_name?: string;
    last_name?: string;
    address_line1?: string;
    postal_code?: string;
  };
}

/**
 * POST /api/coupons/validate
 * Validates a coupon code against the SERVER-side eligibility rules and
 * returns the discount amount. Accepts an optional Authorization header
 * so first-order coupons can check the caller's account history. The
 * browser-submitted subtotal is only advisory; the payment routes
 * re-validate everything server-side before charging, so a forged
 * subtotal here cannot change what the customer pays.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ValidateBody;
    const code = (body.code || "").trim().toUpperCase();
    const currency = body.currency === "USD" ? "USD" : "CAD";
    const subtotal = Number(body.subtotal) || 0;

    if (!code) {
      return NextResponse.json({ valid: false, error: "Enter a coupon code" }, { status: 400 });
    }

    // Identify the caller (optional) so first-order coupons can verify
    // account history and the signup window.
    let userId: string | null = null;
    let userEmail: string | null = null;
    let userCreatedAt: string | null = null;

    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace(/^Bearer\s+/i, "");
    if (token) {
      const { data: userData } = await supabaseAdmin.auth.getUser(token);
      if (userData?.user) {
        userId = userData.user.id;
        userEmail = userData.user.email || null;
        userCreatedAt = userData.user.created_at || null;
      }
    }

    const result = await validateCoupon(code, currency, subtotal, {
      userId,
      userEmail,
      userCreatedAt,
      shipping: body.shipping || null,
    });

    if (!result.ok) {
      return NextResponse.json({ valid: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      valid: true,
      code: result.code,
      discount: result.discount,
      currency,
    });
  } catch {
    return NextResponse.json({ valid: false, error: "Could not validate coupon" }, { status: 500 });
  }
}
