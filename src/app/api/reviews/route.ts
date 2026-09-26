import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { decideReviewOwner, validateReviewInput } from "@/lib/reviews/security";
import { findVerifiedPurchase, isMissingColumnError } from "@/lib/reviews/verification";

/**
 * Submit a review for a product.
 *
 * Guest reviews are allowed for anyone. Authenticated users can still be
 * marked as verified purchases when they bought the product; unauthenticated
 * users are accepted with a display name, but their review is not verified.
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const body = await req.json().catch(() => null);

    const owner = decideReviewOwner(
      user?.id,
      body && typeof body === "object" ? (body as Record<string, unknown>).user_id : undefined
    );
    if (!owner.allowed && user) {
      return NextResponse.json({ error: owner.error }, { status: owner.status });
    }

    const input = validateReviewInput(body);
    if (!input.valid) {
      return NextResponse.json({ error: input.error }, { status: 400 });
    }

    const { productId, rating, comment } = input;
    const reviewerName =
      typeof (body as Record<string, unknown> | null)?.reviewer_name === "string"
        ? String((body as Record<string, unknown>).reviewer_name).trim()
        : user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Guest";

    if (!user && !reviewerName) {
      return NextResponse.json({ error: "Please enter your name to leave a review." }, { status: 400 });
    }

    const supabaseAdmin = createAdminClient();
    const userId = owner.allowed ? owner.userId : null;

    if (userId) {
      const { data: existingReview } = await supabaseAdmin
        .from("reviews")
        .select("id")
        .eq("user_id", userId)
        .eq("product_id", productId)
        .maybeSingle();

      if (existingReview) {
        return NextResponse.json({ error: "You have already reviewed this product." }, { status: 409 });
      }
    }

    let purchase = null;
    if (userId) {
      purchase = await findVerifiedPurchase(supabaseAdmin, userId, productId);
      if (!purchase) {
        return NextResponse.json(
          { error: "You can only review products you have purchased." },
          { status: 403 }
        );
      }
    }

    const baseReview = {
      user_id: userId,
      product_id: productId,
      rating,
      comment,
      reviewer_name: reviewerName,
      reviewer_email: user?.email ?? ((body as Record<string, unknown> | null)?.reviewer_email as string | null) ?? null,
      is_approved: false,
      is_verified: Boolean(purchase),
    };

    let { error: insertError } = await supabaseAdmin.from("reviews").insert({
      ...baseReview,
      order_id: purchase?.orderId ?? null,
    });

    if (insertError && isMissingColumnError(insertError)) {
      console.warn(
        "reviews table is missing optional guest-review fields or order_id - retrying without them:",
        insertError.message
      );
      const fallbackReview = {
        user_id: userId,
        product_id: productId,
        rating,
        comment,
        is_approved: false,
      };
      ({ error: insertError } = await supabaseAdmin.from("reviews").insert(fallbackReview));
    }

    if (insertError) {
      if (insertError.code === "23505") {
        return NextResponse.json({ error: "You have already reviewed this product." }, { status: 409 });
      }
      console.error("Review insert error:", insertError);
      return NextResponse.json({ error: "Failed to submit review. Please try again." }, { status: 500 });
    }

    return NextResponse.json({
      success: "Review submitted! It will appear after moderation.",
      is_verified: Boolean(purchase),
    });
  } catch (error) {
    console.error("Review API error:", error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
