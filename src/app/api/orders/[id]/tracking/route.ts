import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getTrackingSummary, CanadaPostError } from "@/lib/canadapost";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/orders/[id]/tracking?email=...        (guest: order#+email pair)
 * GET /api/orders/[id]/tracking                  (logged-in owner; Bearer token)
 *
 * [id] is the order number (ARD-...). Returns the live Canada Post tracking
 * summary for the order's tracking PIN, plus a friendly UI state:
 *   - "no_tracking"   order has no shipment yet
 *   - "no_data"       label created but Canada Post has no scans yet (normal)
 *   - "in_transit"    has events, not delivered
 *   - "delivered"     actualDeliveryDate present
 * Controlled errors only — there is no fake/fallback tracking data.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const orderNumber = decodeURIComponent(id).trim().toUpperCase();
    const { searchParams } = new URL(req.url);
    const guestEmail = (searchParams.get("email") || "").trim().toLowerCase();

    // ── Auth: logged-in owner OR guest with order#+email pair ──────────
    let authorized = false;
    let loggedInUserId: string | null = null;
    const authHeader = req.headers.get("authorization");
    if (authHeader) {
      const token = authHeader.replace(/^Bearer\s+/i, "");
      const supabaseAuth = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      const {
        data: { user },
      } = await supabaseAuth.auth.getUser(token);
      if (user) loggedInUserId = user.id;
    }

    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select(
        `id, order_number, user_id, shipping_email, tracking_number,
         shipping_method_name, order_status, payment_status`
      )
      .eq("order_number", orderNumber)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (!authorized) {
      // Owner path: the signed-in user must own the order.
      if (loggedInUserId && order.user_id && loggedInUserId === order.user_id) {
        authorized = true;
      }
    }

    if (!authorized) {
      const orderEmail = (order.shipping_email || "").toLowerCase();
      if (!guestEmail || !orderEmail || guestEmail !== orderEmail) {
        // Same generic response as /api/orders/track so probing reveals nothing.
        return NextResponse.json({ found: false }, { status: 404 });
      }
      authorized = true;
    }

    // ── Tracking lookup ────────────────────────────────────────────────
    const pin = (order.tracking_number || "").trim();
    if (!pin) {
      return NextResponse.json({
        found: true,
        state: "no_tracking",
        orderNumber: order.order_number,
      });
    }

    let summary: Awaited<ReturnType<typeof getTrackingSummary>> = null;
    try {
      summary = await getTrackingSummary(pin);
    } catch (err) {
      if (err instanceof CanadaPostError) {
        console.error("Canada Post tracking error:", err.message);
        return NextResponse.json(
          { error: "Tracking is temporarily unavailable. Please try again in a moment." },
          { status: 502 }
        );
      }
      throw err;
    }

    if (!summary) {
      return NextResponse.json({
        found: true,
        state: "no_data",
        orderNumber: order.order_number,
        trackingNumber: pin,
        trackingUrl: `https://www.canadapost-postescanada.ca/track-reperage/en#/details/${pin}`,
      });
    }

    const delivered = Boolean(summary.actualDeliveryDate);
    const state = delivered ? "delivered" : "in_transit";

    return NextResponse.json({
      found: true,
      state,
      orderNumber: order.order_number,
      trackingNumber: pin,
      trackingUrl: `https://www.canadapost-postescanada.ca/track-reperage/en#/details/${pin}`,
      serviceName: summary.serviceName,
      mailedOnDate: summary.mailedOnDate,
      expectedDeliveryDate: summary.expectedDeliveryDate,
      actualDeliveryDate: summary.actualDeliveryDate,
      attemptedDate: summary.attemptedDate,
      event: {
        dateTime: summary.eventDateTime,
        description: summary.eventDescription,
        type: summary.eventType,
        location: summary.eventLocation,
      },
    });
  } catch (error: unknown) {
    console.error("Tracking route error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
