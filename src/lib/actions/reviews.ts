"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { requireAdminUser } from "@/lib/auth/admin";
import { decideReviewOwner } from "@/lib/reviews/security";
import { isMissingColumnError } from "@/lib/reviews/verification";

/**
 * Submit a customer review for a paid order.
 *
 * The reviewer identity comes from the authenticated server-side session - the
 * `userId` argument (supplied by the calling page) is only checked for
 * impersonation and never decides whose review this is.
 */

export async function submitReview(
  userId: string,
  productId: string,
  orderId: string,
  rating: number,
  comment?: string
) {
  if (!productId || !orderId) {
    return { error: "Missing required fields." };
  }
  if (rating < 1 || rating > 5) {
    return { error: "Rating must be between 1 and 5." };
  }

  // 0. The authenticated session is the source of truth for the reviewer.
  //    A `userId` coming from the client is only checked for impersonation and
  //    is never used to decide whose review this is.
  const sessionClient = await createServerClient();
  const {
    data: { user },
    error: authError,
  } = await sessionClient.auth.getUser();

  if (authError || !user) {
    return { error: "You must be signed in to submit a review." };
  }

  const owner = decideReviewOwner(user.id, userId);
  if (!owner.allowed) {
    return { error: owner.error };
  }
  const reviewerId = owner.userId;

  // Privileged (service-role) client - server side only, created after the
  // request has been authenticated.
  const supabaseAdmin = createAdminClient();

  // 1. Verify the user purchased this product in a paid order
  const { data: order, error: orderError } = await supabaseAdmin
    .from("orders")
    .select("id, payment_status")
    .eq("id", orderId)
    .eq("user_id", reviewerId)
    .single();

  if (orderError || !order) {
    return { error: "Order not found." };
  }
  if (order.payment_status !== "paid") {
    return { error: "You can only review products from paid orders." };
  }

  // 2. Verify the product is in the order_items
  const { data: orderItem } = await supabaseAdmin
    .from("order_items")
    .select("id")
    .eq("order_id", orderId)
    .eq("product_id", productId)
    .single();

  if (!orderItem) {
    return { error: "This product was not part of this order." };
  }

  // 3. Check if user already reviewed this product for this order
  const { data: existingReview } = await supabaseAdmin
    .from("reviews")
    .select("id")
    .eq("user_id", reviewerId)
    .eq("product_id", productId)
    .eq("order_id", orderId)
    .maybeSingle();

  if (existingReview) {
    return { error: "You have already reviewed this product for this order." };
  }

  // 4. Insert the review.
  //    `order_id` and `is_verified` need the optional columns added by
  //    supabase-fix-reviews-columns.sql. If that migration has not been applied
  //    yet, retry with the base columns so the customer's review still saves.
  const baseReview = {
    user_id: reviewerId,
    product_id: productId,
    rating,
    comment: comment?.trim() || null,
    is_approved: false,
  };

  let { error: insertError } = await supabaseAdmin.from("reviews").insert({
    ...baseReview,
    order_id: orderId,
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
    console.error("Review insert error:", insertError);
    return { error: "Failed to submit review. Please try again." };
  }

  return { success: "Review submitted! It will appear after moderation." };
}

async function updateProductReviewStats(productId: string) {
  try {
    const supabaseAdmin = createAdminClient();
    const { data: approved } = await supabaseAdmin
      .from("reviews")
      .select("rating")
      .eq("product_id", productId)
      .eq("is_approved", true);

    const count = approved?.length || 0;
    const avg = count > 0 ? Math.round((approved!.reduce((sum, r) => sum + r.rating, 0) / count) * 10) / 10 : 0;

    await supabaseAdmin
      .from("products")
      .update({ review_count: count, average_rating: avg })
      .eq("id", productId);
  } catch (err) {
    console.error("Failed to update product review stats:", err);
  }
}

export async function approveReview(reviewId: string) {
  // Admin authorization is enforced server-side before the privileged write.
  const auth = await requireAdminUser();
  if (!auth.allowed) return { error: "Admin access required." };

  const supabaseAdmin = createAdminClient();

  const { data: review, error } = await supabaseAdmin
    .from("reviews")
    .update({ is_approved: true })
    .eq("id", reviewId)
    .select("product_id")
    .single();

  if (error || !review) return { error: "Failed to approve review." };

  await updateProductReviewStats(review.product_id);
  return { success: true };
}

export async function deleteReview(reviewId: string) {
  // Admin authorization is enforced server-side before the privileged write.
  const auth = await requireAdminUser();
  if (!auth.allowed) return { error: "Admin access required." };

  const supabaseAdmin = createAdminClient();

  const { data: review } = await supabaseAdmin
    .from("reviews")
    .select("product_id")
    .eq("id", reviewId)
    .single();

  const { error } = await supabaseAdmin
    .from("reviews")
    .delete()
    .eq("id", reviewId);

  if (error) return { error: "Failed to delete review." };

  if (review?.product_id) {
    await updateProductReviewStats(review.product_id);
  }

  return { success: true };
}
