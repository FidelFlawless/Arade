"use client";

import { useState, useEffect } from "react";
import { Loader2, Plus, Pencil, Trash2, X, TicketPercent } from "lucide-react";

interface Coupon {
  id: string;
  code: string;
  description: string | null;
  discount_type: "percent" | "fixed";
  discount_value_cad: number;
  discount_value_usd: number | null;
  min_subtotal_cad: number;
  min_subtotal_usd: number;
  max_uses: number | null;
  used_count: number;
  active: boolean;
  expires_at: string | null;
  first_order_only: boolean;
  expires_days_after_signup: number | null;
  created_at: string;
}

const emptyForm = {
  id: "",
  code: "",
  description: "",
  discount_type: "percent" as "percent" | "fixed",
  discount_value_cad: "",
  discount_value_usd: "",
  min_subtotal_cad: "",
  min_subtotal_usd: "",
  max_uses: "",
  active: true,
  expires_at: "",
  first_order_only: false,
  expires_days_after_signup: "",
};

export default function AdminCouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { loadCoupons(); }, []);

  async function loadCoupons() {
    setLoading(true);
    const res = await fetch("/api/admin/coupons");
    if (res.ok) setCoupons(await res.json());
    setLoading(false);
  }

  function openCreate() {
    setForm(emptyForm);
    setError("");
    setShowForm(true);
  }

  function openEdit(coupon: Coupon) {
    setForm({
      id: coupon.id,
      code: coupon.code,
      description: coupon.description || "",
      discount_type: coupon.discount_type,
      discount_value_cad: String(coupon.discount_value_cad ?? ""),
      discount_value_usd: coupon.discount_value_usd === null ? "" : String(coupon.discount_value_usd),
      min_subtotal_cad: coupon.min_subtotal_cad ? String(coupon.min_subtotal_cad) : "",
      min_subtotal_usd: coupon.min_subtotal_usd ? String(coupon.min_subtotal_usd) : "",
      max_uses: coupon.max_uses === null ? "" : String(coupon.max_uses),
      active: coupon.active,
      expires_at: coupon.expires_at ? coupon.expires_at.slice(0, 10) : "",
      first_order_only: coupon.first_order_only ?? false,
      expires_days_after_signup:
        coupon.expires_days_after_signup == null ? "" : String(coupon.expires_days_after_signup),
    });
    setError("");
    setShowForm(true);
  }

  async function saveCoupon() {
    setSaving(true);
    setError("");
    const payload = {
      code: form.code,
      description: form.description,
      discount_type: form.discount_type,
      discount_value_cad: form.discount_value_cad,
      discount_value_usd: form.discount_type === "fixed" ? form.discount_value_usd : null,
      min_subtotal_cad: form.min_subtotal_cad || 0,
      min_subtotal_usd: form.min_subtotal_usd || 0,
      max_uses: form.max_uses || null,
      active: form.active,
      expires_at: form.expires_at || null,
      first_order_only: form.first_order_only,
      expires_days_after_signup: form.expires_days_after_signup || null,
    };
    const res = await fetch("/api/admin/coupons", {
      method: form.id ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form.id ? { id: form.id, ...payload } : payload),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error || "Failed to save coupon");
      return;
    }
    setShowForm(false);
    loadCoupons();
  }

  async function toggleActive(coupon: Coupon) {
    await fetch("/api/admin/coupons", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: coupon.id, active: !coupon.active }),
    });
    setCoupons((prev) => prev.map((c) => (c.id === coupon.id ? { ...c, active: !c.active } : c)));
  }

  async function deleteCoupon(coupon: Coupon) {
    if (!confirm(`Delete coupon ${coupon.code}? This cannot be undone.`)) return;
    const res = await fetch(`/api/admin/coupons?id=${coupon.id}`, { method: "DELETE" });
    if (res.ok) setCoupons((prev) => prev.filter((c) => c.id !== coupon.id));
  }

  return (
    <div>
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Coupons</h1>
          <p className="text-foreground/60">{coupons.length} coupons</p>
        </div>
        <button onClick={openCreate} className="btn-primary inline-flex items-center gap-2">
          <Plus className="w-4 h-4" /> New Coupon
        </button>
      </div>

      {showForm && (
        <div className="card mb-6 border-primary/30">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-foreground">{form.id ? "Edit Coupon" : "New Coupon"}</h2>
            <button onClick={() => setShowForm(false)} className="p-1 text-foreground/50 hover:text-foreground"><X className="w-5 h-5" /></button>
          </div>

          {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Code *</label>
              <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                placeholder="e.g. WELCOME10" className="input" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Description (internal)</label>
              <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="e.g. Launch promo" className="input" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Discount type *</label>
              <select value={form.discount_type} onChange={(e) => setForm({ ...form, discount_type: e.target.value as "percent" | "fixed" })} className="input">
                <option value="percent">Percent off (both currencies)</option>
                <option value="fixed">Fixed amount off</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                {form.discount_type === "percent" ? "Percent value (0-100) *" : "CAD amount *"}
              </label>
              <input type="number" step="0.01" min="0" value={form.discount_value_cad}
                onChange={(e) => setForm({ ...form, discount_value_cad: e.target.value })} className="input" />
            </div>
            {form.discount_type === "fixed" && (
              <div>
                <label className="block text-sm font-medium mb-1">USD amount *</label>
                <input type="number" step="0.01" min="0" value={form.discount_value_usd}
                  onChange={(e) => setForm({ ...form, discount_value_usd: e.target.value })} className="input" />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium mb-1">Min. subtotal (CAD)</label>
              <input type="number" step="0.01" min="0" value={form.min_subtotal_cad}
                onChange={(e) => setForm({ ...form, min_subtotal_cad: e.target.value })} className="input" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Min. subtotal (USD)</label>
              <input type="number" step="0.01" min="0" value={form.min_subtotal_usd}
                onChange={(e) => setForm({ ...form, min_subtotal_usd: e.target.value })} className="input" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Max uses (blank = unlimited)</label>
              <input type="number" min="1" value={form.max_uses}
                onChange={(e) => setForm({ ...form, max_uses: e.target.value })} className="input" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Expiry date (blank = never)</label>
              <input type="date" value={form.expires_at}
                onChange={(e) => setForm({ ...form, expires_at: e.target.value })} className="input" />
            </div>
            <div className="flex items-center">
              <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} className="w-4 h-4 accent-[var(--primary)]" />
                Active (customers can use it)
              </label>
            </div>
            <div className="flex items-center">
              <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                <input type="checkbox" checked={form.first_order_only} onChange={(e) => setForm({ ...form, first_order_only: e.target.checked })} className="w-4 h-4 accent-[var(--primary)]" />
                First order only (welcome discount)
              </label>
            </div>
            {form.first_order_only && (
              <div>
                <label className="block text-sm font-medium mb-1">Expires N days after signup (blank = never)</label>
                <input type="number" min="1" value={form.expires_days_after_signup}
                  onChange={(e) => setForm({ ...form, expires_days_after_signup: e.target.value })} className="input"
                  placeholder="e.g. 30" />
              </div>
            )}
          </div>

          <div className="mt-5 flex gap-3">
            <button onClick={saveCoupon} disabled={saving} className="btn-primary inline-flex items-center gap-2 disabled:opacity-50">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />} {form.id ? "Save Changes" : "Create Coupon"}
            </button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg border border-border text-sm">Cancel</button>
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : coupons.length === 0 ? (
          <div className="text-center py-12">
            <TicketPercent className="w-12 h-12 text-foreground/20 mx-auto mb-3" />
            <p className="text-foreground/60">No coupons yet. Create your first one.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left text-sm font-medium text-foreground/60 p-4">Code</th>
                  <th className="text-left text-sm font-medium text-foreground/60 p-4">Discount</th>
                  <th className="text-left text-sm font-medium text-foreground/60 p-4">Min. order</th>
                  <th className="text-left text-sm font-medium text-foreground/60 p-4">Usage</th>
                  <th className="text-left text-sm font-medium text-foreground/60 p-4">Expires</th>
                  <th className="text-left text-sm font-medium text-foreground/60 p-4">Status</th>
                  <th className="text-right text-sm font-medium text-foreground/60 p-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {coupons.map((coupon) => (
                  <tr key={coupon.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                    <td className="p-4">
                      <p className="font-medium text-primary">{coupon.code}</p>
                      {coupon.description && <p className="text-xs text-foreground/50">{coupon.description}</p>}
                    </td>
                    <td className="p-4 text-sm">
                      {coupon.discount_type === "percent"
                        ? `${coupon.discount_value_cad}% off`
                        : `C$${coupon.discount_value_cad} / US$${coupon.discount_value_usd ?? "—"} off`}
                    </td>
                    <td className="p-4 text-sm text-foreground/70">
                      {coupon.min_subtotal_cad > 0 || coupon.min_subtotal_usd > 0
                        ? `C$${coupon.min_subtotal_cad} / US$${coupon.min_subtotal_usd}`
                        : "—"}
                    </td>
                    <td className="p-4 text-sm text-foreground/70">
                      {coupon.used_count}{coupon.max_uses ? ` / ${coupon.max_uses}` : ""}
                    </td>
                    <td className="p-4 text-sm text-foreground/70">
                      {coupon.expires_at ? new Date(coupon.expires_at).toLocaleDateString("en-CA") : coupon.first_order_only && coupon.expires_days_after_signup ? `${coupon.expires_days_after_signup}d after signup` : "Never"}
                    </td>
                    <td className="p-4">
                      <button onClick={() => toggleActive(coupon)}
                        className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${coupon.active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}`}>
                        {coupon.active ? "Active" : "Paused"}
                      </button>
                    </td>
                    <td className="p-4 text-right">
                      <div className="inline-flex gap-1">
                        <button onClick={() => openEdit(coupon)} className="p-1.5 text-foreground/50 hover:text-primary hover:bg-primary/10 rounded-lg" title="Edit">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => deleteCoupon(coupon)} className="p-1.5 text-foreground/50 hover:text-red-600 hover:bg-red-50 rounded-lg" title="Delete">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
