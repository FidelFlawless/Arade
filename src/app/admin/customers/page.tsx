"use client";

import { useState, useEffect } from "react";
import { Search, Users, Mail, MapPin, ShoppingBag, Loader2 } from "lucide-react";

interface Customer {
  id: string;
  full_name: string;
  email: string;
  country: string;
  created_at: string;
  orders_count: number;
  total_spent: number;
}

export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadCustomers(); }, []);

  async function loadCustomers() {
    setLoading(true);
    const res = await fetch("/api/admin/customers");
    if (res.ok) setCustomers(await res.json());
    setLoading(false);
  }

  const filteredCustomers = customers.filter(
    (c) => c.full_name?.toLowerCase().includes(search.toLowerCase()) || c.email?.toLowerCase().includes(search.toLowerCase())
  );

  const totalRevenue = customers.reduce((sum, c) => sum + (c.total_spent || 0), 0);
  const totalOrders = customers.reduce((sum, c) => sum + (c.orders_count || 0), 0);
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Customers</h1>
        <p className="text-foreground/60">{customers.length} registered customers</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center"><Users className="w-5 h-5 text-blue-600" /></div>
            <div><p className="text-sm text-foreground/60">Total Customers</p><p className="text-xl font-bold">{customers.length}</p></div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center"><ShoppingBag className="w-5 h-5 text-green-600" /></div>
            <div><p className="text-sm text-foreground/60">Avg. Order Value</p><p className="text-xl font-bold">C${avgOrderValue.toFixed(2)}</p></div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center"><Mail className="w-5 h-5 text-purple-600" /></div>
            <div><p className="text-sm text-foreground/60">Total Revenue</p><p className="text-xl font-bold">C${totalRevenue.toFixed(2)}</p></div>
          </div>
        </div>
      </div>

      <div className="card mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/40" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email..."
            className="w-full pl-10 pr-4 py-2.5 border border-border rounded-lg text-sm bg-white outline-none" />
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
                  <th className="text-left text-sm font-medium text-foreground/60 p-4">Customer</th>
                  <th className="text-left text-sm font-medium text-foreground/60 p-4">Country</th>
                  <th className="text-left text-sm font-medium text-foreground/60 p-4">Orders</th>
                  <th className="text-left text-sm font-medium text-foreground/60 p-4">Total Spent</th>
                  <th className="text-left text-sm font-medium text-foreground/60 p-4">Joined</th>
                </tr>
              </thead>
              <tbody>
                {filteredCustomers.map((customer) => (
                  <tr key={customer.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                          <span className="text-primary font-medium">{(customer.full_name || "?").charAt(0).toUpperCase()}</span>
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{customer.full_name || "Unknown"}</p>
                          <p className="text-xs text-foreground/50">{customer.email || ""}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4"><div className="flex items-center gap-1 text-sm text-foreground/70"><MapPin className="w-4 h-4" />{customer.country === "CA" ? "Canada" : "USA"}</div></td>
                    <td className="p-4 text-sm font-medium">{customer.orders_count || 0}</td>
                    <td className="p-4 text-sm font-medium">C${(customer.total_spent || 0).toFixed(2)}</td>
                    <td className="p-4 text-sm text-foreground/70">
                      {customer.created_at ? new Date(customer.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!loading && filteredCustomers.length === 0 && (
          <div className="text-center py-12"><p className="text-foreground/60">No customers found</p></div>
        )}
      </div>
    </div>
  );
}
