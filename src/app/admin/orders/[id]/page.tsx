"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, ChevronDown, Package, Printer } from "lucide-react";
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
  shipping_address: {
    first_name?: string;
    last_name?: string;
    address_line1?: string;
    address_line2?: string;
    city?: string;
    province_state?: string;
    postal_code?: string;
    phone?: string;
  } | null;
  country: string;
  created_at: string;
  shipping_email: string | null;
  profiles: { full_name: string; email: string } | null;
  order_items: {
    id: string;
    product_id: string;
    product_name: string;
    quantity: number;
    unit_price: number;
    subtotal: number;
    products?: {
      slug?: string;
      images?: string[] | null;
    } | null;
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
      .select("*, profiles(full_name, email), order_items(*, products(slug, images))")
      .eq("id", id)
      .single();

    const safeData = data
      ? {
          ...data,
          subtotal: Number(data.subtotal ?? 0),
          delivery_fee: Number(data.delivery_fee ?? 0),
          discount: Number(data.discount ?? 0),
          total: Number(data.total ?? 0),
          order_items: ((data.order_items ?? []) as Record<string, unknown>[]).map((item) => ({
            ...item,
            quantity: Number(item.quantity ?? 0),
            unit_price: Number(item.unit_price ?? 0),
            subtotal: Number(item.subtotal ?? (Number(item.unit_price ?? 0) * Number(item.quantity ?? 0))),
          })),
        }
      : null;

    setOrder(safeData as OrderDetail | null);
    setLoading(false);
  }

  async function updateStatus(newStatus: string) {
    setUpdating(true);
    await fetch("/api/admin/orders", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, order_status: newStatus }),
    });
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
          {order.payment_status === "paid" && (
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-dark"
            >
              <Printer className="h-4 w-4" />
              Print Invoice
            </button>
          )}
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
                const safeTotal = Number(item.subtotal ?? (Number(item.unit_price ?? 0) * Number(item.quantity ?? 0)));
                const safeQty = Number(item.quantity ?? 0);
                const productImage = item.products?.images?.[0];
                const currencyPrefix = order.currency === "CAD" ? "C$" : "US$";
                return (
                  <div key={item.id} className="flex items-center justify-between py-3 border-b border-border last:border-0">
                    <div className="flex items-center gap-3">
                      {productImage ? (
                        <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-muted shrink-0 border border-border">
                          <img
                            src={productImage}
                            alt={item.product_name || "Product"}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center shrink-0 border border-border">
                          <Package className="w-6 h-6 text-foreground/30" />
                        </div>
                      )}
                      <div>
                        {item.products?.slug ? (
                          <Link
                            href={`/product/${item.products.slug}`}
                            target="_blank"
                            className="font-medium text-foreground hover:text-primary transition-colors line-clamp-1"
                          >
                            {item.product_name || "Product"}
                          </Link>
                        ) : (
                          <p className="font-medium text-foreground">{item.product_name || "Product"}</p>
                        )}
                        <p className="text-xs text-foreground/50">
                          Qty: {safeQty} × {currencyPrefix}{Number(item.unit_price ?? 0).toFixed(2)}
                        </p>
                      </div>
                    </div>
                    <p className="text-sm font-semibold text-foreground">
                      {currencyPrefix}{safeTotal.toFixed(2)}
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

      {order.payment_status === "paid" && (
        <section className="invoice-print" aria-label="Printable invoice">
          <div className="flex items-start justify-between border-b-2 border-black pb-6">
            <div>
              <h1 className="text-3xl font-bold">Arade</h1>
              <p className="mt-1 text-sm">Beauty, skincare, hair and fashion</p>
            </div>
            <div className="text-right">
              <h2 className="text-2xl font-bold">INVOICE</h2>
              <p className="mt-1 text-sm">{order.order_number || order.id.slice(0, 8)}</p>
              <p className="text-sm">{new Date(order.created_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p>
            </div>
          </div>

          <div className="mt-8 grid grid-cols-2 gap-8 text-sm">
            <div>
              <h3 className="mb-2 font-bold uppercase tracking-wide">Bill to</h3>
              <p>{order.profiles?.full_name || `${shipping.first_name || "Guest"} ${shipping.last_name || ""}`}</p>
              <p>{order.profiles?.email || order.shipping_email || "-"}</p>
            </div>
            <div>
              <h3 className="mb-2 font-bold uppercase tracking-wide">Ship to</h3>
              <p>{shipping.first_name} {shipping.last_name}</p>
              <p>{shipping.address_line1}</p>
              {shipping.address_line2 && <p>{shipping.address_line2}</p>}
              <p>{shipping.city}, {shipping.province_state} {shipping.postal_code}</p>
              <p>{order.country === "CA" ? "Canada" : "United States"}</p>
            </div>
          </div>

          <table className="mt-10 w-full border-collapse text-sm">
            <thead>
              <tr className="border-b-2 border-black text-left">
                <th className="py-3">Product</th>
                <th className="py-3 text-right">Qty</th>
                <th className="py-3 text-right">Price</th>
                <th className="py-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {order.order_items.map((item) => (
                <tr key={item.id} className="border-b border-gray-300">
                  <td className="py-3">{item.product_name}</td>
                  <td className="py-3 text-right">{item.quantity}</td>
                  <td className="py-3 text-right">{order.currency === "CAD" ? "C$" : "US$"}{Number(item.unit_price).toFixed(2)}</td>
                  <td className="py-3 text-right">{order.currency === "CAD" ? "C$" : "US$"}{Number(item.subtotal).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-8 ml-auto w-64 space-y-2 text-sm">
            <div className="flex justify-between"><span>Subtotal</span><span>{order.currency === "CAD" ? "C$" : "US$"}{Number(order.subtotal).toFixed(2)}</span></div>
            {Number(order.discount) > 0 && <div className="flex justify-between"><span>Discount</span><span>-{order.currency === "CAD" ? "C$" : "US$"}{Number(order.discount).toFixed(2)}</span></div>}
            <div className="flex justify-between"><span>Delivery</span><span>{Number(order.delivery_fee) === 0 ? "Free" : `${order.currency === "CAD" ? "C$" : "US$"}${Number(order.delivery_fee).toFixed(2)}`}</span></div>
            <div className="flex justify-between border-t-2 border-black pt-3 text-base font-bold"><span>Total paid</span><span>{order.currency === "CAD" ? "C$" : "US$"}{Number(order.total).toFixed(2)}</span></div>
          </div>

          <p className="mt-12 border-t border-gray-300 pt-4 text-center text-xs">Payment status: Paid. Thank you for shopping with Arade.</p>
        </section>
      )}
    </div>
  );
}
