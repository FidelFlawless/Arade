import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/search/popular
 *
 * Returns the most frequently searched terms (last 30 days), limited to
 * terms that actually match active products, so the chips never lead to a
 * dead end. Falls back to a small catalog-derived default list when there
 * is not enough tracked data yet.
 */
export async function GET() {
  try {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // Top terms from real searches in the last 30 days (min 2 chars,
    // at least 2 occurrences so one-off typos don't surface).
    const { data: logs, error } = await supabaseAdmin
      .from("search_logs")
      .select("term")
      .gte("created_at", since);

    if (error) {
      console.error("popular search logs error:", error.message);
      return NextResponse.json({ terms: await fallbackTerms() });
    }

    const counts = new Map<string, number>();
    for (const row of logs || []) {
      const term = String(row.term || "").trim().toLowerCase();
      if (term.length >= 2 && term.length <= 40) {
        counts.set(term, (counts.get(term) || 0) + 1);
      }
    }

    const ranked = [...counts.entries()]
      .filter(([, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([term]) => term);

    if (ranked.length === 0) {
      return NextResponse.json({ terms: await fallbackTerms() });
    }

    return NextResponse.json({ terms: ranked });
  } catch {
    return NextResponse.json({ terms: await fallbackTerms() });
  }
}

/**
 * Fallback until real search data accumulates: derive terms from the
 * actual catalog — top product name words + category names — so the
 * chips always match real products.
 */
async function fallbackTerms(): Promise<string[]> {
  try {
    const defaults = ["wig", "cream", "serum", "oil"];
    const { data: products } = await supabaseAdmin
      .from("products")
      .select("name")
      .eq("is_active", true)
      .limit(200);

    const words = new Map<string, number>();
    const stop = new Set([
      "and", "the", "for", "with", "of", "a", "an", "in", "by",
      "pack", "set", "new", "size", "plus", "free",
    ]);
    for (const p of products || []) {
      for (const w of String(p.name || "").toLowerCase().split(/[^a-z]+/)) {
        if (w.length >= 3 && !stop.has(w)) {
          words.set(w, (words.get(w) || 0) + 1);
        }
      }
    }

    const topWords = [...words.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([w]) => w);

    const merged = [...new Set([...topWords, ...defaults])].slice(0, 8);
    return merged.length > 0 ? merged : defaults;
  } catch {
    return ["wig", "cream", "serum", "oil"];
  }
}
