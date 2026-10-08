import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminUser } from "@/lib/auth/admin";

/**
 * Allowed pickup-status transitions (admin workflow):
 *   preparing -> picking | ready | cancelled
 *   picking   -> preparing | ready | cancelled
 *   ready     -> picking | picked_up | cancelled
 *   picked_up -> (terminal)
 *   cancelled -> (terminal)
 */
const PICKUP_TRANSITIONS: Record<string, string[]> = {
  preparing: ["picking", "ready", "cancelled"],
  picking: ["preparing", "ready", "cancelled"],
  ready: ["picking", "picked_up", "cancelled"],
  picked_up: [],
  cancelled: [],
};

/** Fields only meaningful for shipping (Canada Post) orders. */
const SHIPPING_ONLY_FIELDS = [
  "tracking_number",
  "label_url",
  "shipping_method_code",
  "shipping_method_name",
] as const;

// GET - List all orders (admin only)
export async function GET() {
  // Authorization runs first: the service-role client is only created once the
  // request has been verified as an authenticated admin.
  const auth = await requireAdminUser();
  if (!auth.allowed) return auth.response;

  const supabaseAdmin = createAdminClient();
  const { data, error } = await supabaseAdmin
    .from("orders")
    .select("*, profiles(full_name, email), order_items(id)")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// PUT - Update order status and/or pickup status (admin only)
export async function PUT(req: NextRequest) {
  const auth = await requireAdminUser();
  if (!auth.allowed) return auth.response;

  const supabaseAdmin = createAdminClient();
  const body = await req.json();
  const { id, order_status, pickup_status } = body;
  if (!id) return NextResponse.json({ error: "Order ID required" }, { status: 400 });

  // Shipping-only fields can never be written through this route. Pickup
  // orders in particular must never gain tracking/label data - fulfillment is
  // manual, in-store, with no Canada Post involvement.
  const attemptedShippingFields = SHIPPING_ONLY_FIELDS.filter((f) => f in body && body[f] != null);
  if (attemptedShippingFields.length > 0) {
    return NextResponse.json(
      { error: `Shipping fields (${attemptedShippingFields.join(", ")}) are managed by the Canada Post shipment flow and cannot be set here.` },
      { status: 400 }
    );
  }

  const update: Record<string, unknown> = {};

  if (order_status !== undefined) {
    update.order_status = order_status;
  }

  if (pickup_status !== undefined) {
    // pickup_status is NOT NULL in the database — null is never a valid
    // update (shipping rows simply have no pickup workflow).
    if (pickup_status === null || typeof pickup_status !== "string") {
      return NextResponse.json({ error: "Invalid pickup status" }, { status: 400 });
    }

    const { data: current, error: fetchError } = await supabaseAdmin
      .from("orders")
      .select("fulfillment_method, pickup_status")
      .eq("id", id)
      .single();

    if (fetchError || !current) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (current.fulfillment_method !== "store_pickup") {
      return NextResponse.json(
        { error: "This order is a shipping order - it has no pickup status." },
        { status: 400 }
      );
    }

    const allowed = PICKUP_TRANSITIONS[current.pickup_status ?? "preparing"] ?? [];
    if (!allowed.includes(pickup_status)) {
      return NextResponse.json(
        {
          error: `Invalid pickup status transition: ${current.pickup_status ?? "preparing"} -> ${pickup_status}. Allowed: ${allowed.length ? allowed.join(", ") : "none (terminal)"}.`,
        },
        { status: 400 }
      );
    }

    update.pickup_status = pickup_status;
    // Keep order_status coherent for the customer-facing order list: a picked
    // up order is delivered; a cancelled pickup is cancelled.
    if (pickup_status === "picked_up" && update.order_status === undefined) {
      update.order_status = "delivered";
    }
    if (pickup_status === "cancelled" && update.order_status === undefined) {
      update.order_status = "cancelled";
    }
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("orders")
    .update(update)
    .eq("id", id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
