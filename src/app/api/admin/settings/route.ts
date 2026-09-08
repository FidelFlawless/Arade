import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET - Fetch all settings
export async function GET() {
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

// PUT - Update settings
export async function PUT(req: NextRequest) {
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
