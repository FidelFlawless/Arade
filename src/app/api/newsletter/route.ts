import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BREVO_API_KEY = process.env.BREVO_API_KEY!;
const BREVO_LIST_ID = 2;

async function addContactToBrevo(email: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const response = await fetch("https://api.brevo.com/v3/contacts", {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "api-key": BREVO_API_KEY,
      },
      body: JSON.stringify({
        email,
        listIds: [BREVO_LIST_ID],
        updateEnabled: true,
      }),
    });

    if (!response.ok && response.status !== 409) {
      const body = await response.json().catch(() => ({}));
      return { ok: false, error: body.message || `Brevo error ${response.status}` };
    }

    // 409 = contact already exists, that's fine
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err.message || "Failed to reach Brevo" };
  }
}

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required." }, { status: 400 });
    }

    const trimmed = email.trim().toLowerCase();

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) {
      return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
    }

    // Check for duplicate in Supabase
    const { data: existing } = await supabase
      .from("newsletter_subscribers")
      .select("id")
      .eq("email", trimmed)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({
        status: "duplicate",
        message: "You're already subscribed!",
      });
    }

    // Save to Supabase
    const { error: dbError } = await supabase
      .from("newsletter_subscribers")
      .insert({ email: trimmed });

    if (dbError) {
      console.error("Supabase insert error:", dbError);
      return NextResponse.json({ error: "Failed to save subscription." }, { status: 500 });
    }

    // Add to Brevo
    const brevoResult = await addContactToBrevo(trimmed);
    if (!brevoResult.ok) {
      console.error("Brevo error:", brevoResult.error);
      // Still count as success since Supabase saved — Brevo is secondary
    }

    return NextResponse.json({
      status: "success",
      message: "You're subscribed! Welcome to Arade.",
    });
  } catch (err: any) {
    console.error("Newsletter API error:", err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
