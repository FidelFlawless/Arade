import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminUser } from "@/lib/auth/admin";

interface ReviewRow {
  id: string;
  rating: number;
  comment: string | null;
  is_approved: boolean;
  created_at: string;
  product_id: string | null;
  user_id: string | null;
  order_id?: string | null;
  is_verified?: boolean;
  products?: { name: string } | null;
  profiles?: { full_name: string; email: string } | null;
}

interface DbError {
  code?: string | null;
  message?: string | null;
}

type AdminClient = SupabaseClient;

const REVIEW_COLUMNS = "id, rating, comment, is_approved, created_at, product_id, user_id";
const OPTIONAL_COLUMNS = "order_id, is_verified";
const RELATIONS = "products (name), profiles (full_name, email)";

/**
 * True when PostgREST/Postgres rejected the query because a column is missing
 * (PGRST204 / 42703). Keeps the admin list usable on databases that predate
 * supabase-fix-reviews-columns.sql.
 */
function isMissingColumnError(error: DbError | null) {
  if (!error) return false;
  const message = (error.message || "").toLowerCase();
  return (
    error.code === "PGRST204" ||
    error.code === "42703" ||
    message.includes("does not exist") ||
    message.includes("schema cache")
  );
}

async function queryReviews(admin: AdminClient, columns: string, withRelations: boolean) {
  const { data, error } = await admin
    .from("reviews")
    .select(withRelations ? `${columns}, ${RELATIONS}` : columns)
    .order("created_at", { ascending: false });

  return { rows: (data || []) as unknown as ReviewRow[], error: error as unknown as DbError | null };
}

/**
 * Bulk-lookup product names and reviewer profiles. Used when the embedded
 * relations above are unavailable because the FK constraints are missing.
 */
async function attachRelations(admin: AdminClient, rows: ReviewRow[]) {
  const productIds = [...new Set(rows.map((r) => r.product_id).filter((id): id is string => !!id))];
  const userIds = [...new Set(rows.map((r) => r.user_id).filter((id): id is string => !!id))];

  const productNames = new Map<string, string>();
  const profileMap = new Map<string, { full_name: string; email: string }>();

  if (productIds.length > 0) {
    const { data } = await admin.from("products").select("id, name").in("id", productIds);
    (data || []).forEach((product) => productNames.set(product.id, product.name));
  }

  if (userIds.length > 0) {
    const { data } = await admin
      .from("profiles")
      .select("id, full_name, email")
      .in("id", userIds);
    (data || []).forEach((profile) =>
      profileMap.set(profile.id, { full_name: profile.full_name, email: profile.email })
    );
  }

  return rows.map((row) => ({
    ...row,
    products: row.product_id
      ? { name: productNames.get(row.product_id) || "Unknown product" }
      : null,
    profiles: row.user_id ? profileMap.get(row.user_id) || null : null,
  }));
}

/** Recalculate a product's review_count + average_rating from approved reviews. */
async function updateProductReviewStats(admin: AdminClient, productId: string) {
  try {
    const { data: approved } = await admin
      .from("reviews")
      .select("rating")
      .eq("product_id", productId)
      .eq("is_approved", true);

    const count = approved?.length || 0;
    const avg =
      count > 0
        ? Math.round((approved!.reduce((sum, r) => sum + r.rating, 0) / count) * 10) / 10
        : 0;

    await admin
      .from("products")
      .update({ review_count: count, average_rating: avg })
      .eq("id", productId);
  } catch (err) {
    console.error("Failed to update product review stats:", err);
  }
}

// GET - List all reviews (admin only, service-role bypasses RLS)
export async function GET() {
  // Authorization runs first: the privileged client is only created once the
  // request has been verified as an authenticated admin.
  const auth = await requireAdminUser();
  if (!auth.allowed) return auth.response;

  const supabaseAdmin = createAdminClient();

  // Preferred path: one query with the optional columns plus embedded relations.
  let { rows, error } = await queryReviews(supabaseAdmin, `${REVIEW_COLUMNS}, ${OPTIONAL_COLUMNS}`, true);
  let missingOptionalColumns = false;

  // `order_id` / `is_verified` may not exist yet if the migration was skipped.
  if (error && isMissingColumnError(error)) {
    missingOptionalColumns = true;
    ({ rows, error } = await queryReviews(supabaseAdmin, REVIEW_COLUMNS, true));
  }

  // Embedded relations need FK constraints - fall back to bulk lookups.
  if (error) {
    const optional = missingOptionalColumns ? "" : `, ${OPTIONAL_COLUMNS}`;
    const fallback = await queryReviews(supabaseAdmin, `${REVIEW_COLUMNS}${optional}`, false);

    if (fallback.error) {
      return NextResponse.json({ error: fallback.error.message }, { status: 500 });
    }

    rows = await attachRelations(supabaseAdmin, fallback.rows);
  }

  if (missingOptionalColumns) {
    rows = rows.map((row) => ({ ...row, order_id: null, is_verified: false }));
  }

  return NextResponse.json(rows);
}

// PUT - Approve or reject a review (admin only)
export async function PUT(req: NextRequest) {
  const auth = await requireAdminUser();
  if (!auth.allowed) return auth.response;

  const supabaseAdmin = createAdminClient();

  const body = await req.json();
  const { id, is_approved } = body;

  if (!id) return NextResponse.json({ error: "Review ID required" }, { status: 400 });
  if (typeof is_approved !== "boolean") {
    return NextResponse.json({ error: "is_approved required" }, { status: 400 });
  }

  const { data: review, error: fetchError } = await supabaseAdmin
    .from("reviews")
    .select("product_id")
    .eq("id", id)
    .single();

  if (fetchError || !review) {
    return NextResponse.json({ error: "Review not found" }, { status: 404 });
  }

  const { data, error } = await supabaseAdmin
    .from("reviews")
    .update({ is_approved })
    .eq("id", id)
    .select("product_id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Approving a review changes the product's public rating, so refresh it.
  if (is_approved && review.product_id) {
    await updateProductReviewStats(supabaseAdmin, review.product_id);
  }

  return NextResponse.json({ success: true, review: data });
}

// DELETE - Remove a review (admin only)
export async function DELETE(req: NextRequest) {
  const auth = await requireAdminUser();
  if (!auth.allowed) return auth.response;

  const supabaseAdmin = createAdminClient();

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) return NextResponse.json({ error: "Review ID required" }, { status: 400 });

  // Remember the product before the row disappears so stats can be refreshed.
  const { data: review } = await supabaseAdmin
    .from("reviews")
    .select("product_id")
    .eq("id", id)
    .single();

  const { error } = await supabaseAdmin.from("reviews").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (review?.product_id) {
    await updateProductReviewStats(supabaseAdmin, review.product_id);
  }

  return NextResponse.json({ success: true });
}
