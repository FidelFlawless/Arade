"use client";

import { useState, useEffect } from "react";
import { Save, Loader2, Check, X } from "lucide-react";

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState({
    store_name: "Arade",
    store_email: "Fideliarufus35@gmail.com",
    store_phone: "+1 (437) 566-2773",
    store_address: "Ontario\nCanada",
    business_hours: "Mon - Fri: 9:00 AM - 6:00 PM EST\nSat: 10:00 AM - 4:00 PM EST\nSun: Closed",
    free_delivery_threshold: "180",
    delivery_fee_cad: "9.99",
    delivery_fee_usd: "7.99",
    tax_rate: "0",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);


  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    const res = await fetch("/api/admin/settings");
    if (res.ok) {
      const data = await res.json();
      setSettings((prev) => ({ ...prev, ...data }));
    }
    setLoading(false);
  }

  const [toast, setToast] = useState<{ show: boolean; message: string; type: "success" | "error" }>({ show: false, message: "", type: "success" });

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast((prev) => ({ ...prev, show: false })), 4000);
  };

  const handleSave = async () => {
    setSaving(true);
    const res = await fetch("/api/admin/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    setSaving(false);
    if (res.ok) {
      showToast("Settings saved successfully!");
    } else {
      showToast("Failed to save settings. Please try again.", "error");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Settings</h1>
          <p className="text-foreground/60">Configure your store settings</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium disabled:opacity-50"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>

      <div className="max-w-2xl space-y-6">
        {/* Store Info */}
        <div className="card">
          <h2 className="text-lg font-semibold text-foreground mb-4">Store Information</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Store Name</label>
              <input
                type="text"
                value={settings.store_name}
                onChange={(e) => setSettings({ ...settings, store_name: e.target.value })}
                className="w-full px-4 py-2.5 border border-border rounded-lg text-sm outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Support Email</label>
              <input
                type="email"
                suppressHydrationWarning
                value={settings.store_email}
                onChange={(e) => setSettings({ ...settings, store_email: e.target.value })}
                className="w-full px-4 py-2.5 border border-border rounded-lg text-sm outline-none"
              />
            </div>
          </div>
        </div>

        {/* Contact Information */}
        <div className="card">
          <h2 className="text-lg font-semibold text-foreground mb-4">Contact Information</h2>
          <p className="text-sm text-foreground/60 mb-4">Displayed on the Contact page</p>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Phone Number</label>
              <input
                type="text"
                value={settings.store_phone}
                onChange={(e) => setSettings({ ...settings, store_phone: e.target.value })}
                className="w-full px-4 py-2.5 border border-border rounded-lg text-sm outline-none"
                placeholder="+1 (800) 555-GLOW"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Address</label>
              <textarea
                value={settings.store_address}
                onChange={(e) => setSettings({ ...settings, store_address: e.target.value })}
                rows={3}
                className="w-full px-4 py-2.5 border border-border rounded-lg text-sm outline-none resize-none"
                placeholder="123 Beauty Lane&#10;Toronto, ON M5V 2T6&#10;Canada"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Business Hours</label>
              <textarea
                value={settings.business_hours}
                onChange={(e) => setSettings({ ...settings, business_hours: e.target.value })}
                rows={3}
                className="w-full px-4 py-2.5 border border-border rounded-lg text-sm outline-none resize-none"
                placeholder="Mon - Fri: 9:00 AM - 6:00 PM EST&#10;Sat: 10:00 AM - 4:00 PM EST&#10;Sun: Closed"
              />
            </div>
          </div>
        </div>

        {/* Delivery Settings */}
        <div className="card">
          <h2 className="text-lg font-semibold text-foreground mb-4">Delivery Settings</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Free Delivery Threshold ($)</label>
              <input
                type="number"
                value={settings.free_delivery_threshold}
                onChange={(e) => setSettings({ ...settings, free_delivery_threshold: e.target.value })}
                className="w-full px-4 py-2.5 border border-border rounded-lg text-sm outline-none"
                min="0"
              />
              <p className="text-xs text-foreground/50 mt-1">Orders above this amount get free delivery</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Delivery Fee (CAD)</label>
                <input
                  type="number"
                  value={settings.delivery_fee_cad}
                  onChange={(e) => setSettings({ ...settings, delivery_fee_cad: e.target.value })}
                  className="w-full px-4 py-2.5 border border-border rounded-lg text-sm outline-none"
                  min="0"
                  step="0.01"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Delivery Fee (USD)</label>
                <input
                  type="number"
                  value={settings.delivery_fee_usd}
                  onChange={(e) => setSettings({ ...settings, delivery_fee_usd: e.target.value })}
                  className="w-full px-4 py-2.5 border border-border rounded-lg text-sm outline-none"
                  min="0"
                  step="0.01"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Tax Settings */}
        <div className="card">
          <h2 className="text-lg font-semibold text-foreground mb-4">Tax Settings</h2>
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Tax Rate (%)</label>
            <input
              type="number"
              value={settings.tax_rate}
              onChange={(e) => setSettings({ ...settings, tax_rate: e.target.value })}
              className="w-full px-4 py-2.5 border border-border rounded-lg text-sm outline-none"
              min="0"
              max="100"
              step="0.01"
            />
            <p className="text-xs text-foreground/50 mt-1">Set to 0 if tax is included in product prices</p>
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      {toast.show && (
        <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-top-5 fade-in duration-300">
          <div
            className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border ${
              toast.type === "success"
                ? "bg-green-50 border-green-200 text-green-800"
                : "bg-red-50 border-red-200 text-red-800"
            }`}
          >
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center ${
                toast.type === "success" ? "bg-green-500" : "bg-red-500"
              }`}
            >
              <Check className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-medium">{toast.message}</span>
            <button
              onClick={() => setToast((prev) => ({ ...prev, show: false }))}
              className="ml-2 p-0.5 hover:bg-black/5 rounded"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
