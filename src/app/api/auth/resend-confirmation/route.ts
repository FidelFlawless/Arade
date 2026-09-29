import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * POST /api/auth/resend-confirmation
 *
 * Re-sends the signup confirmation email to users who never received or
 * clicked the original link (Supabase delivers it via the configured SMTP,
 * i.e. Brevo). The redirect goes to our own /auth/callback so the
 * post-verification welcome email fires after they confirm.
 *
 * The response is identical whether or not the account exists, so this
 * endpoint cannot be used to discover which emails have accounts.
 * Supabase additionally rate-limits resend requests on its side.
 */

/** Simple in-memory throttle (best-effort; Supabase's own limiter is the backstop). */
const attempts = new Map<string, number[]>();
const MAX_PER_HOUR = 3;

function throttled(email: string): boolean {
  const now = Date.now();
  const windowStart = now - 60 * 60 * 1000;
  const hits = (attempts.get(email) || []).filter((t) => t > windowStart);
  if (hits.length >= MAX_PER_HOUR) {
    return true;
  }
  hits.push(now);
  attempts.set(email, hits);
  if (attempts.size > 500) {
    // Keep the map from growing forever on long-lived dev servers.
    for (const [key, times] of attempts) {
      if (times.every((t) => t <= windowStart)) attempts.delete(key);
    }
  }
  return false;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as { email?: string };
    const email = (body.email || "").trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
    }

    if (throttled(email)) {
      return NextResponse.json(
        { error: "Too many requests. Please try again in an hour." },
        { status: 429 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // The caller's own origin is used so this works on localhost and in
    // production alike (both must be whitelisted in Supabase Redirect URLs).
    const redirectTo = `${req.nextUrl.origin}/auth/callback?next=/account`;

    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: redirectTo },
    });

    // "email not confirmed" style errors for already-verified or unknown
    // addresses are swallowed — the response stays generic either way.
    if (error) {
      console.log("Resend confirmation not sent:", error.message);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Resend confirmation error:", err);
    return NextResponse.json({ error: "Could not send the email. Please try again." }, { status: 500 });
  }
}
