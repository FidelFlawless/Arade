import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminUser } from "@/lib/auth/admin";

// GET - List all coupons (admin only)
export async function GET() {
  const auth = await requireAdminUser();
  if (!auth.allowed) return auth.response;

  const supabaseAdmin = createAdminClient();
  const { data, error } = await supabaseAdmin
    .from("coupons")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST - Create a coupon (admin only)
export async function POST(req: NextRequest) {
  const auth = await requireAdminUser();
  if (!auth.allowed) return auth.response;

  const supabaseAdmin = createAdminClient();
  const body = await req.json();

  const code = String(body.code || "").trim().toUpperCase();
  if (!code) return NextResponse.json({ error: "Coupon code is required" }, { status: 400 });

  const discountType = body.discount_type === "fixed" ? "fixed" : "percent";
  const valueCad = Number(body.discount_value_cad);
  if (!Number.isFinite(valueCad) || valueCad <= 0) {
    return NextResponse.json({ error: "Discount value (CAD) must be greater than 0" }, { status: 400 });
  }
  if (discountType === "percent" && valueCad > 100) {
    return NextResponse.json({ error: "Percent discount cannot exceed 100" }, { status: 400 });
  }

  const valueUsd = body.discount_value_usd === null || body.discount_value_usd === "" ? null : Number(body.discount_value_usd);
  if (discountType === "fixed" && (valueUsd === null || !Number.isFinite(valueUsd) || valueUsd <= 0)) {
    return NextResponse.json({ error: "Fixed discounts need a USD value too" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("coupons")
    .insert({
      code,
      description: body.description ? String(body.description) : null,
      discount_type: discountType,
      discount_value_cad: valueCad,
      discount_value_usd: valueUsd,
      min_subtotal_cad: Number(body.min_subtotal_cad) || 0,
      min_subtotal_usd: Number(body.min_subtotal_usd) || 0,
      max_uses: body.max_uses ? Number(body.max_uses) : null,
      active: body.active !== false,
      expires_at: body.expires_at ? new Date(body.expires_at).toISOString() : null,
      first_order_only: !!body.first_order_only,
      expires_days_after_signup: body.expires_days_after_signup ? Number(body.expires_days_after_signup) : null,
    })
    .select()
    .single();

  if (error) {
    const duplicate = error.code === "23505";
    return NextResponse.json(
      { error: duplicate ? "A coupon with this code already exists" : error.message },
      { status: duplicate ? 409 : 500 }
    );
  }
  return NextResponse.json(data);
}

// PUT - Update a coupon (admin only). The code text itself is editable;
// usage history follows the coupon's id, not the code string.
export async function PUT(req: NextRequest) {
  const auth = await requireAdminUser();
  if (!auth.allowed) return auth.response;

  const supabaseAdmin = createAdminClient();
  const body = await req.json();
  const { id } = body;
  if (!id) return NextResponse.json({ error: "Coupon ID required" }, { status: 400 });

  const updates: Record<string, unknown> = {};
  if (body.code !== undefined) {
    const code = String(body.code).trim().toUpperCase();
    if (!code) return NextResponse.json({ error: "Coupon code cannot be empty" }, { status: 400 });
    updates.code = code;
  }
  if (body.description !== undefined) updates.description = body.description ? String(body.description) : null;
  if (body.discount_type !== undefined) updates.discount_type = body.discount_type === "fixed" ? "fixed" : "percent";
  if (body.discount_value_cad !== undefined) updates.discount_value_cad = Number(body.discount_value_cad);
  if (body.discount_value_usd !== undefined) {
    updates.discount_value_usd = body.discount_value_usd === null || body.discount_value_usd === "" ? null : Number(body.discount_value_usd);
  }
  if (body.min_subtotal_cad !== undefined) updates.min_subtotal_cad = Number(body.min_subtotal_cad) || 0;
  if (body.min_subtotal_usd !== undefined) updates.min_subtotal_usd = Number(body.min_subtotal_usd) || 0;
  if (body.max_uses !== undefined) updates.max_uses = body.max_uses ? Number(body.max_uses) : null;
  if (body.active !== undefined) updates.active = !!body.active;
  if (body.expires_at !== undefined) updates.expires_at = body.expires_at ? new Date(body.expires_at).toISOString() : null;
  if (body.first_order_only !== undefined) updates.first_order_only = !!body.first_order_only;
  if (body.expires_days_after_signup !== undefined) {
    updates.expires_days_after_signup = body.expires_days_after_signup ? Number(body.expires_days_after_signup) : null;
  }

  const { data, error } = await supabaseAdmin
    .from("coupons")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    const duplicate = error.code === "23505";
    return NextResponse.json(
      { error: duplicate ? "A coupon with this code already exists" : error.message },
      { status: duplicate ? 409 : 500 }
    );
  }
  return NextResponse.json(data);
}

// DELETE - Remove a coupon (admin only)
export async function DELETE(req: NextRequest) {
  const auth = await requireAdminUser();
  if (!auth.allowed) return auth.response;

  const supabaseAdmin = createAdminClient();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Coupon ID required" }, { status: 400 });

  const { error } = await supabaseAdmin.from("coupons").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
