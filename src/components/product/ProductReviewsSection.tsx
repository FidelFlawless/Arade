"use client";

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import ReviewForm from "@/components/product/ReviewForm";

export interface ProductReviewRow {
  id: string;
  rating: number;
  comment: string | null;
  is_verified: boolean;
  created_at: string;
  reviewer_name?: string | null;
  profiles?: { full_name?: string | null } | null;
}

interface ProductReviewsSectionProps {
  initialReviews: ProductReviewRow[];
  productId: string;
  productName: string;
}

export default function ProductReviewsSection({
  initialReviews,
  productId,
  productName,
}: ProductReviewsSectionProps) {
  const [sort, setSort] = useState<"recent" | "oldest" | "highest" | "lowest">("recent");

  const sortedReviews = useMemo(() => {
    const reviews = [...initialReviews];

    reviews.sort((a, b) => {
      const aTime = new Date(a.created_at).getTime();
      const bTime = new Date(b.created_at).getTime();

      switch (sort) {
        case "oldest":
          return aTime - bTime;
        case "highest":
          return b.rating - a.rating || bTime - aTime;
        case "lowest":
          return a.rating - b.rating || bTime - aTime;
        case "recent":
        default:
          return bTime - aTime;
      }
    });

    return reviews;
  }, [initialReviews, sort]);

  const reviewCount = initialReviews.length;
  const avgRating =
    reviewCount > 0
      ? Number(
          (initialReviews.reduce((sum, review) => sum + review.rating, 0) / reviewCount).toFixed(1)
        )
      : 0;

  return (
    <div className="mt-16 border-t border-border pt-12">
      <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-8">Customer Reviews</h2>

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div className="flex items-center gap-4 text-base text-foreground/70">
          <button type="button" className="font-medium text-foreground border-b-2 border-foreground pb-1">
            Product reviews ({reviewCount})
          </button>
        </div>

        <div className="relative w-fit">
          <select
            aria-label="Sort reviews"
            value={sort}
            onChange={(event) => setSort(event.target.value as "recent" | "oldest" | "highest" | "lowest")}
            className="appearance-none rounded-xl border border-border bg-white px-4 py-2.5 pr-10 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="recent">Most Recent</option>
            <option value="oldest">Oldest</option>
            <option value="highest">Highest Rated</option>
            <option value="lowest">Lowest Rated</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/60" aria-hidden="true" />
        </div>
      </div>

      {reviewCount > 0 && (
        <div className="flex items-center gap-2 bg-muted px-3 py-1.5 rounded-full w-fit mb-8">
          <div className="flex">
            {[1, 2, 3, 4, 5].map((s) => (
              <svg
                key={s}
                className={`w-4 h-4 ${s <= Math.round(avgRating) ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`}
                viewBox="0 0 20 20"
              >
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            ))}
          </div>
          <span className="text-sm font-medium text-foreground">{avgRating}</span>
          <span className="text-sm text-foreground/50">({reviewCount} review{reviewCount !== 1 ? "s" : ""})</span>
        </div>
      )}

      <div className="space-y-8">
        {sortedReviews.length === 0 ? (
          <div className="text-foreground/70 text-lg py-4">Be the first to write a review</div>
        ) : (
          sortedReviews.map((rev) => (
            <div key={rev.id} className="border-b border-border pb-8 last:border-0 w-full">
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <svg
                      key={s}
                      className={`w-5 h-5 ${s <= rev.rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`}
                      viewBox="0 0 20 20"
                    >
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
                {rev.is_verified && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    Verified
                  </span>
                )}
              </div>

              <div className="mb-3 flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-foreground/5 text-sm font-semibold text-foreground/80">
                  {(rev.reviewer_name || rev.profiles?.full_name || "Customer").charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-lg font-medium text-foreground break-words">
                    {rev.reviewer_name || rev.profiles?.full_name || "Customer"}
                  </p>
                  <p className="text-sm text-foreground/50">
                    {new Date(rev.created_at).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                </div>
              </div>

              {rev.comment && (
                <p className="max-w-full text-base leading-8 text-foreground/75 break-words whitespace-pre-line">
                  {rev.comment}
                </p>
              )}
            </div>
          ))
        )}
      </div>

      <div className="mt-10">
        <ReviewForm productId={productId} productName={productName} />
      </div>
    </div>
  );
}
