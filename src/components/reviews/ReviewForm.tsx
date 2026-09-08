"use client";

import { useState } from "react";
import { Star, Loader2, CheckCircle } from "lucide-react";
import { submitReview } from "@/lib/actions/reviews";

interface ReviewFormProps {
  userId: string;
  productId: string;
  productName: string;
  orderId: string;
  onSubmitted?: () => void;
}

export default function ReviewForm({ userId, productId, productName, orderId, onSubmitted }: ReviewFormProps) {
  const [rating, setRating] = useState(0);
  const [hoveredStar, setHoveredStar] = useState(0);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) {
      setResult({ type: "error", message: "Please select a star rating." });
      return;
    }
    setLoading(true);
    setResult(null);
    const res = await submitReview(userId, productId, orderId, rating, comment || "");
    if ("error" in res) {
      setResult({ type: "error", message: (res as { error: string }).error });
    } else {
      setResult({ type: "success", message: (res as { success: string }).success });
      setRating(0);
      setComment("");
      onSubmitted?.();
    }
    setLoading(false);
  };

  if (result?.type === "success") {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
        <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
        <p className="text-sm text-green-700">{result.message}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-muted/50 rounded-lg p-4 mt-3">
      <p className="text-sm font-medium text-foreground mb-3">Review {productName}</p>

      {/* Star rating */}
      <div className="flex items-center gap-1 mb-3">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => setRating(star)}
            onMouseEnter={() => setHoveredStar(star)}
            onMouseLeave={() => setHoveredStar(0)}
            className="p-0.5"
          >
            <Star
              className={`w-6 h-6 transition-colors ${
                star <= (hoveredStar || rating)
                  ? "fill-yellow-400 text-yellow-400"
                  : "text-gray-300"
              }`}
            />
          </button>
        ))}
        {rating > 0 && <span className="text-sm text-foreground/60 ml-2">{rating}/5</span>}
      </div>

      {/* Comment */}
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Share your experience with this product (optional)"
        rows={3}
        className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-white outline-none resize-none mb-3"
      />

      {/* Error */}
      {result?.type === "error" && (
        <p className="text-sm text-red-600 mb-3">{result.message}</p>
      )}

      <button
        type="submit"
        disabled={loading || rating === 0}
        className="btn-primary text-sm px-4 py-2 flex items-center gap-2"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
        Submit Review
      </button>
    </form>
  );
}
