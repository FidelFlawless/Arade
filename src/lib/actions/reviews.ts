"use server";

import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function submitReview(
  userId: string,
  productId: string,
  orderId: string,
  rating: number,
  comment?: string
) {
  if (!userId || !productId || !orderId) {
    return { error: "Missing required fields." };
  }
  if (rating < 1 || rating > 5) {
    return { error: "Rating must be between 1 and 5." };
  }

  // 1. Verify the user purchased this product in a paid order
  const { data: order, error: orderError } = await supabaseAdmin
    .from("orders")
    .select("id, payment_status")
    .eq("id", orderId)
    .eq("user_id", userId)
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

  // 3. Check if user already reviewed this product
  const { data: existingReview } = await supabaseAdmin
    .from("reviews")
    .select("id")
    .eq("user_id", userId)
    .eq("product_id", productId)
    .single();

  if (existingReview) {
    return { error: "You have already reviewed this product." };
  }

  // 4. Insert the review
  const { error: insertError } = await supabaseAdmin.from("reviews").insert({
    user_id: userId,
    product_id: productId,
    order_id: orderId,
    rating,
    comment: comment?.trim() || null,
    is_verified: true,
    is_approved: false,
  });

  if (insertError) {
    return { error: "Failed to submit review. Please try again." };
  }

  return { success: "Review submitted! It will appear after moderation." };
}

export async function approveReview(reviewId: string) {
  const { error } = await supabaseAdmin
    .from("reviews")
    .update({ is_approved: true })
    .eq("id", reviewId);
  if (error) return { error: "Failed to approve review." };
  return { success: true };
}

export async function deleteReview(reviewId: string) {
  const { error } = await supabaseAdmin
    .from("reviews")
    .delete()
    .eq("id", reviewId);
  if (error) return { error: "Failed to delete review." };
  return { success: true };
}
