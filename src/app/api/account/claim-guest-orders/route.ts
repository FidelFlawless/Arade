import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/account/claim-guest-orders
 *
 * Links any guest orders (user_id IS NULL) whose shipping_email matches the
 * authenticated user's account email to that account. Called after signup
 * and login so customers who checked out as guests see their orders in
 * "My Orders" as soon as they create an account.
 *
 * Safety: only claims ORPHANED orders (user_id IS NULL) — never reassigns
 * an order that already belongs to another account.
 */
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Resolve the real user from the session token — never from the body.
    // Pass the JWT explicitly - global headers are not honoured by getUser().
    const supabaseAuth = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const {
      data: { user },
      error: authError,
    } = await supabaseAuth.auth.getUser(authHeader.replace(/^Bearer\s+/i, ""));

    if (authError || !user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabaseAdmin = createAdminClient();

    const { data: claimed, error: updateError } = await supabaseAdmin
      .from("orders")
      .update({ user_id: user.id })
      .eq("shipping_email", user.email.toLowerCase())
      .is("user_id", null)
      .select("id");

    if (updateError) {
      console.error("claim-guest-orders failed:", updateError.message);
      return NextResponse.json({ error: "Failed to link orders" }, { status: 500 });
    }

    return NextResponse.json({ success: true, claimed: claimed?.length || 0 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
