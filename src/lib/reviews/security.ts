/**
 * Pure review-submission security decisions.
 *
 * No Next.js / Supabase imports so the rules can be unit tested directly and
 * reused by every server-side entry point (API route and server action).
 *
 * The authenticated server-side session is always the source of truth: a
 * client-supplied `user_id` is only inspected to detect impersonation and is
 * never used to select the review owner.
 */

export const REVIEW_IMPERSONATION_ERROR =
  "You cannot submit a review on behalf of another user.";

/** Upper bound on stored review comments (guards against oversized payloads). */
export const MAX_REVIEW_COMMENT_LENGTH = 5000;

export type ReviewOwnerDecision =
  | { allowed: true; userId: string }
  | { allowed: false; status: 401 | 403; error: string };

export function decideReviewOwner(
  sessionUserId: string | null | undefined,
  requestedUserId?: unknown
): ReviewOwnerDecision {
  if (!sessionUserId) {
    return {
      allowed: false,
      status: 401,
      error: "You must be signed in to submit a review.",
    };
  }

  // A non-matching client value is rejected; absent values are simply ignored.
  if (
    typeof requestedUserId === "string" &&
    requestedUserId.trim() !== "" &&
    requestedUserId !== sessionUserId
  ) {
    return { allowed: false, status: 403, error: REVIEW_IMPERSONATION_ERROR };
  }

  return { allowed: true, userId: sessionUserId };
}

export type ReviewInputValidation =
  | { valid: true; productId: string; rating: number; comment: string | null }
  | { valid: false; error: string };

export function validateReviewInput(body: unknown): ReviewInputValidation {
  if (!body || typeof body !== "object") {
    return { valid: false, error: "Invalid request data." };
  }

  const { product_id, rating, comment } = body as Record<string, unknown>;

  if (typeof product_id !== "string" || product_id.trim() === "") {
    return { valid: false, error: "A product is required." };
  }

  const numericRating = typeof rating === "number" ? rating : Number(rating);
  if (!Number.isInteger(numericRating) || numericRating < 1 || numericRating > 5) {
    return { valid: false, error: "Rating must be between 1 and 5." };
  }

  if (comment !== undefined && comment !== null && typeof comment !== "string") {
    return { valid: false, error: "Invalid review comment." };
  }

  const trimmedComment = typeof comment === "string" ? comment.trim() : "";
  if (trimmedComment.length > MAX_REVIEW_COMMENT_LENGTH) {
    return {
      valid: false,
      error: `Review comment must be ${MAX_REVIEW_COMMENT_LENGTH} characters or fewer.`,
    };
  }

  return {
    valid: true,
    productId: product_id.trim(),
    rating: numericRating,
    comment: trimmedComment || null,
  };
}
