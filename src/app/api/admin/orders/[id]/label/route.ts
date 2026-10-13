import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdminUser } from "@/lib/auth/admin";
import {
  getShipmentLabelPdf,
  getShipmentLabelZpl,
  convertZplToPdf,
  inspectLabelArtifact,
  inspectZplLabel,
  CanadaPostError,
} from "@/lib/canadapost";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/admin/orders/[id]/label
 * GET /api/admin/orders/[id]/label?format=zpl
 *
 * Streams the Canada Post artifact for an order's saved label URL. The artifact
 * endpoint content-negotiates, so the same URL serves two documents:
 *
 *   (no format)  the PDF artifact. On this [Test] account that is a deposit
 *                summary, not a label — the response says which one it is via
 *                the X-Arade-Artifact header and the download filename.
 *   format=zpl   the printable 4x6 label (ZPL II) for a thermal printer.
 *
 * Requires an admin session.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Admin auth via the shared cookie-session helper (same as every other
    // admin route), so the file can be opened directly in a new tab.
    const auth = await requireAdminUser();
    if (!auth.allowed) return auth.response;

    const { id } = await params;
    const format = new URL(req.url).searchParams.get("format") === "zpl" ? "zpl" : "pdf";

    // select("*") rather than an explicit column list: label_zpl_url and
    // label_pdf_kind only exist after migration 20261013, and the PDF download
    // must keep working on a database that has not run it yet.
    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("*")
      .eq("id", id)
      .single();

    // The ZPL artifact lives at the same URL as the PDF one; a legacy row that
    // predates label_zpl_url still has the URL that serves both.
    const artifactUrl =
      format === "zpl" ? order?.label_zpl_url || order?.label_url : order?.label_url;

    if (!artifactUrl) {
      return NextResponse.json(
        {
          error:
            format === "zpl"
              ? "No printable ZPL label exists for this order"
              : "No shipping label artifact exists for this order",
        },
        { status: 404 }
      );
    }

    const reference = order?.tracking_number || id;

    if (format === "zpl") {
      const zpl = await getShipmentLabelZpl(artifactUrl);

      // A manifest or deposit summary in ZPL form is not a printable label:
      // refuse it rather than hand the admin the wrong document to print.
      const zplInspection = inspectZplLabel(zpl, order?.tracking_number);
      if (zplInspection.verdict === "not-a-label") {
        return NextResponse.json({ error: zplInspection.reason }, { status: 409 });
      }
      if (zplInspection.reason) {
        console.warn(`Order ${id}: ZPL label note — ${zplInspection.reason}`);
      }

      return new NextResponse(zpl, {
        status: 200,
        headers: {
          "Content-Type": "application/zpl; charset=utf-8",
          "Content-Disposition": `attachment; filename="label-${reference}.zpl"`,
          "X-Arade-Artifact": "printable-label",
        },
      });
    }

    let pdf = await getShipmentLabelPdf(artifactUrl);

    // Never let the admin mistake the artifact for something it is not: the
    // response is labelled with what the document really is.
    let inspection = inspectLabelArtifact(pdf, order?.tracking_number);

    // If Canada Post returned a manifest (as it does in its test sandbox),
    // convert the actual ZPL shipping label into a 4x6 PDF so the user gets
    // an actual shipping label instead of a manifest hardcopy.
    if (inspection.verdict === "not-a-label") {
      try {
        const zpl = await getShipmentLabelZpl(artifactUrl);
        const zplInspection = inspectZplLabel(zpl, order?.tracking_number);
        if (zplInspection.verdict === "label") {
          pdf = await convertZplToPdf(zpl);
          inspection = { verdict: "label", testDocument: zplInspection.testDocument, reason: null };
        }
      } catch (err) {
        console.warn(`Could not convert ZPL label to PDF for order ${id}:`, err);
      }
    }

    const artifactKind =
      inspection.verdict === "label" ? "label" : order?.label_pdf_kind || "deposit_summary";

    if (inspection.verdict === "not-a-label" && order?.label_pdf_kind === "label") {
      return NextResponse.json({ error: inspection.reason }, { status: 409 });
    }
    if (artifactKind !== "label") {
      console.warn(
        `Order ${id}: serving the ${artifactKind} PDF (${inspection.verdict}${
          inspection.reason ? `: ${inspection.reason}` : ""
        })`
      );
    }

    if (inspection.verdict === "label" && order?.label_pdf_kind !== "label") {
      try {
        await supabaseAdmin.from("orders").update({ label_pdf_kind: "label" }).eq("id", id);
      } catch {
        // ignore update errors
      }
    }

    const filename =
      artifactKind === "label"
        ? `label-${reference}.pdf`
        : `deposit-summary-${reference}.pdf`;

    return new NextResponse(pdf, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
        "X-Arade-Artifact": artifactKind,
      },
    });
  } catch (error: unknown) {
    console.error("Label fetch error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    // A Canada Post failure (the endpoint answered 406/5xx) is an upstream
    // error; anything else is ours.
    return NextResponse.json(
      { error: message },
      { status: error instanceof CanadaPostError ? 502 : 500 }
    );
  }
}
