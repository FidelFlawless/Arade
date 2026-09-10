"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { createClient } from "@/lib/supabase/client";
import ReviewForm from "@/components/reviews/ReviewForm";
import { CheckCircle, Package, Truck, ArrowRight, Loader2 } from "lucide-react";

interface OrderItem {
  id: string;
  product_id: string;
  product_name: string;
  product_image: string | null;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

interface Order {
  id: string;
  order_number: string;
  status?: string;
  order_status?: string;
  payment_status: string;
  currency: string;
  subtotal: number;
  delivery_fee: number;
  total: number;
  created_at: string;
  shipping_first_name: string;
  shipping_last_name: string;
  shipping_address_line1: string;
  shipping_address_line2: string | null;
  shipping_city: string;
  shipping_province_state?: string;
  shipping_state_province?: string;
  shipping_postal_code: string;
  shipping_country: string;
  order_items: OrderItem[];
}

export default function OrderDetailPage() {
  const params = useParams();
  const orderNumber = params.id as string;
  const { user, loading: authLoading } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [reviewedProducts, setReviewedProducts] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    const load = async () => {
      const { data } = await supabase
        .from("orders")
        .select("*, order_items(*)")
        .eq("order_number", orderNumber)
        .eq("user_id", user.id)
        .single();
      setOrder(data);

      if (data) {
        const productIds = data.order_items.map((i: OrderItem) => i.product_id);
        if (productIds.length > 0) {
          const { data: reviews } = await supabase
            .from("reviews")
            .select("product_id")
            .eq("user_id", user.id)
            .in("product_id", productIds);
          if (reviews) setReviewedProducts(new Set(reviews.map((r) => r.product_id)));
        }
      }
      setLoading(false);
    };
    load();
  }, [user, orderNumber]);

  if (authLoading || loading) {
    return <div className="min-h-[60vh] flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }
  if (!user) {
    return <div className="min-h-[60vh] flex items-center justify-center"><div className="text-center"><h2 className="text-xl font-bold mb-2">Please sign in</h2><Link href="/auth/login" className="btn-primary inline-block">Sign In</Link></div></div>;
  }
  if (!order) {
    return <div className="min-h-[60vh] flex items-center justify-center"><div className="text-center"><h2 className="text-xl font-bold mb-2">Order not found</h2><Link href="/account/orders" className="btn-primary inline-block">View Orders</Link></div></div>;
  }

  const canReview = order.payment_status === "paid";
  const fmt = (value: number | null | undefined) => {
    const amount = Number(value ?? 0);
    return (order.currency === "CAD" ? "C$" : "US$") + amount.toFixed(2);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
      <div className="text-center mb-8">
        <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-foreground mb-2">Order {order.order_number}</h1>
        <p className="text-foreground/60">Placed on {new Date(order.created_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center"><CheckCircle className="w-5 h-5 text-green-600" /></div>
            <div><p className="font-medium">Payment</p><p className="text-sm text-green-600 capitalize">{order.payment_status}</p></div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center"><Package className="w-5 h-5 text-blue-600" /></div>
            <div><p className="font-medium">Status</p><p className="text-sm text-blue-600 capitalize">{order.order_status || order.status}</p></div>
          </div>
        </div>
      </div>

      <div className="card mb-6">
        <div className="flex items-center gap-3 mb-4"><Truck className="w-5 h-5 text-primary" /><h2 className="font-semibold">Shipping Address</h2></div>
        <p className="text-foreground/70">{order.shipping_first_name} {order.shipping_last_name}</p>
        <p className="text-foreground/70">{order.shipping_address_line1}{order.shipping_address_line2 && <>, {order.shipping_address_line2}</>}</p>
        <p className="text-foreground/70">{order.shipping_city}, {order.shipping_state_province || order.shipping_province_state} {order.shipping_postal_code}</p>
        <p className="text-foreground/70">{order.shipping_country === "CA" ? "Canada" : "United States"}</p>
      </div>

      <div className="card mb-6">
        <h2 className="font-semibold mb-4">Order Items</h2>
        <div className="space-y-4">
          {order.order_items.map((item) => (
            <div key={item.id} className="border-b border-border pb-4 last:border-0 last:pb-0">
              <div className="flex gap-3 items-start">
                {item.product_image && <img src={item.product_image} alt={item.product_name} className="w-14 h-14 object-cover rounded-lg" />}
                <div className="flex-1">
                  <p className="font-medium">{item.product_name}</p>
                  <p className="text-sm text-foreground/50">Qty: {item.quantity} x {fmt(item.unit_price)}</p>
                </div>
                <p className="font-medium">{fmt(item.subtotal ?? item.unit_price * item.quantity)}</p>
              </div>
              {canReview && !reviewedProducts.has(item.product_id) && (
                <ReviewForm
                  userId={user.id}
                  productId={item.product_id}
                  productName={item.product_name}
                  orderId={order.id}
                  onSubmitted={() => setReviewedProducts((prev) => new Set(prev).add(item.product_id))}
                />
              )}
              {reviewedProducts.has(item.product_id) && (
                <p className="text-xs text-green-600 mt-2 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Reviewed</p>
              )}
            </div>
          ))}
        </div>

        <div className="border-t border-border mt-4 pt-4 space-y-2">
          <div className="flex justify-between text-sm"><span className="text-foreground/60">Subtotal</span><span>{fmt(order.subtotal)}</span></div>
          <div className="flex justify-between text-sm"><span className="text-foreground/60">Delivery</span><span className={order.delivery_fee === 0 ? "text-green-600 font-medium" : ""}>{order.delivery_fee === 0 ? "FREE" : fmt(order.delivery_fee)}</span></div>
          <div className="flex justify-between font-semibold text-lg pt-2 border-t border-border"><span>Total</span><span className="text-primary">{fmt(order.total)}</span></div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <Link href="/account/orders" className="btn-outline flex items-center justify-center gap-2">View All Orders <ArrowRight className="w-4 h-4" /></Link>
        <Link href="/shop" className="btn-primary flex items-center justify-center gap-2">Continue Shopping <ArrowRight className="w-4 h-4" /></Link>
      </div>
    </div>
  );
}
