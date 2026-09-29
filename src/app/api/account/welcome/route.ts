import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendWelcomeEmail } from "@/lib/emails";

/**
 * Re-send the welcome/coupon email for a user who verified their email but
 * never received it (e.g. they confirmed before the post-verification welcome
 * flow existed, or the send failed silently).
 *
 * Safety: the caller must be signed in (Supabase session cookie), and the
 * send-once guard profiles.welcome_email_sent_at applies. An unauthenticated
 * caller can never trigger a send to an arbitrary inbox, and an authenticated
 * one can only email themselves — at most once.
 */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Option B: the coupon email only ever goes to a VERIFIED address.
  if (!user.email_confirmed_at && !user.confirmed_at) {
    return NextResponse.json(
      { error: "Please verify your email address first" },
      { status: 403 }
    );
  }

  const admin = createAdminClient();
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("welcome_email_sent_at, full_name")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  if (profile.welcome_email_sent_at) {
    return NextResponse.json(
      { error: "Welcome email already sent" },
      { status: 409 }
    );
  }

  const sent = await sendWelcomeEmail(user.email, profile.full_name || "");
  if (!sent) {
    return NextResponse.json(
      { error: "Could not send the welcome email right now" },
      { status: 502 }
    );
  }

  const { error: updateError } = await admin
    .from("profiles")
    .update({ welcome_email_sent_at: new Date().toISOString() })
    .eq("id", user.id);

  if (updateError) {
    console.error(
      "Welcome resend: could not set welcome_email_sent_at:",
      updateError.message
    );
  }

  return NextResponse.json({ success: true });
}
