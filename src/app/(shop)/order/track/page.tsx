"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Truck, Search, Loader2, CheckCircle, Clock, XCircle } from "lucide-react";
import BackButton from "@/components/ui/BackButton";
import { formatPrice } from "@/lib/utils";
import { Suspense } from "react";

export default function TrackOrderPage() {
  return (
    <Suspense fallback={<div className="min-h-[60vh] flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>}>
      <TrackOrderContent />
    </Suspense>
  );
}

interface TrackedOrder {
  order_number: string;
  order_status: string;
  payment_status: string;
  currency: "CAD" | "USD";
  subtotal: number;
  delivery_fee: number;
  discount: number;
  total: number;
  created_at: string;
  items: { product_name: string; quantity: number; unit_price: number; subtotal: number }[];
}

const statusIcons: Record<string, typeof Clock> = {
  pending: Clock,
  processing: CheckCircle,
  shipped: Truck,
  delivered: CheckCircle,
  cancelled: XCircle,
};

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  processing: "bg-blue-100 text-blue-800",
  shipped: "bg-purple-100 text-purple-800",
  delivered: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

function TrackOrderContent() {
  const searchParams = useSearchParams();
  const [orderNumber, setOrderNumber] = useState(searchParams.get("order") || "");
  const [email, setEmail] = useState("");
  const [order, setOrder] = useState<TrackedOrder | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setNotFound(false);
    setOrder(null);
    setLoading(true);
    try {
      const res = await fetch(
        `/api/orders/track?order=${encodeURIComponent(orderNumber.trim())}&email=${encodeURIComponent(email.trim())}`
      );
      const data = await res.json();
      if (data.found) {
        setOrder({ ...data.order, currency: data.order.currency === "USD" ? "USD" : "CAD" });
      } else if (res.status === 404) {
        setNotFound(true);
      } else {
        setError(data.error || "Something went wrong. Please try again.");
      }
    } catch {
      setError("Could not check your order. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
      <BackButton href="/" label="Back to shop" />
      <div className="text-center mb-8">
        <Truck className="w-12 h-12 text-primary mx-auto mb-3" />
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-foreground">Track Your Order</h1>
        <p className="text-foreground/60 mt-2 text-sm">
          Enter the order number and the email you used at checkout.
        </p>
      </div>

      <form onSubmit={handleTrack} className="card space-y-4 mb-8">
        <div>
          <label htmlFor="track-order" className="block text-sm font-medium text-foreground mb-1">
            Order number
          </label>
          <input
            id="track-order"
            type="text"
            value={orderNumber}
            onChange={(e) => setOrderNumber(e.target.value.toUpperCase())}
            placeholder="ARD-XXXXXXX-XXXX"
            className="input"
            required
          />
        </div>
        <div>
          <label htmlFor="track-email" className="block text-sm font-medium text-foreground mb-1">
            Email used at checkout
          </label>
          <input
            id="track-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="input"
            required
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {notFound && (
          <p className="text-sm text-red-600">
            No order found for that order number and email combination. Double-check both, or{" "}
            <Link href="/contact" className="underline">contact us</Link> for help.
          </p>
        )}
        <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          {loading ? "Checking..." : "Track Order"}
        </button>
      </form>

      {order && (
        <div className="card">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <div>
              <h2 className="font-bold text-foreground">Order {order.order_number}</h2>
              <p className="text-sm text-foreground/50">
                Placed {new Date(order.created_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
              </p>
            </div>
            <div className="flex gap-2">
              <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[order.order_status] || "bg-gray-100 text-gray-800"}`}>
                {(order.order_status || "pending").charAt(0).toUpperCase() + (order.order_status || "pending").slice(1)}
              </span>
              <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${order.payment_status === "paid" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}`}>
                {order.payment_status === "paid" ? "Paid" : "Payment pending"}
              </span>
            </div>
          </div>

          <div className="border-t border-border pt-4 space-y-2 mb-4">
            {order.items.map((item, i) => (
              <div key={i} className="flex justify-between text-sm">
                <div>
                  <p className="text-foreground">{item.product_name}</p>
                  <p className="text-foreground/50">
                    {formatPrice(item.unit_price, order.currency)} × {item.quantity}
                  </p>
                </div>
                <span className="font-medium">{formatPrice(item.subtotal, order.currency)}</span>
              </div>
            ))}
          </div>

          <div className="border-t border-border pt-4 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-foreground/60">Subtotal</span>
              <span>{formatPrice(order.subtotal, order.currency)}</span>
            </div>
            {order.discount > 0 && (
              <div className="flex justify-between">
                <span className="text-foreground/60">Discount</span>
                <span className="text-green-600">-{formatPrice(order.discount, order.currency)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-foreground/60">Delivery</span>
              <span>{order.delivery_fee === 0 ? "FREE" : formatPrice(order.delivery_fee, order.currency)}</span>
            </div>
            <div className="flex justify-between font-semibold pt-2 border-t border-border mt-2">
              <span>Total</span>
              <span className="text-primary">{formatPrice(order.total, order.currency)}</span>
            </div>
          </div>

          <p className="text-xs text-foreground/50 mt-4">
            Want order history and faster checkout?{" "}
            <Link href="/auth/signup" className="text-primary underline">Create an account</Link> with this
            email and your past orders will appear automatically.
          </p>
        </div>
      )}
    </div>
  );
}
