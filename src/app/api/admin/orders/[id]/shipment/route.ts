import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdminUser } from "@/lib/auth/admin";
import {
  createCanadaPostShipment,
  getShipmentLabelPdf,
  getShipmentLabelZpl,
  inspectLabelArtifact,
  inspectZplLabel,
  CanadaPostError,
  type LabelPdfKind,
} from "@/lib/canadapost";
import { sendShippedEmail } from "@/lib/emails";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const DEFAULT_ITEM_WEIGHT_GRAMS = 250;

/**
 * True when a write failed only because the label artifact columns of
 * migration 20261013 are missing (Postgres 42703, or PostgREST's schema-cache
 * error): "column orders.label_zpl_url does not exist".
 */
function isMissingLabelColumn(message: string | undefined): boolean {
  return Boolean(
    message &&
      /label_zpl_url|label_pdf_kind/.test(message) &&
      /does not exist|schema cache/i.test(message)
  );
}

/**
 * The printable-label representation of an artifact URL, or null when the
 * ZPL endpoint does not serve one. The URL is the same as the PDF one —
 * Canada Post negotiates on Accept — so nothing extra is stored beyond the
 * fact that a printable label can be downloaded for this shipment.
 */
async function printableZpl(
  url: string,
  trackingPin: string
): Promise<{ url: string; note: string | null } | null> {
  try {
    const zpl = await getShipmentLabelZpl(url);
    const inspection = inspectZplLabel(zpl, trackingPin);
    if (inspection.verdict === "label") {
      // A [Test] app's label is watermarked and carries no tracking data yet;
      // say so instead of letting the admin print a blank label unknowingly.
      if (inspection.reason) console.warn(`ZPL artifact ${url}: ${inspection.reason}`);
      return { url, note: inspection.reason };
    }
    console.warn(`ZPL artifact ${url} is not a printable label: ${inspection.reason}`);
    return null;
  } catch (error) {
    console.warn(
      `No ZPL representation for ${url}: ${error instanceof Error ? error.message : error}`
    );
    return null;
  }
}

interface ResolvedLabelArtifacts {
  /** PDF artifact URL (a label, or the deposit summary of a [Test] app). */
  labelUrl: string | null;
  /** Artifact URL to download as the printable ZPL label, when one exists. */
  labelZplUrl: string | null;
  /** What the PDF at labelUrl actually is. */
  labelPdfKind: LabelPdfKind | null;
  labelWarning: string | null;
}

/**
 * Download every artifact Canada Post published for the shipment, in order,
 * and pick the best printable representation. The shipment is already created
 * and paid for, so a failed check must never lose the tracking PIN — it only
 * withholds a URL and explains why. A manifest, a deposit summary or a Canada
 * Post test sample is never stored as the order's label; when the PDF artifact
 * is not a label, the ZPL representation of the same URL is checked instead,
 * because that is where a [Test] app's printable label comes from.
 */
async function resolveLabelArtifacts(
  candidates: string[],
  trackingPin: string,
  orderId: string
): Promise<ResolvedLabelArtifacts> {
  if (candidates.length === 0) {
    return {
      labelUrl: null,
      labelZplUrl: null,
      labelPdfKind: null,
      labelWarning:
        "Canada Post published no label artifact for this shipment. Inspect the response with scripts/probe-label-links.mjs and check the link inventory logged above.",
    };
  }

  const failures: string[] = [];
  /** First artifact that downloaded but is not a label, kept for the admin. */
  let fallback: { url: string; kind: LabelPdfKind; reason: string | null } | null = null;

  for (const url of candidates) {
    try {
      const pdf = await getShipmentLabelPdf(url);
      const inspection = inspectLabelArtifact(pdf, trackingPin);

      if (inspection.verdict === "label") {
        if (url !== candidates[0]) {
          console.warn(`Label for order ${orderId} came from a fallback artifact: ${url}`);
        }
        const zpl = await printableZpl(url, trackingPin);
        return {
          labelUrl: url,
          labelZplUrl: zpl?.url ?? null,
          labelPdfKind: "label",
          labelWarning: zpl?.note ?? null,
        };
      }

      if (!fallback || inspection.verdict === "unverified") {
        fallback = {
          url,
          kind: inspection.verdict === "unverified" ? "unverified" : "deposit_summary",
          reason: inspection.reason,
        };
      }

      if (inspection.verdict === "unverified") {
        // Nothing contradicts it being a label, so keep it and say so.
        break;
      }
    } catch (error) {
      failures.push(error instanceof Error ? error.message : "download failed");
    }
  }

  if (fallback) {
    const zpl = await printableZpl(fallback.url, trackingPin);
    return {
      labelUrl: fallback.url,
      labelZplUrl: zpl?.url ?? null,
      labelPdfKind: fallback.kind,
      labelWarning:
        fallback.kind === "deposit_summary"
          ? `${fallback.reason ?? "The PDF artifact Canada Post returned is not a shipping label."}${
              zpl ? ` The printable label is available in ZPL. ${zpl.note ?? ""}` : ""
            }`.trim()
          : zpl?.note ?? fallback.reason,
    };
  }

  return {
    labelUrl: null,
    labelZplUrl: null,
    labelPdfKind: null,
    labelWarning: `None of the ${candidates.length} artifact(s) Canada Post published is a printable label. ${
      failures[0] ?? ""
    }`.trim(),
  };
}

/**
 * POST /api/admin/orders/[id]/shipment
 * Creates the Canada Post shipment for a PAID order and stores the tracking
 * number + label link on the order. Admin only.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Admin auth via the shared cookie-session helper (same as every other
    // admin route).
    const auth = await requireAdminUser();
    if (!auth.allowed) return auth.response;

    const { id } = await params;

    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select(
        `id, order_number, payment_status, shipping_method_code,
         shipping_first_name, shipping_last_name, shipping_phone,
         shipping_address_line1, shipping_address_line2, shipping_city,
         shipping_state_province, shipping_postal_code, shipping_country,
         tracking_number`
      )
      .eq("id", id)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (order.tracking_number) {
      return NextResponse.json(
        { error: `A shipment already exists for this order (tracking ${order.tracking_number})` },
        { status: 409 }
      );
    }

    if (order.payment_status !== "paid") {
      return NextResponse.json(
        { error: "Only paid orders can be shipped" },
        { status: 400 }
      );
    }

    if (!order.shipping_method_code) {
      return NextResponse.json(
        { error: "This order has no Canada Post service code (placed before the Canada Post integration?)" },
        { status: 400 }
      );
    }

    // Packed weight from order items
    const { data: thisItems } = await supabaseAdmin
      .from("order_items")
      .select("quantity, products(weight_grams)")
      .eq("order_id", id);

    const totalWeightKg =
      (thisItems || []).reduce((sum, item) => {
        const product = item.products as { weight_grams?: number } | null;
        const grams = (product?.weight_grams ?? DEFAULT_ITEM_WEIGHT_GRAMS) * item.quantity;
        return sum + grams;
      }, 0) / 1000 || 0.25;

    const destination = {
      name: `${order.shipping_first_name} ${order.shipping_last_name}`.trim(),
      phone: order.shipping_phone || undefined,
      addressLine1: order.shipping_address_line1,
      addressLine2: order.shipping_address_line2 || undefined,
      city: order.shipping_city,
      provState: order.shipping_state_province,
      postalCode: order.shipping_postal_code,
      country: order.shipping_country as "CA" | "US",
    };

    try {
      const shipment = await createCanadaPostShipment({
        serviceCode: order.shipping_method_code,
        destination,
        weightKg: totalWeightKg,
        orderId: order.order_number,
      });

      const { labelUrl, labelZplUrl, labelPdfKind, labelWarning } =
        await resolveLabelArtifacts(
          shipment.artifactCandidates,
          shipment.trackingPin,
          id
        );

      let { error: updateError } = await supabaseAdmin
        .from("orders")
        .update({
          tracking_number: shipment.trackingPin,
          label_url: labelUrl,
          label_zpl_url: labelZplUrl,
          label_pdf_kind: labelPdfKind,
          order_status: "shipped",
        })
        .eq("id", id);

      // The label artifact columns arrive with migration 20261013. A label has
      // already been bought at this point, so a missing column must never cost
      // the order its tracking PIN: save what the old schema can hold and tell
      // the admin to run the migration.
      let migrationWarning: string | null = null;
      if (updateError && isMissingLabelColumn(updateError.message)) {
        migrationWarning =
          "The label artifact columns are missing from the database, so only the PDF URL was saved. Run migration 20261013_order_label_artifacts.sql in the Supabase SQL Editor to store the printable ZPL label too.";
        console.error(`Order ${id}: ${migrationWarning} (${updateError.message})`);
        ({ error: updateError } = await supabaseAdmin
          .from("orders")
          .update({
            tracking_number: shipment.trackingPin,
            label_url: labelUrl,
            order_status: "shipped",
          })
          .eq("id", id));
      }

      if (updateError) {
        return NextResponse.json(
          { error: "Shipment created but failed to save tracking: " + updateError.message },
          { status: 500 }
        );
      }

      // Best-effort shipped-confirmation email (never blocks the response).
      sendShippedEmail(id, shipment.trackingPin).catch(() => undefined);

      const warning = [labelWarning, migrationWarning].filter(Boolean).join(" ");

      return NextResponse.json({
        success: true,
        trackingNumber: shipment.trackingPin,
        labelUrl,
        labelZplUrl: migrationWarning ? null : labelZplUrl,
        labelPdfKind: migrationWarning ? null : labelPdfKind,
        ...(warning ? { warning } : {}),
      });
    } catch (err) {
      if (err instanceof CanadaPostError) {
        console.error("Canada Post shipment error:", err.message);
        return NextResponse.json(
          { error: "Canada Post error: " + err.message },
          { status: 502 }
        );
      }
      throw err;
    }
  } catch (error: unknown) {
    console.error("Shipment creation error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
