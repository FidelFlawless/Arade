"use client";

import Link from "next/link";
import {
  DollarSign,
  ShoppingCart,
  Users,
  Package,
  TrendingUp,
  AlertTriangle,
} from "lucide-react";

// Placeholder stats
const stats = [
  {
    label: "Total Sales",
    value: "$24,563.00",
    change: "+12.5%",
    icon: DollarSign,
    color: "bg-green-500",
  },
  {
    label: "Total Orders",
    value: "156",
    change: "+8.2%",
    icon: ShoppingCart,
    color: "bg-blue-500",
  },
  {
    label: "Total Customers",
    value: "89",
    change: "+15.3%",
    icon: Users,
    color: "bg-purple-500",
  },
  {
    label: "Total Products",
    value: "24",
    change: "+2",
    icon: Package,
    color: "bg-orange-500",
  },
];

const recentOrders = [
  {
    id: "GS-2024-001",
    customer: "Sarah M.",
    total: 128.97,
    currency: "CAD",
    status: "processing",
    date: "2024-01-20",
  },
  {
    id: "GS-2024-002",
    customer: "Emily R.",
    total: 74.98,
    currency: "USD",
    status: "shipped",
    date: "2024-01-19",
  },
  {
    id: "GS-2024-003",
    customer: "John D.",
    total: 189.99,
    currency: "CAD",
    status: "pending",
    date: "2024-01-18",
  },
  {
    id: "GS-2024-004",
    customer: "Jessica L.",
    total: 62.99,
    currency: "USD",
    status: "delivered",
    date: "2024-01-17",
  },
  {
    id: "GS-2024-005",
    customer: "Michael B.",
    total: 156.97,
    currency: "CAD",
    status: "processing",
    date: "2024-01-16",
  },
];

const lowStockProducts = [
  { name: "Complete Glow Set", stock: 3 },
  { name: "Essentials Skincare Set", stock: 5 },
  { name: "Anti-Aging Night Serum", stock: 7 },
];

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  processing: "bg-blue-100 text-blue-800",
  shipped: "bg-purple-100 text-purple-800",
  delivered: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

export default function AdminDashboard() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-foreground/60">
          Welcome back! Here&apos;s what&apos;s happening with your store.
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-foreground/60">{stat.label}</p>
                  <p className="text-2xl font-bold text-foreground mt-1">
                    {stat.value}
                  </p>
                  <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" />
                    {stat.change} from last month
                  </p>
                </div>
                <div
                  className={`w-12 h-12 ${stat.color} rounded-lg flex items-center justify-center`}
                >
                  <Icon className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent orders */}
        <div className="lg:col-span-2">
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground">
                Recent Orders
              </h2>
              <Link
                href="/admin/orders"
                className="text-sm text-primary hover:text-primary-dark"
              >
                View all
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left text-sm font-medium text-foreground/60 pb-3">
                      Order
                    </th>
                    <th className="text-left text-sm font-medium text-foreground/60 pb-3">
                      Customer
                    </th>
                    <th className="text-left text-sm font-medium text-foreground/60 pb-3">
                      Total
                    </th>
                    <th className="text-left text-sm font-medium text-foreground/60 pb-3">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.map((order) => (
                    <tr
                      key={order.id}
                      className="border-b border-border last:border-0"
                    >
                      <td className="py-3">
                        <Link
                          href={`/admin/orders/${order.id}`}
                          className="font-medium text-primary hover:text-primary-dark"
                        >
                          {order.id}
                        </Link>
                      </td>
                      <td className="py-3 text-sm text-foreground/70">
                        {order.customer}
                      </td>
                      <td className="py-3 text-sm font-medium">
                        {order.currency === "CAD" ? "C$" : "US$"}
                        {order.total.toFixed(2)}
                      </td>
                      <td className="py-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                            statusColors[order.status]
                          }`}
                        >
                          {order.status.charAt(0).toUpperCase() +
                            order.status.slice(1)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Alerts & quick actions */}
        <div className="space-y-6">
          {/* Low stock alert */}
          <div className="card">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="w-5 h-5 text-yellow-500" />
              <h2 className="text-lg font-semibold text-foreground">
                Low Stock Alert
              </h2>
            </div>
            <div className="space-y-3">
              {lowStockProducts.map((product) => (
                <div
                  key={product.name}
                  className="flex items-center justify-between"
                >
                  <p className="text-sm text-foreground/70">{product.name}</p>
                  <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                    {product.stock} left
                  </span>
                </div>
              ))}
            </div>
            <Link
              href="/admin/products"
              className="block mt-4 text-sm text-primary hover:text-primary-dark"
            >
              Manage inventory →
            </Link>
          </div>

          {/* Quick actions */}
          <div className="card">
            <h2 className="text-lg font-semibold text-foreground mb-4">
              Quick Actions
            </h2>
            <div className="space-y-2">
              <Link
                href="/admin/products/new"
                className="block w-full text-left px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors text-sm"
              >
                + Add New Product
              </Link>
              <Link
                href="/admin/orders"
                className="block w-full text-left px-4 py-2 bg-muted text-foreground rounded-lg hover:bg-border transition-colors text-sm"
              >
                View Pending Orders
              </Link>
              <Link
                href="/admin/customers"
                className="block w-full text-left px-4 py-2 bg-muted text-foreground rounded-lg hover:bg-border transition-colors text-sm"
              >
                Manage Customers
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
