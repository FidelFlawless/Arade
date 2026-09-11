"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";
import { createClient } from "@/lib/supabase/client";
import { isValidNorthAmericanPhone } from "@/lib/utils";
import { MapPin, Plus, Edit2, Trash2, Loader2 } from "lucide-react";
import { CANADIAN_PROVINCES, US_STATES } from "@/lib/constants";


interface AddressRow {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  address_line1: string;
  address_line2: string | null;
  city: string;
  province_state: string;
  postal_code: string;
  country: string;
  phone: string | null;
  is_default: boolean;
  created_at: string;
}

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
  const [errors, setErrors] = useState<Record<string, string>>({});
  const supabase = createClient();

  useEffect(() => {
    if (!user) { setAddressesLoading(false); return; }
    fetchAddresses();
  }, [user]);

  const fetchAddresses = async () => {
    if (!user) return;
    const res = await fetch("/api/addresses");
    if (res.ok) {
      const data = await res.json();
      setAddresses(data);
    }
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
    const newErrors: Record<string, string> = {};
    if (!form.first_name.trim()) newErrors.first_name = "First name is required";
    if (!form.last_name.trim()) newErrors.last_name = "Last name is required";
    if (!form.address_line1.trim()) newErrors.address_line1 = "Address is required";
    if (!form.city.trim()) newErrors.city = "City is required";
    if (!form.province_state) newErrors.province_state = "Province/State is required";
    if (!form.postal_code.trim()) newErrors.postal_code = "Postal code is required";
    if (!form.phone.trim()) newErrors.phone = "Phone number is required";
    else if (!isValidNorthAmericanPhone(form.phone)) {
      newErrors.phone = "Enter a valid Canada or United States phone number";
    }
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }
    setErrors({});
    setSaving(true);
    try {
      const res = await fetch("/api/addresses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: form.first_name, last_name: form.last_name,
          address_line1: form.address_line1, address_line2: form.address_line2 || null,
          city: form.city, province_state: form.province_state, postal_code: form.postal_code,
          country: form.country, phone: form.phone || null, is_default: true,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        console.error("Address save error:", err);
        alert("Failed to save address: " + (err.error || "Unknown error"));
        return;
      }
      await fetchAddresses();
      setForm(emptyForm);
      setShowForm(false);
    } catch (err) { console.error(err); alert("Failed to save address. Please try again."); } finally { setSaving(false); }
  };

  const deleteAddress = async (id: string) => {
    await fetch(`/api/addresses?id=${id}`, { method: "DELETE" });
    setAddresses((prev) => prev.filter((a) => a.id !== id));
  };

  const provinces =
    form.country === "CA" ? CANADIAN_PROVINCES : US_STATES;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 sm:mb-8">
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-foreground">
          Saved Addresses
        </h1>
        {addresses.length === 0 && !showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="btn-primary flex items-center justify-center gap-2 w-full sm:w-auto"
          >
            <Plus className="w-4 h-4" />
            Add Address
          </button>
        )}
      </div>

      {/* Add address form */}
      {showForm && (
        <div className="card mb-8">
          <h2 className="text-lg font-semibold text-foreground mb-4">
            {addresses.length > 0 ? "Edit Address" : "Add Address"}
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
                  className={`input ${errors.first_name ? "border-red-500" : ""}`}
                />
                {errors.first_name && <p className="text-xs text-red-600 mt-1">{errors.first_name}</p>}
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
                  className={`input ${errors.last_name ? "border-red-500" : ""}`}
                />
                {errors.last_name && <p className="text-xs text-red-600 mt-1">{errors.last_name}</p>}
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
                className={`input ${errors.address_line1 ? "border-red-500" : ""}`}
                placeholder="Street address"
              />
              {errors.address_line1 && <p className="text-xs text-red-600 mt-1">{errors.address_line1}</p>}
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
                  className={`input ${errors.city ? "border-red-500" : ""}`}
                />
                {errors.city && <p className="text-xs text-red-600 mt-1">{errors.city}</p>}
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
                  className={`input ${errors.province_state ? "border-red-500" : ""}`}
                >
                  <option value="">Select...</option>
                  {provinces.map((p) => (
                    <option key={p.code} value={p.code}>
                      {p.name}
                    </option>
                  ))}
                </select>
                {errors.province_state && <p className="text-xs text-red-600 mt-1">{errors.province_state}</p>}
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
                  className={`input ${errors.postal_code ? "border-red-500" : ""}`}
                  placeholder={
                    form.country === "CA" ? "A1A 1A1" : "12345"
                  }
                />
                {errors.postal_code && <p className="text-xs text-red-600 mt-1">{errors.postal_code}</p>}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Phone 
              </label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) =>
                  setForm({ ...form, phone: e.target.value })
                }
                className={`input ${errors.phone ? "border-red-500" : ""}`}
                placeholder="+1 (555) 123-4567"
              />
              {errors.phone && <p className="text-xs text-red-600 mt-1">{errors.phone}</p>}
            </div>



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
        <div>
          {addresses.slice(0, 1).map((address) => (
            <div
              key={address.id}
              className="card"
            >
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
                <button
                  onClick={() => {
                    setForm({
                      first_name: address.first_name, last_name: address.last_name,
                      address_line1: address.address_line1, address_line2: address.address_line2 || "",
                      city: address.city, province_state: address.province_state, postal_code: address.postal_code,
                      country: address.country as "CA" | "US", phone: address.phone || "", is_default: true,
                    });
                    setShowForm(true);
                  }}
                  className="text-xs text-foreground/50 hover:text-primary flex items-center gap-1 cursor-pointer">
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
