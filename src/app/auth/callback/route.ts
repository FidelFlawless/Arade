import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendWelcomeEmail } from "@/lib/emails";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? (type === "recovery" ? "/auth/reset-password" : type === "signup" ? "/account" : "/");

  const response = NextResponse.redirect(`${origin}${next}`);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      await sendWelcomeAfterVerification(response, supabase);
      return response;
    }
  }

  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    });
    if (!error) {
      await sendWelcomeAfterVerification(response, supabase);
      return response;
    }
  }

  // If error, redirect to login
  return NextResponse.redirect(`${origin}/auth/login?error=auth_callback_failed`);
}

/**
 * After a successful email verification (signup flow), send the welcome email
 * with the first-order discount code — at most once per user. This replaces
 * the old behaviour of firing it at signup time, where it raced Supabase's
 * own verification email and could be triggered for unverified addresses.
 * Best-effort: an email failure must never break the auth redirect.
 */
async function sendWelcomeAfterVerification(
  response: NextResponse,
  supabase: ReturnType<typeof createServerClient>
): Promise<void> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.email) return;

    // Send-once guard (migration 20260105_welcome_email_flag.sql).
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("welcome_email_sent_at, full_name")
      .eq("id", user.id)
      .single();

    if (!profile || profile.welcome_email_sent_at) return; // already sent / no profile

    const sent = await sendWelcomeEmail(user.email, profile.full_name || "");

    if (sent) {
      await supabaseAdmin
        .from("profiles")
        .update({ welcome_email_sent_at: new Date().toISOString() })
        .eq("id", user.id);
    }
  } catch (err) {
    console.error("Welcome email after verification failed:", err);
  }
}
