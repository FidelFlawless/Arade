"use client";

import { useState, useEffect } from "react";
import { Search, Loader2 } from "lucide-react";

interface Payment {
  id: string;
  amount: number;
  currency: string;
  status: string;
  created_at: string;
  orders: { order_number: string; profiles: { full_name: string } | null } | null;
}

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800", succeeded: "bg-green-100 text-green-800",
  paid: "bg-green-100 text-green-800", failed: "bg-red-100 text-red-800", refunded: "bg-gray-100 text-gray-800",
};

export default function AdminPaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadPayments(); }, []);

  async function loadPayments() {
    setLoading(true);
    const res = await fetch("/api/admin/payments");
    if (res.ok) setPayments(await res.json());
    setLoading(false);
  }

  const filteredPayments = payments.filter((p) => {
    const q = search.toLowerCase();
    const matchesSearch = p.orders?.order_number?.toLowerCase().includes(q) || p.orders?.profiles?.full_name?.toLowerCase().includes(q);
    const matchesStatus = statusFilter === "all" || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalSucceeded = payments.filter((p) => p.status === "succeeded" || p.status === "paid").reduce((s, p) => s + p.amount, 0);
  const totalRefunded = payments.filter((p) => p.status === "refunded").reduce((s, p) => s + p.amount, 0);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Payments</h1>
        <p className="text-foreground/60">{payments.length} transactions</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="card"><p className="text-sm text-foreground/60">Total Revenue</p><p className="text-2xl font-bold text-green-600 mt-1">C${totalSucceeded.toFixed(2)}</p></div>
        <div className="card"><p className="text-sm text-foreground/60">Total Refunded</p><p className="text-2xl font-bold text-red-600 mt-1">C${totalRefunded.toFixed(2)}</p></div>
        <div className="card"><p className="text-sm text-foreground/60">Net Revenue</p><p className="text-2xl font-bold mt-1">C${(totalSucceeded - totalRefunded).toFixed(2)}</p></div>
      </div>

      <div className="card mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/40" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by order number or customer..."
              className="w-full pl-10 pr-4 py-2.5 border border-border rounded-lg text-sm bg-white outline-none" />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2.5 border border-border rounded-lg text-sm bg-white outline-none">
            <option value="all">All Statuses</option>
            <option value="succeeded">Succeeded</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
            <option value="refunded">Refunded</option>
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
                  <th className="text-left text-sm font-medium text-foreground/60 p-4">Payment ID</th>
                  <th className="text-left text-sm font-medium text-foreground/60 p-4">Order</th>
                  <th className="text-left text-sm font-medium text-foreground/60 p-4">Customer</th>
                  <th className="text-left text-sm font-medium text-foreground/60 p-4">Amount</th>
                  <th className="text-left text-sm font-medium text-foreground/60 p-4">Status</th>
                  <th className="text-left text-sm font-medium text-foreground/60 p-4">Date</th>
                </tr>
              </thead>
              <tbody>
                {filteredPayments.map((payment) => (
                  <tr key={payment.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                    <td className="p-4"><span className="text-sm text-foreground/50 font-mono">{payment.id.slice(0, 12)}...</span></td>
                    <td className="p-4 text-sm font-medium text-primary">{payment.orders?.order_number || "—"}</td>
                    <td className="p-4 text-sm text-foreground/70">{payment.orders?.profiles?.full_name || "—"}</td>
                    <td className="p-4 text-sm font-medium">{payment.currency === "CAD" ? "C$" : "US$"}{payment.amount.toFixed(2)}</td>
                    <td className="p-4">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[payment.status] || "bg-gray-100"}`}>
                        {payment.status?.charAt(0).toUpperCase() + payment.status?.slice(1)}
                      </span>
                    </td>
                    <td className="p-4 text-sm text-foreground/70">
                      {payment.created_at ? new Date(payment.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!loading && filteredPayments.length === 0 && (
          <div className="text-center py-12"><p className="text-foreground/60">No payments found</p></div>
        )}
      </div>
    </div>
  );
}
