import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminUser } from "@/lib/auth/admin";

// GET - Fetch all settings (admin only)
export async function GET() {
  // Authorization runs first: the service-role client is only created once the
  // request has been verified as an authenticated admin.
  const auth = await requireAdminUser();
  if (!auth.allowed) return auth.response;

  const supabaseAdmin = createAdminClient();
  const { data, error } = await supabaseAdmin
    .from("store_settings")
    .select("*");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Convert array to object: { key: value }
  const settings: Record<string, string> = {};
  data?.forEach((item) => {
    settings[item.key] = item.value;
  });
  return NextResponse.json(settings);
}

// PUT - Update settings (admin only)
export async function PUT(req: NextRequest) {
  const auth = await requireAdminUser();
  if (!auth.allowed) return auth.response;

  const supabaseAdmin = createAdminClient();
  const body = await req.json();

  // Upsert each setting
  const updates = Object.entries(body).map(([key, value]) => ({
    key,
    value: String(value),
  }));

  const { error } = await supabaseAdmin
    .from("store_settings")
    .upsert(updates, { onConflict: "key" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
