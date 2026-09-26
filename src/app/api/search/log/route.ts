import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/** Trim + normalize a raw search term. */
function cleanTerm(raw: unknown): string | null {
  const term = String(raw ?? "").trim().toLowerCase();
  if (term.length < 2 || term.length > 60) return null;
  return term;
}

/**
 * POST /api/search/log  { term: string }
 *
 * Fire-and-forget search logging. No auth, no PII — just the term.
 * Cheap insert; failures are swallowed (search must never break because
 * logging failed).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const term = cleanTerm(body?.term ?? req.nextUrl.searchParams.get("term"));
    if (!term) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from("search_logs")
      .insert({ term });

    if (error) {
      console.error("search log insert failed:", error.message);
      return NextResponse.json({ ok: false }, { status: 200 });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
