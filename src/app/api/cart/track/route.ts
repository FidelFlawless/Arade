import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST - Save/update cart state for a logged-in user
export async function POST(req: NextRequest) {
  try {
    const { userId, email, items, cartTotal, currency } = await req.json();

    if (!userId || !email || !items) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Only track if cart has items
    if (!Array.isArray(items) || items.length === 0) {
      // Clear any existing abandoned cart record for this user
      await supabaseAdmin
        .from("abandoned_carts")
        .delete()
        .eq("user_id", userId);
      return NextResponse.json({ status: "cleared" });
    }

    // Upsert: update if exists for this user, insert if not
    const { error } = await supabaseAdmin
      .from("abandoned_carts")
      .upsert(
        {
          user_id: userId,
          email,
          items: items.map((item: { id: string; name: string; slug: string; price_cad: number; price_usd: number; image: string | null; quantity: number }) => ({
            id: item.id,
            name: item.name,
            slug: item.slug,
            price_cad: item.price_cad,
            price_usd: item.price_usd,
            image: item.image,
            quantity: item.quantity,
          })),
          cart_total: cartTotal || 0,
          currency: currency || "CAD",
          last_active: new Date().toISOString(),
          email_sent: false,
          email_sent_at: null,
        },
        { onConflict: "user_id" }
      );

    if (error) {
      console.error("Abandoned cart upsert error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ status: "tracked" });
  } catch (err) {
    console.error("Cart track error:", err);
    return NextResponse.json({ error: "Failed to track cart" }, { status: 500 });
  }
}
