"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { DollarSign, ShoppingCart, Users, Package, AlertTriangle, Loader2 } from "lucide-react";

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800", processing: "bg-blue-100 text-blue-800",
  shipped: "bg-purple-100 text-purple-800", delivered: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

export default function AdminDashboard() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadStats(); }, []);

  async function loadStats() {
    const [ordersRes, customersRes, productsRes] = await Promise.all([
      fetch("/api/admin/orders"),
      fetch("/api/admin/customers"),
      fetch("/api/admin/products"),
    ]);

    const orders = ordersRes.ok ? await ordersRes.json() : [];
    const customers = customersRes.ok ? await customersRes.json() : [];
    const products = productsRes.ok ? await productsRes.json() : [];

    const totalSales = orders.filter((o: any) => o.currency === "CAD").reduce((s: number, o: any) => s + (o.total || 0), 0);
    const pendingOrders = orders.filter((o: any) => o.order_status === "pending").length;
    const lowStock = products.filter((p: any) => p.is_active && p.stock_quantity < 10).slice(0, 5);
    const recentOrders = orders.slice(0, 5);

    setStats({ totalSales, totalOrders: orders.length, totalCustomers: customers.length, totalProducts: products.length, pendingOrders, lowStock, recentOrders });
    setLoading(false);
  }

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  const statCards = [
    { label: "Total Sales", value: `C$${stats?.totalSales?.toFixed(2) || "0.00"}`, icon: DollarSign, color: "bg-green-500" },
    { label: "Total Orders", value: stats?.totalOrders || 0, icon: ShoppingCart, color: "bg-blue-500" },
    { label: "Total Customers", value: stats?.totalCustomers || 0, icon: Users, color: "bg-purple-500" },
    { label: "Total Products", value: stats?.totalProducts || 0, icon: Package, color: "bg-orange-500" },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-foreground/60">Welcome back! Here&apos;s what&apos;s happening with your store.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="card">
              <div className="flex items-center justify-between">
                <div><p className="text-sm text-foreground/60">{stat.label}</p><p className="text-2xl font-bold mt-1">{stat.value}</p></div>
                <div className={`w-12 h-12 ${stat.color} rounded-lg flex items-center justify-center`}><Icon className="w-6 h-6 text-white" /></div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Recent Orders</h2>
              <Link href="/admin/orders" className="text-sm text-primary hover:text-primary-dark">View all</Link>
            </div>
            {stats?.recentOrders?.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead><tr className="border-b border-border">
                    <th className="text-left text-sm font-medium text-foreground/60 pb-3">Order</th>
                    <th className="text-left text-sm font-medium text-foreground/60 pb-3">Customer</th>
                    <th className="text-left text-sm font-medium text-foreground/60 pb-3">Total</th>
                    <th className="text-left text-sm font-medium text-foreground/60 pb-3">Status</th>
                  </tr></thead>
                  <tbody>
                    {stats.recentOrders.map((order: any) => (
                      <tr key={order.id} className="border-b border-border last:border-0">
                        <td className="py-3"><Link href={`/admin/orders/${order.id}`} className="font-medium text-primary hover:text-primary-dark">{order.order_number || order.id.slice(0, 8)}</Link></td>
                        <td className="py-3 text-sm text-foreground/70">{order.profiles?.full_name || "Customer"}</td>
                        <td className="py-3 text-sm font-medium">{order.currency === "CAD" ? "C$" : "US$"}{order.total?.toFixed(2)}</td>
                        <td className="py-3"><span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[order.order_status] || "bg-gray-100"}`}>{order.order_status?.charAt(0).toUpperCase() + order.order_status?.slice(1)}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p className="text-center text-foreground/60 py-8">No orders yet</p>}
          </div>
        </div>

        <div className="space-y-6">
          <div className="card">
            <div className="flex items-center gap-2 mb-4"><AlertTriangle className="w-5 h-5 text-yellow-500" /><h2 className="text-lg font-semibold">Low Stock Alert</h2></div>
            {stats?.lowStock?.length > 0 ? (
              <div className="space-y-3">
                {stats.lowStock.map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between">
                    <p className="text-sm text-foreground/70 truncate mr-2">{p.name}</p>
                    <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full whitespace-nowrap">{p.stock_quantity} left</span>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-foreground/60">All products well stocked</p>}
            <Link href="/admin/products" className="block mt-4 text-sm text-primary hover:text-primary-dark">Manage inventory →</Link>
          </div>

          <div className="card">
            <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
            <div className="space-y-2">
              <Link href="/admin/products/new" className="block w-full text-left px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors text-sm">+ Add New Product</Link>
              <Link href="/admin/orders" className="block w-full text-left px-4 py-2 bg-muted text-foreground rounded-lg hover:bg-border transition-colors text-sm">{stats?.pendingOrders ? `View ${stats.pendingOrders} Pending Orders` : "View Orders"}</Link>
              <Link href="/admin/customers" className="block w-full text-left px-4 py-2 bg-muted text-foreground rounded-lg hover:bg-border transition-colors text-sm">Manage Customers</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
