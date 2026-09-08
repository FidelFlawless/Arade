import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET - Public endpoint for store settings (used by checkout)
export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("store_settings")
    .select("*");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const settings: Record<string, string> = {};
  data?.forEach((item) => {
    settings[item.key] = item.value;
  });
  return NextResponse.json(settings);
}
