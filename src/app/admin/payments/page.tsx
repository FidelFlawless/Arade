"use client";

import { useState } from "react";
import { Search, CreditCard, ChevronDown } from "lucide-react";

// Placeholder payments
const placeholderPayments = [
  {
    id: "pay_1",
    order_id: "GS-2024-001",
    customer: "Sarah M.",
    amount: 128.97,
    currency: "CAD",
    status: "succeeded",
    payment_method: "card",
    created_at: "2024-01-20",
  },
  {
    id: "pay_2",
    order_id: "GS-2024-002",
    customer: "Emily R.",
    amount: 74.98,
    currency: "USD",
    status: "succeeded",
    payment_method: "card",
    created_at: "2024-01-19",
  },
  {
    id: "pay_3",
    order_id: "GS-2024-003",
    customer: "John D.",
    amount: 189.99,
    currency: "CAD",
    status: "succeeded",
    payment_method: "card",
    created_at: "2024-01-18",
  },
  {
    id: "pay_4",
    order_id: "GS-2024-004",
    customer: "Jessica L.",
    amount: 62.99,
    currency: "USD",
    status: "succeeded",
    payment_method: "card",
    created_at: "2024-01-17",
  },
  {
    id: "pay_5",
    order_id: "GS-2024-006",
    customer: "Amanda K.",
    amount: 48.99,
    currency: "USD",
    status: "refunded",
    payment_method: "card",
    created_at: "2024-01-15",
  },
];

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  succeeded: "bg-green-100 text-green-800",
  failed: "bg-red-100 text-red-800",
  refunded: "bg-gray-100 text-gray-800",
};

export default function AdminPaymentsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [payments] = useState(placeholderPayments);

  const filteredPayments = payments.filter((payment) => {
    const matchesSearch =
      payment.order_id.toLowerCase().includes(search.toLowerCase()) ||
      payment.customer.toLowerCase().includes(search.toLowerCase());
    const matchesStatus =
      statusFilter === "all" || payment.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalRevenue = payments
    .filter((p) => p.status === "succeeded")
    .reduce((sum, p) => sum + p.amount, 0);
  const totalRefunded = payments
    .filter((p) => p.status === "refunded")
    .reduce((sum, p) => sum + p.amount, 0);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Payments</h1>
        <p className="text-foreground/60">
          View payment history and transaction status
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="card">
          <p className="text-sm text-foreground/60">Total Revenue</p>
          <p className="text-2xl font-bold text-green-600 mt-1">
            C${totalRevenue.toFixed(2)}
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-foreground/60">Total Refunded</p>
          <p className="text-2xl font-bold text-red-600 mt-1">
            C${totalRefunded.toFixed(2)}
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-foreground/60">Net Revenue</p>
          <p className="text-2xl font-bold text-foreground mt-1">
            C${(totalRevenue - totalRefunded).toFixed(2)}
          </p>
        </div>
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
              placeholder="Search by order ID or customer..."
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
              <option value="succeeded">Succeeded</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
              <option value="refunded">Refunded</option>
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/40 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Payments table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left text-sm font-medium text-foreground/60 p-4">
                  Payment ID
                </th>
                <th className="text-left text-sm font-medium text-foreground/60 p-4">
                  Order
                </th>
                <th className="text-left text-sm font-medium text-foreground/60 p-4">
                  Customer
                </th>
                <th className="text-left text-sm font-medium text-foreground/60 p-4">
                  Amount
                </th>
                <th className="text-left text-sm font-medium text-foreground/60 p-4">
                  Method
                </th>
                <th className="text-left text-sm font-medium text-foreground/60 p-4">
                  Status
                </th>
                <th className="text-left text-sm font-medium text-foreground/60 p-4">
                  Date
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredPayments.map((payment) => (
                <tr
                  key={payment.id}
                  className="border-b border-border last:border-0 hover:bg-muted/30"
                >
                  <td className="p-4">
                    <span className="text-sm text-foreground/50 font-mono">
                      {payment.id}
                    </span>
                  </td>
                  <td className="p-4 text-sm font-medium text-primary">
                    {payment.order_id}
                  </td>
                  <td className="p-4 text-sm text-foreground/70">
                    {payment.customer}
                  </td>
                  <td className="p-4 text-sm font-medium">
                    {payment.currency === "CAD" ? "C$" : "US$"}
                    {payment.amount.toFixed(2)}
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-1 text-sm text-foreground/70">
                      <CreditCard className="w-4 h-4" />
                      Card
                    </div>
                  </td>
                  <td className="p-4">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                        statusColors[payment.status]
                      }`}
                    >
                      {payment.status.charAt(0).toUpperCase() +
                        payment.status.slice(1)}
                    </span>
                  </td>
                  <td className="p-4 text-sm text-foreground/70">
                    {new Date(payment.created_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredPayments.length === 0 && (
          <div className="text-center py-12">
            <p className="text-foreground/60">No payments found</p>
          </div>
        )}
      </div>
    </div>
  );
}
