"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle, Package, Loader2, ArrowRight } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { useCart } from "@/components/providers/CartProvider";

function OrderSuccessContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const { user } = useAuth();
  const { clearCart } = useCart();
  const [order, setOrder] = useState<{
    order_number: string;
    total: number;
    currency: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (sessionId) {
      clearCart();

      const checkOrder = async () => {
        try {
          const res = await fetch(`/api/checkout/verify?session_id=${sessionId}`);
          const data = await res.json();

          if (data.success && data.order) {
            setOrder(data.order);
            setLoading(false);
          } else if (data.pending) {
            setTimeout(checkOrder, 2000);
          } else {
            setError(data.error || "Order could not be found");
            setLoading(false);
          }
        } catch {
          setError("Failed to verify order");
          setLoading(false);
        }
      };

      const timer = setTimeout(checkOrder, 1500);
      return () => clearTimeout(timer);
    }
  }, [sessionId, clearCart]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-foreground/60">Confirming your payment...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="w-16 h-16 rounded-full bg-yellow-100 flex items-center justify-center mx-auto mb-4">
            <Package className="w-8 h-8 text-yellow-600" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Processing Your Order</h1>
          <p className="text-foreground/60 mb-6">
            Your payment was successful. We are confirming your order.
            You will receive an email shortly.
          </p>
          <Link href="/account/orders" className="btn-primary inline-flex items-center gap-2">
            View My Orders
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center max-w-md mx-auto px-4">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-8 h-8 text-green-600" />
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-2">Order Confirmed!</h1>
        <p className="text-foreground/60 mb-4">
          Thank you for your purchase. Your payment has been processed successfully.
        </p>

        {order && (
          <div className="bg-background rounded-lg border border-border p-4 mb-6">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-foreground/60">Order Number</span>
              <span className="font-semibold">{order.order_number}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-foreground/60">Total</span>
              <span className="font-semibold">
                {order.currency === "CAD" ? "C$" : "US$"}{order.total.toFixed(2)}
              </span>
            </div>
          </div>
        )}

        <p className="text-sm text-foreground/50 mb-6">
          A confirmation has been sent to your email. You can track your order status in your account.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/account/orders" className="btn-primary inline-flex items-center justify-center gap-2">
            View My Orders
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/shop"
            className="px-6 py-3 border border-border rounded-lg text-foreground hover:bg-background transition-colors inline-flex items-center justify-center"
          >
            Continue Shopping
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function OrderSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    }>
      <OrderSuccessContent />
    </Suspense>
  );
}
