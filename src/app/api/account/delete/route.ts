import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function DELETE() {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: orders, error: ordersQueryError } = await admin
    .from("orders")
    .select("id")
    .eq("user_id", user.id);

  if (ordersQueryError) {
    console.error("Account deletion order lookup failed:", ordersQueryError.message);
    return NextResponse.json({ error: "Unable to prepare account deletion" }, { status: 500 });
  }

  const orderIds = (orders || []).map((order) => order.id);

  // Remove dependent test data before deleting the Auth user.
  const cleanupSteps = [
    admin.from("reviews").delete().eq("user_id", user.id),
    admin.from("addresses").delete().eq("user_id", user.id),
    admin.from("cart_items").delete().eq("user_id", user.id),
  ];

  if (orderIds.length > 0) {
    cleanupSteps.push(
      admin.from("payments").delete().in("order_id", orderIds),
      admin.from("order_items").delete().in("order_id", orderIds),
      admin.from("orders").delete().in("id", orderIds).eq("user_id", user.id)
    );
  }

  cleanupSteps.push(admin.from("profiles").delete().eq("id", user.id));

  for (const cleanupStep of cleanupSteps) {
    const { error } = await cleanupStep;
    if (error) {
      console.error("Account deletion cleanup failed:", error.message);
      return NextResponse.json({ error: "Unable to remove account data" }, { status: 500 });
    }
  }

  const { error } = await admin.auth.admin.deleteUser(user.id);

  if (error) {
    console.error("Account deletion failed:", error.message);
    return NextResponse.json({ error: "Unable to delete account" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
