"use client";

import { useState } from "react";
import { Save, Loader2 } from "lucide-react";
import {
  FREE_DELIVERY_THRESHOLD,
  DELIVERY_FEE_CAD,
  DELIVERY_FEE_USD,
} from "@/lib/constants";

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState({
    store_name: "GlowSkin",
    store_email: "support@glowskin.com",
    free_delivery_threshold: FREE_DELIVERY_THRESHOLD,
    delivery_fee_cad: DELIVERY_FEE_CAD,
    delivery_fee_usd: DELIVERY_FEE_USD,
    currency: "CAD",
    tax_rate: 0,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    // TODO: Save to database
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Settings</h1>
          <p className="text-foreground/60">
            Configure your store settings
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-primary flex items-center gap-2"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {saving ? "Saving..." : saved ? "Saved!" : "Save Changes"}
        </button>
      </div>

      <div className="max-w-2xl space-y-6">
        {/* Store Info */}
        <div className="card">
          <h2 className="text-lg font-semibold text-foreground mb-4">
            Store Information
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Store Name
              </label>
              <input
                type="text"
                value={settings.store_name}
                onChange={(e) =>
                  setSettings({ ...settings, store_name: e.target.value })
                }
                className="input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Support Email
              </label>
              <input
                type="email"
                value={settings.store_email}
                onChange={(e) =>
                  setSettings({ ...settings, store_email: e.target.value })
                }
                className="input"
              />
            </div>
          </div>
        </div>

        {/* Delivery Settings */}
        <div className="card">
          <h2 className="text-lg font-semibold text-foreground mb-4">
            Delivery Settings
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Free Delivery Threshold ($)
              </label>
              <input
                type="number"
                value={settings.free_delivery_threshold}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    free_delivery_threshold: Number(e.target.value),
                  })
                }
                className="input"
                min="0"
              />
              <p className="text-xs text-foreground/50 mt-1">
                Orders above this amount get free delivery
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Delivery Fee (CAD)
                </label>
                <input
                  type="number"
                  value={settings.delivery_fee_cad}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      delivery_fee_cad: Number(e.target.value),
                    })
                  }
                  className="input"
                  min="0"
                  step="0.01"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Delivery Fee (USD)
                </label>
                <input
                  type="number"
                  value={settings.delivery_fee_usd}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      delivery_fee_usd: Number(e.target.value),
                    })
                  }
                  className="input"
                  min="0"
                  step="0.01"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Tax Settings */}
        <div className="card">
          <h2 className="text-lg font-semibold text-foreground mb-4">
            Tax Settings
          </h2>
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Tax Rate (%)
            </label>
            <input
              type="number"
              value={settings.tax_rate}
              onChange={(e) =>
                setSettings({ ...settings, tax_rate: Number(e.target.value) })
              }
              className="input"
              min="0"
              max="100"
              step="0.01"
            />
            <p className="text-xs text-foreground/50 mt-1">
              Set to 0 if tax is included in product prices
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
