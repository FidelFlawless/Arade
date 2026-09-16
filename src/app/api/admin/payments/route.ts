import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminUser } from "@/lib/auth/admin";

// GET - List all payments (admin only)
export async function GET() {
  // Authorization runs first: the service-role client is only created once the
  // request has been verified as an authenticated admin.
  const auth = await requireAdminUser();
  if (!auth.allowed) return auth.response;

  const supabaseAdmin = createAdminClient();
  const { data, error } = await supabaseAdmin
    .from("payments")
    .select("*, orders(order_number, profiles(full_name))")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
