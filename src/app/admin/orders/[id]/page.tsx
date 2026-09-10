"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, ChevronDown, Package } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface OrderDetail {
  id: string;
  order_number: string;
  subtotal: number;
  delivery_fee: number;
  discount: number;
  total: number;
  currency: string;
  order_status: string;
  payment_status: string;
  shipping_address: any;
  country: string;
  created_at: string;
  profiles: { full_name: string; email: string } | null;
  order_items: {
    id: string;
    product_name: string;
    quantity: number;
    unit_price: number;
    total_price: number;
    currency: string;
  }[];
}

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  processing: "bg-blue-100 text-blue-800",
  shipped: "bg-purple-100 text-purple-800",
  delivered: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

export default function AdminOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    loadOrder();
  }, [id]);

  async function loadOrder() {
    const { data } = await supabase
      .from("orders")
      .select("*, profiles(full_name, email), order_items(*)")
      .eq("id", id)
      .single();

    const safeData = data
      ? {
          ...data,
          subtotal: Number(data.subtotal ?? 0),
          delivery_fee: Number(data.delivery_fee ?? 0),
          discount: Number(data.discount ?? 0),
          total: Number(data.total ?? 0),
          order_items: (data.order_items ?? []).map((item: any) => ({
            ...item,
            quantity: Number(item.quantity ?? 0),
            unit_price: Number(item.unit_price ?? 0),
            total_price: Number(item.total_price ?? 0),
          })),
        }
      : null;

    setOrder(safeData as OrderDetail | null);
    setLoading(false);
  }

  async function updateStatus(newStatus: string) {
    setUpdating(true);
    await supabase.from("orders").update({ order_status: newStatus }).eq("id", id);
    setOrder((prev) => (prev ? { ...prev, order_status: newStatus } : prev));
    setUpdating(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="text-center py-16">
        <p className="text-foreground/60">Order not found</p>
        <Link href="/admin/orders" className="text-primary hover:underline mt-2 inline-block">
          ← Back to Orders
        </Link>
      </div>
    );
  }

  const shipping = order.shipping_address || {};

  return (
    <div>
      <div className="flex items-center gap-4 mb-8">
        <Link href="/admin/orders" className="p-2 hover:bg-muted rounded-lg transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground">
            Order {order.order_number || order.id.slice(0, 8)}
          </h1>
          <p className="text-foreground/60">
            Placed on {new Date(order.created_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${statusColors[order.order_status] || "bg-gray-100"}`}>
            {order.order_status?.charAt(0).toUpperCase() + order.order_status?.slice(1)}
          </span>
          <div className="relative">
            <select
              value={order.order_status}
              onChange={(e) => updateStatus(e.target.value)}
              disabled={updating}
              className="appearance-none bg-white border border-border rounded-lg px-4 py-2 pr-8 text-sm outline-none cursor-pointer disabled:opacity-50"
            >
              <option value="pending">Pending</option>
              <option value="processing">Processing</option>
              <option value="shipped">Shipped</option>
              <option value="delivered">Delivered</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none text-foreground/40" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Order Items */}
        <div className="lg:col-span-2 space-y-6">
          <div className="card">
            <h2 className="text-lg font-semibold text-foreground mb-4">Order Items</h2>
            <div className="space-y-3">
              {(order.order_items ?? []).map((item) => {
                const safeTotal = Number(item.total_price ?? 0);
                const safeQty = Number(item.quantity ?? 0);
                return (
                  <div key={item.id} className="flex items-center justify-between py-3 border-b border-border last:border-0">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
                        <Package className="w-5 h-5 text-foreground/30" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{item.product_name || "Product"}</p>
                        <p className="text-xs text-foreground/50">Qty: {safeQty}</p>
                      </div>
                    </div>
                    <p className="text-sm font-medium">
                      {(item.currency === "CAD" ? "C$" : "US$")}{safeTotal.toFixed(2)}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Order Summary & Customer */}
        <div className="space-y-6">
          {/* Summary */}
          <div className="card">
            <h2 className="text-lg font-semibold text-foreground mb-4">Order Summary</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-foreground/60">Subtotal</span>
                <span>{order.currency === "CAD" ? "C$" : "US$"}{Number(order.subtotal ?? 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-foreground/60">Delivery</span>
                <span>{Number(order.delivery_fee ?? 0) === 0 ? "Free" : `${order.currency === "CAD" ? "C$" : "US$"}${Number(order.delivery_fee ?? 0).toFixed(2)}`}</span>
              </div>
              {Number(order.discount ?? 0) > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Discount</span>
                  <span>-{order.currency === "CAD" ? "C$" : "US$"}{Number(order.discount ?? 0).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between font-semibold text-base pt-2 border-t border-border">
                <span>Total</span>
                <span>{order.currency === "CAD" ? "C$" : "US$"}{Number(order.total ?? 0).toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Customer */}
          <div className="card">
            <h2 className="text-lg font-semibold text-foreground mb-4">Customer</h2>
            <div className="space-y-2 text-sm">
              <p><span className="text-foreground/60">Name:</span> {order.profiles?.full_name || "—"}</p>
              <p><span className="text-foreground/60">Email:</span> {order.profiles?.email || "—"}</p>
              <p><span className="text-foreground/60">Country:</span> {order.country === "CA" ? "Canada" : "USA"}</p>
            </div>
          </div>

          {/* Shipping Address */}
          <div className="card">
            <h2 className="text-lg font-semibold text-foreground mb-4">Shipping Address</h2>
            <div className="space-y-1 text-sm text-foreground/70">
              {shipping.first_name && <p>{shipping.first_name} {shipping.last_name}</p>}
              {shipping.address_line1 && <p>{shipping.address_line1}</p>}
              {shipping.address_line2 && <p>{shipping.address_line2}</p>}
              {shipping.city && <p>{shipping.city}, {shipping.province_state} {shipping.postal_code}</p>}
              {shipping.phone && <p>Phone: {shipping.phone}</p>}
              {!shipping.first_name && <p className="text-foreground/40">No address provided</p>}
            </div>
          </div>

          {/* Payment */}
          <div className="card">
            <h2 className="text-lg font-semibold text-foreground mb-4">Payment</h2>
            <div className="space-y-2 text-sm">
              <p><span className="text-foreground/60">Status:</span>{" "}
                <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                  order.payment_status === "paid" ? "bg-green-100 text-green-800" :
                  order.payment_status === "pending" ? "bg-yellow-100 text-yellow-800" :
                  "bg-red-100 text-red-800"
                }`}>
                  {order.payment_status?.charAt(0).toUpperCase() + order.payment_status?.slice(1)}
                </span>
              </p>
              <p><span className="text-foreground/60">Currency:</span> {order.currency}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
