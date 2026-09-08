"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Search, Eye, ChevronDown, Loader2 } from "lucide-react";

interface Order {
  id: string;
  order_number: string;
  total: number;
  currency: string;
  order_status: string;
  payment_status: string;
  created_at: string;
  profiles: { full_name: string; email: string } | null;
  order_items: { id: string }[];
}

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800", processing: "bg-blue-100 text-blue-800",
  shipped: "bg-purple-100 text-purple-800", delivered: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};
const paymentColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800", paid: "bg-green-100 text-green-800",
  failed: "bg-red-100 text-red-800", refunded: "bg-gray-100 text-gray-800",
};

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadOrders(); }, []);

  async function loadOrders() {
    setLoading(true);
    const res = await fetch("/api/admin/orders");
    if (res.ok) setOrders(await res.json());
    setLoading(false);
  }

  async function updateStatus(orderId: string, newStatus: string) {
    await fetch("/api/admin/orders", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: orderId, order_status: newStatus }),
    });
    setOrders((prev) => prev.map((o) => o.id === orderId ? { ...o, order_status: newStatus } : o));
  }

  const filteredOrders = orders.filter((order) => {
    const q = search.toLowerCase();
    const matchesSearch = order.order_number?.toLowerCase().includes(q) ||
      order.profiles?.full_name?.toLowerCase().includes(q) || order.profiles?.email?.toLowerCase().includes(q);
    const matchesStatus = statusFilter === "all" || order.order_status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Orders</h1>
        <p className="text-foreground/60">{orders.length} orders total</p>
      </div>

      <div className="card mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/40" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by order number, customer name, or email..."
              className="w-full pl-10 pr-4 py-2.5 border border-border rounded-lg text-sm bg-white outline-none" />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2.5 border border-border rounded-lg text-sm bg-white outline-none">
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="processing">Processing</option>
            <option value="shipped">Shipped</option>
            <option value="delivered">Delivered</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left text-sm font-medium text-foreground/60 p-4">Order</th>
                  <th className="text-left text-sm font-medium text-foreground/60 p-4">Customer</th>
                  <th className="text-left text-sm font-medium text-foreground/60 p-4">Date</th>
                  <th className="text-left text-sm font-medium text-foreground/60 p-4">Items</th>
                  <th className="text-left text-sm font-medium text-foreground/60 p-4">Total</th>
                  <th className="text-left text-sm font-medium text-foreground/60 p-4">Payment</th>
                  <th className="text-left text-sm font-medium text-foreground/60 p-4">Status</th>
                  <th className="text-right text-sm font-medium text-foreground/60 p-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((order) => (
                  <tr key={order.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                    <td className="p-4">
                      <Link href={`/admin/orders/${order.id}`} className="font-medium text-primary hover:text-primary-dark">
                        {order.order_number || order.id.slice(0, 8)}
                      </Link>
                    </td>
                    <td className="p-4">
                      <p className="text-sm font-medium">{order.profiles?.full_name || "—"}</p>
                      <p className="text-xs text-foreground/50">{order.profiles?.email || ""}</p>
                    </td>
                    <td className="p-4 text-sm text-foreground/70">
                      {new Date(order.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </td>
                    <td className="p-4 text-sm text-foreground/70">{order.order_items?.length || 0}</td>
                    <td className="p-4 text-sm font-medium">
                      {order.currency === "CAD" ? "C$" : "US$"}{order.total.toFixed(2)}
                    </td>
                    <td className="p-4">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${paymentColors[order.payment_status] || "bg-gray-100"}`}>
                        {order.payment_status?.charAt(0).toUpperCase() + order.payment_status?.slice(1)}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="relative">
                        <select value={order.order_status} onChange={(e) => updateStatus(order.id, e.target.value)}
                          className={`appearance-none text-xs font-medium px-2 py-1 pr-6 rounded-full border-0 outline-none cursor-pointer ${statusColors[order.order_status] || "bg-gray-100"}`}>
                          <option value="pending">Pending</option>
                          <option value="processing">Processing</option>
                          <option value="shipped">Shipped</option>
                          <option value="delivered">Delivered</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                        <ChevronDown className="absolute right-1 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none" />
                      </div>
                    </td>
                    <td className="p-4">
                      <Link href={`/admin/orders/${order.id}`} className="p-1.5 text-foreground/50 hover:text-primary hover:bg-primary/10 rounded-lg inline-flex">
                        <Eye className="w-4 h-4" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!loading && filteredOrders.length === 0 && (
          <div className="text-center py-12"><p className="text-foreground/60">No orders found</p></div>
        )}
      </div>
    </div>
  );
}
