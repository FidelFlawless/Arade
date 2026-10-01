import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdminUser } from "@/lib/auth/admin";
import { getShipmentLabelPdf } from "@/lib/canadapost";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/admin/orders/[id]/label
 * Streams the Canada Post PDF label for an order's saved label URL.
 * Requires an admin session.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Admin auth via the shared cookie-session helper (same as every other
    // admin route), so the PDF can be opened directly in a new tab.
    const auth = await requireAdminUser();
    if (!auth.allowed) return auth.response;

    const { id } = await params;
    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("label_url, tracking_number")
      .eq("id", id)
      .single();

    if (!order?.label_url) {
      return NextResponse.json(
        { error: "No shipping label exists for this order" },
        { status: 404 }
      );
    }

    const pdf = await getShipmentLabelPdf(order.label_url);

    return new NextResponse(pdf, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="label-${order.tracking_number || id}.pdf"`,
      },
    });
  } catch (error: unknown) {
    console.error("Label fetch error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
