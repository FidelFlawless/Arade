"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, Eye, ChevronDown } from "lucide-react";

// Placeholder orders
const placeholderOrders = [
  {
    id: "GS-2024-001",
    customer_name: "Sarah M.",
    customer_email: "sarah@example.com",
    total: 128.97,
    currency: "CAD",
    status: "processing",
    payment_status: "paid",
    items_count: 3,
    created_at: "2024-01-20",
  },
  {
    id: "GS-2024-002",
    customer_name: "Emily R.",
    customer_email: "emily@example.com",
    total: 74.98,
    currency: "USD",
    status: "shipped",
    payment_status: "paid",
    items_count: 2,
    created_at: "2024-01-19",
  },
  {
    id: "GS-2024-003",
    customer_name: "John D.",
    customer_email: "john@example.com",
    total: 189.99,
    currency: "CAD",
    status: "pending",
    payment_status: "paid",
    items_count: 4,
    created_at: "2024-01-18",
  },
  {
    id: "GS-2024-004",
    customer_name: "Jessica L.",
    customer_email: "jessica@example.com",
    total: 62.99,
    currency: "USD",
    status: "delivered",
    payment_status: "paid",
    items_count: 1,
    created_at: "2024-01-17",
  },
  {
    id: "GS-2024-005",
    customer_name: "Michael B.",
    customer_email: "michael@example.com",
    total: 156.97,
    currency: "CAD",
    status: "processing",
    payment_status: "paid",
    items_count: 3,
    created_at: "2024-01-16",
  },
  {
    id: "GS-2024-006",
    customer_name: "Amanda K.",
    customer_email: "amanda@example.com",
    total: 48.99,
    currency: "USD",
    status: "cancelled",
    payment_status: "refunded",
    items_count: 1,
    created_at: "2024-01-15",
  },
];

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  processing: "bg-blue-100 text-blue-800",
  shipped: "bg-purple-100 text-purple-800",
  delivered: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

const paymentColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  paid: "bg-green-100 text-green-800",
  failed: "bg-red-100 text-red-800",
  refunded: "bg-gray-100 text-gray-800",
};

export default function AdminOrdersPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [orders] = useState(placeholderOrders);

  const filteredOrders = orders.filter((order) => {
    const matchesSearch =
      order.id.toLowerCase().includes(search.toLowerCase()) ||
      order.customer_name.toLowerCase().includes(search.toLowerCase()) ||
      order.customer_email.toLowerCase().includes(search.toLowerCase());
    const matchesStatus =
      statusFilter === "all" || order.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Orders</h1>
        <p className="text-foreground/60">
          Manage customer orders and update status
        </p>
      </div>

      {/* Filters */}
      <div className="card mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/40" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by order ID, customer name, or email..."
              className="input input-icon"
            />
          </div>
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="appearance-none bg-white border border-border rounded-lg px-4 py-3 pr-8 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="processing">Processing</option>
              <option value="shipped">Shipped</option>
              <option value="delivered">Delivered</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/40 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Orders table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left text-sm font-medium text-foreground/60 p-4">
                  Order ID
                </th>
                <th className="text-left text-sm font-medium text-foreground/60 p-4">
                  Customer
                </th>
                <th className="text-left text-sm font-medium text-foreground/60 p-4">
                  Date
                </th>
                <th className="text-left text-sm font-medium text-foreground/60 p-4">
                  Items
                </th>
                <th className="text-left text-sm font-medium text-foreground/60 p-4">
                  Total
                </th>
                <th className="text-left text-sm font-medium text-foreground/60 p-4">
                  Payment
                </th>
                <th className="text-left text-sm font-medium text-foreground/60 p-4">
                  Status
                </th>
                <th className="text-right text-sm font-medium text-foreground/60 p-4">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((order) => (
                <tr
                  key={order.id}
                  className="border-b border-border last:border-0 hover:bg-muted/30"
                >
                  <td className="p-4">
                    <Link
                      href={`/admin/orders/${order.id}`}
                      className="font-medium text-primary hover:text-primary-dark"
                    >
                      {order.id}
                    </Link>
                  </td>
                  <td className="p-4">
                    <p className="text-sm font-medium text-foreground">
                      {order.customer_name}
                    </p>
                    <p className="text-xs text-foreground/50">
                      {order.customer_email}
                    </p>
                  </td>
                  <td className="p-4 text-sm text-foreground/70">
                    {new Date(order.created_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </td>
                  <td className="p-4 text-sm text-foreground/70">
                    {order.items_count}
                  </td>
                  <td className="p-4 text-sm font-medium">
                    {order.currency === "CAD" ? "C$" : "US$"}
                    {order.total.toFixed(2)}
                  </td>
                  <td className="p-4">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                        paymentColors[order.payment_status]
                      }`}
                    >
                      {order.payment_status.charAt(0).toUpperCase() +
                        order.payment_status.slice(1)}
                    </span>
                  </td>
                  <td className="p-4">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                        statusColors[order.status]
                      }`}
                    >
                      {order.status.charAt(0).toUpperCase() +
                        order.status.slice(1)}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center justify-end">
                      <Link
                        href={`/admin/orders/${order.id}`}
                        className="p-1.5 text-foreground/50 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                        title="View Order"
                      >
                        <Eye className="w-4 h-4" />
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredOrders.length === 0 && (
          <div className="text-center py-12">
            <p className="text-foreground/60">No orders found</p>
          </div>
        )}
      </div>
    </div>
  );
}
