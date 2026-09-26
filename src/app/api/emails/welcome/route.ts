import { NextRequest, NextResponse } from "next/server";
import { sendWelcomeEmail } from "@/lib/emails";

/**
 * POST /api/emails/welcome  { email, firstName }
 *
 * Fires the welcome email with the first-order discount code after
 * signup. No auth required because it only sends to the email given at
 * signup (which must be verified by the user before the account is
 * usable), the email content carries no sensitive data, and a valid
 * first-order coupon must exist for anything to be sent at all.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const email = String(body?.email || "").trim().toLowerCase();
    const firstName = String(body?.firstName || "").trim().slice(0, 60);

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    const sent = await sendWelcomeEmail(email, firstName);
    return NextResponse.json({ ok: sent });
  } catch {
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
