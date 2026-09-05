"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";
import { createClient } from "@/lib/supabase/client";
import { MapPin, Plus, Edit2, Trash2, Star, Loader2 } from "lucide-react";
import { CANADIAN_PROVINCES, US_STATES } from "@/lib/constants";


interface AddressForm {
  first_name: string;
  last_name: string;
  address_line1: string;
  address_line2: string;
  city: string;
  province_state: string;
  postal_code: string;
  country: "CA" | "US";
  phone: string;
  is_default: boolean;
}

const emptyForm: AddressForm = {
  first_name: "",
  last_name: "",
  address_line1: "",
  address_line2: "",
  city: "",
  province_state: "",
  postal_code: "",
  country: "CA",
  phone: "",
  is_default: false,
};

export default function AddressesPage() {
  const { user, loading } = useAuth();
  const [addresses, setAddresses] = useState<AddressRow[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<AddressForm>(emptyForm);
  const [addressesLoading, setAddressesLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    if (!user) { setAddressesLoading(false); return; }
    fetchAddresses();
  }, [user]);

  const fetchAddresses = async () => {
    if (!user) return;
    const { data } = await supabase.from("addresses").select("*").eq("user_id", user.id).order("is_default", { ascending: false }).order("created_at", { ascending: false });
    if (data) setAddresses(data);
    setAddressesLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-bold text-foreground mb-2">
            Please sign in
          </h2>
          <Link href="/auth/login" className="btn-primary">
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (form.is_default) {
        await supabase.from("addresses").update({ is_default: false }).eq("user_id", user.id).eq("is_default", true);
      }
      const { error } = await supabase.from("addresses").insert({
        user_id: user.id, first_name: form.first_name, last_name: form.last_name,
        address_line1: form.address_line1, address_line2: form.address_line2 || null,
        city: form.city, province_state: form.province_state, postal_code: form.postal_code,
        country: form.country, phone: form.phone || null, is_default: form.is_default,
      });
      if (error) throw error;

    if (form.is_default) {
      setAddresses((prev) =>
        prev.map((a) => ({ ...a, is_default: false }))
      );
    }

    await fetchAddresses();
    setForm(emptyForm);
      setShowForm(false);
    } catch (err) { console.error(err); } finally { setSaving(false); }
  };

  const deleteAddress = async (id: string) => {
    await supabase.from("addresses").delete().eq("id", id);
    setAddresses((prev) => prev.filter((a) => a.id !== id));
  };

  const setDefault = async (id: string) => {
    await supabase.from("addresses").update({ is_default: false }).eq("user_id", user.id).eq("is_default", true);
    await supabase.from("addresses").update({ is_default: true }).eq("id", id);
    setAddresses((prev) => prev.map((a) => ({ ...a, is_default: a.id === id })));
  };

  const provinces =
    form.country === "CA" ? CANADIAN_PROVINCES : US_STATES;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 sm:mb-8">
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-foreground">
          Saved Addresses
        </h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="btn-primary flex items-center justify-center gap-2 w-full sm:w-auto"
        >
          <Plus className="w-4 h-4" />
          Add Address
        </button>
      </div>

      {/* Add address form */}
      {showForm && (
        <div className="card mb-8">
          <h2 className="text-lg font-semibold text-foreground mb-4">
            New Address
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  First Name
                </label>
                <input
                  type="text"
                  value={form.first_name}
                  onChange={(e) =>
                    setForm({ ...form, first_name: e.target.value })
                  }
                  required
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Last Name
                </label>
                <input
                  type="text"
                  value={form.last_name}
                  onChange={(e) =>
                    setForm({ ...form, last_name: e.target.value })
                  }
                  required
                  className="input"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Country
              </label>
              <select
                value={form.country}
                onChange={(e) =>
                  setForm({
                    ...form,
                    country: e.target.value as "CA" | "US",
                    province_state: "",
                  })
                }
                className="input"
              >
                <option value="CA">Canada</option>
                <option value="US">United States</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Address Line 1
              </label>
              <input
                type="text"
                value={form.address_line1}
                onChange={(e) =>
                  setForm({ ...form, address_line1: e.target.value })
                }
                required
                className="input"
                placeholder="Street address"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Address Line 2 (Optional)
              </label>
              <input
                type="text"
                value={form.address_line2}
                onChange={(e) =>
                  setForm({ ...form, address_line2: e.target.value })
                }
                className="input"
                placeholder="Apt, suite, unit, etc."
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  City
                </label>
                <input
                  type="text"
                  value={form.city}
                  onChange={(e) =>
                    setForm({ ...form, city: e.target.value })
                  }
                  required
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Province/State
                </label>
                <select
                  value={form.province_state}
                  onChange={(e) =>
                    setForm({ ...form, province_state: e.target.value })
                  }
                  required
                  className="input"
                >
                  <option value="">Select...</option>
                  {provinces.map((p) => (
                    <option key={p.code} value={p.code}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  {form.country === "CA" ? "Postal Code" : "ZIP Code"}
                </label>
                <input
                  type="text"
                  value={form.postal_code}
                  onChange={(e) =>
                    setForm({ ...form, postal_code: e.target.value })
                  }
                  required
                  className="input"
                  placeholder={
                    form.country === "CA" ? "A1A 1A1" : "12345"
                  }
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Phone (Optional)
              </label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) =>
                  setForm({ ...form, phone: e.target.value })
                }
                className="input"
                placeholder="+1 (555) 123-4567"
              />
            </div>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.is_default}
                onChange={(e) =>
                  setForm({ ...form, is_default: e.target.checked })
                }
                className="w-4 h-4 rounded border-border text-primary focus:ring-primary/20"
              />
              <span className="text-sm text-foreground/70">
                Set as default address
              </span>
            </label>

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={saving}
                className="btn-primary flex items-center gap-2"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : null}
                Save Address
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setForm(emptyForm);
                }}
                className="btn-outline"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Address list */}
      {addresses.length === 0 ? (
        <div className="text-center py-16">
          <MapPin className="w-16 h-16 text-foreground/20 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">
            No saved addresses
          </h3>
          <p className="text-foreground/60 mb-6">
            Add an address to speed up checkout
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="btn-primary"
          >
            Add Your First Address
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {addresses.map((address) => (
            <div
              key={address.id}
              className={`card relative ${
                address.is_default ? "border-primary" : ""
              }`}
            >
              {address.is_default && (
                <span className="absolute top-3 right-3 bg-primary text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                  <Star className="w-3 h-3" /> Default
                </span>
              )}
              <p className="font-medium text-foreground">
                {address.first_name} {address.last_name}
              </p>
              <p className="text-sm text-foreground/60 mt-2">
                {address.address_line1}
                {address.address_line2 && (
                  <>, {address.address_line2}</>
                )}
              </p>
              <p className="text-sm text-foreground/60">
                {address.city},{" "}
                {address.province_state} {address.postal_code}
              </p>
              <p className="text-sm text-foreground/60">
                {address.country === "CA" ? "Canada" : "United States"}
              </p>
              {address.phone && (
                <p className="text-sm text-foreground/60 mt-1">
                  {address.phone}
                </p>
              )}
              <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border">
                {!address.is_default && (
                  <button
                    onClick={() => setDefault(address.id)}
                    className="text-xs text-primary hover:text-primary-dark"
                  >
                    Set as Default
                  </button>
                )}
                <button className="text-xs text-foreground/50 hover:text-primary flex items-center gap-1">
                  <Edit2 className="w-3 h-3" /> Edit
                </button>
                <button
                  onClick={() => deleteAddress(address.id)}
                  className="text-xs text-foreground/50 hover:text-red-600 flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
