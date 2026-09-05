"use client";

import { useState } from "react";
import { Search, Users, Mail, MapPin, ShoppingBag } from "lucide-react";

// Placeholder customers
const placeholderCustomers = [
  {
    id: "1",
    full_name: "Sarah M.",
    email: "sarah@example.com",
    country: "CA",
    orders_count: 5,
    total_spent: 456.95,
    currency: "CAD",
    created_at: "2023-06-15",
  },
  {
    id: "2",
    full_name: "Emily R.",
    email: "emily@example.com",
    country: "US",
    orders_count: 3,
    total_spent: 234.97,
    currency: "USD",
    created_at: "2023-08-22",
  },
  {
    id: "3",
    full_name: "John D.",
    email: "john@example.com",
    country: "CA",
    orders_count: 8,
    total_spent: 892.92,
    currency: "CAD",
    created_at: "2023-03-10",
  },
  {
    id: "4",
    full_name: "Jessica L.",
    email: "jessica@example.com",
    country: "US",
    orders_count: 2,
    total_spent: 125.98,
    currency: "USD",
    created_at: "2024-01-05",
  },
  {
    id: "5",
    full_name: "Michael B.",
    email: "michael@example.com",
    country: "CA",
    orders_count: 4,
    total_spent: 567.96,
    currency: "CAD",
    created_at: "2023-11-20",
  },
  {
    id: "6",
    full_name: "Amanda K.",
    email: "amanda@example.com",
    country: "US",
    orders_count: 1,
    total_spent: 48.99,
    currency: "USD",
    created_at: "2024-01-15",
  },
];

export default function AdminCustomersPage() {
  const [search, setSearch] = useState("");
  const [customers] = useState(placeholderCustomers);

  const filteredCustomers = customers.filter(
    (c) =>
      c.full_name.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase())
  );

  const totalCustomers = customers.length;
  const totalRevenue = customers.reduce((sum, c) => sum + c.total_spent, 0);
  const avgOrderValue = totalRevenue / customers.reduce((sum, c) => sum + c.orders_count, 0);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Customers</h1>
        <p className="text-foreground/60">
          View and manage your customer base
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-foreground/60">Total Customers</p>
              <p className="text-xl font-bold text-foreground">
                {totalCustomers}
              </p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <ShoppingBag className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-foreground/60">Avg. Order Value</p>
              <p className="text-xl font-bold text-foreground">
                C${avgOrderValue.toFixed(2)}
              </p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <Mail className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-foreground/60">
                Total Revenue
              </p>
              <p className="text-xl font-bold text-foreground">
                C${totalRevenue.toFixed(2)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="card mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/40" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email..."
            className="input input-icon"
          />
        </div>
      </div>

      {/* Customers table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left text-sm font-medium text-foreground/60 p-4">
                  Customer
                </th>
                <th className="text-left text-sm font-medium text-foreground/60 p-4">
                  Country
                </th>
                <th className="text-left text-sm font-medium text-foreground/60 p-4">
                  Orders
                </th>
                <th className="text-left text-sm font-medium text-foreground/60 p-4">
                  Total Spent
                </th>
                <th className="text-left text-sm font-medium text-foreground/60 p-4">
                  Joined
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredCustomers.map((customer) => (
                <tr
                  key={customer.id}
                  className="border-b border-border last:border-0 hover:bg-muted/30"
                >
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                        <span className="text-primary font-medium">
                          {customer.full_name.charAt(0)}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-foreground">
                          {customer.full_name}
                        </p>
                        <p className="text-xs text-foreground/50">
                          {customer.email}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-1 text-sm text-foreground/70">
                      <MapPin className="w-4 h-4" />
                      {customer.country === "CA" ? "Canada" : "USA"}
                    </div>
                  </td>
                  <td className="p-4 text-sm font-medium">
                    {customer.orders_count}
                  </td>
                  <td className="p-4 text-sm font-medium">
                    {customer.currency === "CAD" ? "C$" : "US$"}
                    {customer.total_spent.toFixed(2)}
                  </td>
                  <td className="p-4 text-sm text-foreground/70">
                    {new Date(customer.created_at).toLocaleDateString(
                      "en-US",
                      {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      }
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredCustomers.length === 0 && (
          <div className="text-center py-12">
            <p className="text-foreground/60">No customers found</p>
          </div>
        )}
      </div>
    </div>
  );
}
