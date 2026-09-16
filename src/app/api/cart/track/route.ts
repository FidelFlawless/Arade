import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Parse JSON or form-urlencoded body (sendBeacon sends form-urlencoded)
async function parseBody(req: NextRequest) {
  const contentType = (req.headers.get("content-type") || "").toLowerCase();

  if (contentType.includes("application/json")) {
    return req.json();
  }

  if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    return {
      userId: form.get("userId") as string | null,
      email: form.get("email") as string | null,
      items: (form.get("items") as string || "[]"),
      cartTotal: form.get("cartTotal") as string | null,
      currency: form.get("currency") as string | null,
    };
  }

  // Fallback: try JSON anyway
  try {
    return req.json();
  } catch {
    return null;
  }
}

// POST - Save/update cart state for a logged-in user
export async function POST(req: NextRequest) {
  try {
    const body = await parseBody(req);

    if (!body) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const userId: string | null = body.userId;
    const email: string | null = body.email;
    let items: unknown = body.items;
    const cartTotal: number | null = body.cartTotal != null ? Number(body.cartTotal) : null;
    const currency: string | null = body.currency || "CAD";

    // If items came as a JSON string (from form-urlencoded), parse it
    if (typeof items === "string") {
      try {
        items = JSON.parse(items);
      } catch {
        items = [];
      }
    }

    if (!userId || !items) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Only track if cart has items
    if (!Array.isArray(items) || items.length === 0) {
      await supabaseAdmin
        .from("abandoned_carts")
        .delete()
        .eq("user_id", userId);
      return NextResponse.json({ status: "cleared" });
    }

    const payload = {
      user_id: userId,
      email: email || null,
      items: items.map((item: { id: string; name: string; slug: string; price_cad: number; price_usd: number; image: string | null; quantity: number }) => ({
        id: item.id,
        name: item.name,
        slug: item.slug,
        price_cad: item.price_cad,
        price_usd: item.price_usd,
        image: item.image,
        quantity: item.quantity,
      })),
      cart_total: cartTotal != null ? cartTotal : 0,
      currency: currency || "CAD",
      last_active: new Date().toISOString(),
      email_sent: false,
      email_sent_at: null,
    };

    const { error } = await supabaseAdmin
      .from("abandoned_carts")
      .upsert(payload, { onConflict: "user_id" });

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
