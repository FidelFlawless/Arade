import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuthenticatedUser } from "@/lib/auth/admin";
import { decideReviewOwner, validateReviewInput } from "@/lib/reviews/security";
import { findVerifiedPurchase, isMissingColumnError } from "@/lib/reviews/verification";

/**
 * Submit a review for a product.
 *
 * Security model:
 * - The reviewer identity always comes from the authenticated server-side
 *   session (`supabase.auth.getUser()`), never from the request body.
 * - A review can only be created when the authenticated user actually bought
 *   the product in a paid order, so `is_verified` can never be forged.
 * - Duplicate reviews (same user + product) stay protected.
 */
export async function POST(req: NextRequest) {
  try {
    // 401 before anything else - no session, no review.
    const auth = await requireAuthenticatedUser();
    if (!auth.allowed) return auth.response;

    const body = await req.json().catch(() => null);

    // The client-supplied user_id is only used to detect impersonation.
    const owner = decideReviewOwner(
      auth.userId,
      body && typeof body === "object" ? (body as Record<string, unknown>).user_id : undefined
    );
    if (!owner.allowed) {
      return NextResponse.json({ error: owner.error }, { status: owner.status });
    }
    const userId = owner.userId;

    const input = validateReviewInput(body);
    if (!input.valid) {
      return NextResponse.json({ error: input.error }, { status: 400 });
    }
    const { productId, rating, comment } = input;

    const supabaseAdmin = createAdminClient();

    // Duplicate protection (preserved from the previous implementation).
    const { data: existingReview } = await supabaseAdmin
      .from("reviews")
      .select("id")
      .eq("user_id", userId)
      .eq("product_id", productId)
      .maybeSingle();

    if (existingReview) {
      return NextResponse.json({ error: "You have already reviewed this product." }, { status: 409 });
    }

    // Verified-purchase check: only paid orders that belong to the
    // authenticated user and contain this product count.
    const purchase = await findVerifiedPurchase(supabaseAdmin, userId, productId);
    if (!purchase) {
      return NextResponse.json(
        { error: "You can only review products you have purchased." },
        { status: 403 }
      );
    }

    // Insert the review. `order_id` and `is_verified` need the optional columns
    // added by supabase-fix-reviews-columns.sql; if that migration has not been
    // applied yet, retry with the base columns so the review still saves.
    const baseReview = {
      user_id: userId,
      product_id: productId,
      rating,
      comment,
      is_approved: false,
    };

    let { error: insertError } = await supabaseAdmin.from("reviews").insert({
      ...baseReview,
      order_id: purchase.orderId,
      is_verified: true,
    });

    if (insertError && isMissingColumnError(insertError)) {
      console.warn(
        "reviews table is missing order_id/is_verified - run supabase-fix-reviews-columns.sql:",
        insertError.message
      );
      ({ error: insertError } = await supabaseAdmin.from("reviews").insert(baseReview));
    }

    if (insertError) {
      // Unique-constraint race: another request created the review first.
      if (insertError.code === "23505") {
        return NextResponse.json({ error: "You have already reviewed this product." }, { status: 409 });
      }
      console.error("Review insert error:", insertError);
      return NextResponse.json({ error: "Failed to submit review. Please try again." }, { status: 500 });
    }

    return NextResponse.json({
      success: "Review submitted! It will appear after moderation.",
      is_verified: true,
    });
  } catch (error) {
    console.error("Review API error:", error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
