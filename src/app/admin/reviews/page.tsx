"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { approveReview, deleteReview } from "@/lib/actions/reviews";
import { Star, CheckCircle, Trash2, Loader2, Shield } from "lucide-react";

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  is_verified: boolean;
  is_approved: boolean;
  created_at: string;
  product_id: string;
  products: { name: string } | null;
  profiles: { full_name: string; email: string } | null;
}

export default function AdminReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [filter, setFilter] = useState<"all" | "pending" | "approved">("pending");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const supabase = createClient();

  const loadReviews = async () => {
    setLoading(true);
    let query = supabase.from("reviews").select("*, products(name), profiles(full_name, email)").order("created_at", { ascending: false });
    if (filter === "pending") query = query.eq("is_approved", false);
    if (filter === "approved") query = query.eq("is_approved", true);
    const { data } = await query;
    setReviews(data || []);
    setLoading(false);
  };

  useEffect(() => { loadReviews(); }, [filter]);

  const handleApprove = async (id: string) => {
    setActionLoading(id);
    await approveReview(id);
    await loadReviews();
    setActionLoading(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this review permanently?")) return;
    setActionLoading(id);
    await deleteReview(id);
    await loadReviews();
    setActionLoading(null);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center gap-3 mb-8">
        <Shield className="w-8 h-8 text-primary" />
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-foreground">Review Moderation</h1>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-6">
        {(["pending", "approved", "all"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filter === f ? "bg-primary text-white" : "bg-muted text-foreground/60 hover:bg-muted/80"}`}>
            {f.charAt(0).toUpperCase() + f.slice(1)} {f === "pending" && <span className="ml-1 bg-white/20 px-1.5 rounded-full text-xs">{reviews.length}</span>}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" /></div>
      ) : reviews.length === 0 ? (
        <div className="text-center py-16 text-foreground/50">No {filter !== "all" ? filter : ""} reviews found.</div>
      ) : (
        <div className="space-y-4">
          {reviews.map((rev) => (
            <div key={rev.id} className={`card ${rev.is_approved ? "border-green-200 bg-green-50/30" : "border-yellow-200 bg-yellow-50/30"}`}>
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="flex">
                      {[1,2,3,4,5].map((s) => (
                        <Star key={s} className={`w-4 h-4 ${s <= rev.rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`} />
                      ))}
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${rev.is_approved ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
                      {rev.is_approved ? "Approved" : "Pending"}
                    </span>
                    {rev.is_verified && <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">Verified Purchase</span>}
                  </div>
                  <p className="text-sm text-foreground/50 mt-1">
                    by <span className="font-medium text-foreground">{rev.profiles?.full_name || "Unknown"}</span>
                    {" "}({rev.profiles?.email}) on{" "}
                    <span className="font-medium">{rev.products?.name || "Unknown product"}</span>
                  </p>
                  {rev.comment && <p className="mt-2 text-foreground/70 text-sm">{rev.comment}</p>}
                  <p className="text-xs text-foreground/40 mt-1">{new Date(rev.created_at).toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {!rev.is_approved && (
                    <button onClick={() => handleApprove(rev.id)} disabled={actionLoading === rev.id} className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50">
                      {actionLoading === rev.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />} Approve
                    </button>
                  )}
                  <button onClick={() => handleDelete(rev.id)} disabled={actionLoading === rev.id} className="flex items-center gap-1 px-3 py-1.5 bg-red-100 text-red-700 text-sm rounded-lg hover:bg-red-200 disabled:opacity-50">
                    <Trash2 className="w-3 h-3" /> Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
