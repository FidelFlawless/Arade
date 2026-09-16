import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminUser } from "@/lib/auth/admin";

/** Map a duplicate-SKU database rejection to a clear 409 for the admin form. */
function handleProductError(error: { code?: string | null; message?: string | null }) {
  if (error?.code === "23505") {
    return NextResponse.json({ error: "This SKU is already used by another product." }, { status: 409 });
  }
  return NextResponse.json({ error: error?.message || "Database error" }, { status: 500 });
}

// GET - List all products (admin only)
export async function GET() {
  // Authorization runs first: the service-role client is only created once the
  // request has been verified as an authenticated admin.
  const auth = await requireAdminUser();
  if (!auth.allowed) return auth.response;

  const supabaseAdmin = createAdminClient();
  const { data, error } = await supabaseAdmin
    .from("products")
    .select("*, categories(name, slug)")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST - Create product (admin only)
export async function POST(req: NextRequest) {
  const auth = await requireAdminUser();
  if (!auth.allowed) return auth.response;

  const supabaseAdmin = createAdminClient();
  const body = await req.json();
  const { data, error } = await supabaseAdmin
    .from("products")
    .insert(body)
    .select()
    .single();

  if (error) return handleProductError(error);
  return NextResponse.json(data);
}

// PUT - Update product (admin only)
export async function PUT(req: NextRequest) {
  const auth = await requireAdminUser();
  if (!auth.allowed) return auth.response;

  const supabaseAdmin = createAdminClient();
  const body = await req.json();
  const { id, ...updates } = body;
  if (!id) return NextResponse.json({ error: "Product ID required" }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("products")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) return handleProductError(error);
  return NextResponse.json(data);
}

// DELETE - Delete product (admin only)
export async function DELETE(req: NextRequest) {
  const auth = await requireAdminUser();
  if (!auth.allowed) return auth.response;

  const supabaseAdmin = createAdminClient();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Product ID required" }, { status: 400 });

  const { error } = await supabaseAdmin.from("products").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
