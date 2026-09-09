"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Lock, Loader2, CreditCard, ShoppingBag } from "lucide-react";
import { useCart } from "@/components/providers/CartProvider";
import { useAuth } from "@/components/providers/AuthProvider";
import { createClient } from "@/lib/supabase/client";
import { formatPrice } from "@/lib/utils";
import { CANADIAN_PROVINCES, US_STATES } from "@/lib/constants";

interface ShippingForm {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  country: "CA" | "US";
  address_line1: string;
  address_line2: string;
  city: string;
  province_state: string;
  postal_code: string;
}

export default function CheckoutPage() {
  const [form, setForm] = useState<ShippingForm>({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    country: "CA",
    address_line1: "",
    address_line2: "",
    city: "",
    province_state: "",
    postal_code: "",
  });
  const router = useRouter();
  const { user, profile, loading: authLoading } = useAuth();
  const { items: cartItems } = useCart();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [savedAddresses, setSavedAddresses] = useState<any[]>([]);
  const [loadingAddresses, setLoadingAddresses] = useState(true);
  const [errors, setErrors] = useState<Partial<Record<keyof ShippingForm, string>>>({});

  useEffect(() => { if (!authLoading && !user) router.push("/auth/login?redirect=/checkout"); }, [user, authLoading, router]);

  useEffect(() => {
    if (user) {
      setForm(prev => ({ ...prev, email: user.email || "", first_name: profile?.first_name || "", last_name: profile?.last_name || "" }));
      const loadAddresses = async () => {
        setLoadingAddresses(true);
        const res = await fetch("/api/addresses");
        const data = res.ok ? await res.json() : [];
        setSavedAddresses(data || []);
        setLoadingAddresses(false);
        const def = data?.find((a: any) => a.is_default) || data?.[0];
        if (def) setForm(prev => ({ ...prev, first_name: def.first_name || prev.first_name, last_name: def.last_name || prev.last_name, address_line1: def.address_line1 || "", address_line2: def.address_line2 || "", city: def.city || "", province_state: def.province_state || "", postal_code: def.postal_code || "", country: def.country || "CA" }));
      };
      loadAddresses();
    }
  }, [user, profile, supabase]);

  const [storeSettings, setStoreSettings] = useState({
    free_delivery_threshold: 180,
    delivery_fee_cad: 9.99,
    delivery_fee_usd: 7.99,
  });

  useEffect(() => {
    fetch("/api/settings").then((r) => r.json()).then((data) => {
      setStoreSettings({
        free_delivery_threshold: Number(data.free_delivery_threshold) || 180,
        delivery_fee_cad: Number(data.delivery_fee_cad) || 9.99,
        delivery_fee_usd: Number(data.delivery_fee_usd) || 7.99,
      });
    }).catch(() => {});
  }, []);

  const currency = form.country === "CA" ? "CAD" : "USD";
  const priceKey = currency === "CAD" ? "price_cad" : "price_usd";

  const subtotal = cartItems.reduce(
    (sum, item) => sum + item[priceKey] * item.quantity,
    0
  );
  const deliveryFee = subtotal >= storeSettings.free_delivery_threshold
    ? 0
    : currency === "CAD"
      ? storeSettings.delivery_fee_cad
      : storeSettings.delivery_fee_usd;
  const total = subtotal + deliveryFee;

  const provinces = form.country === "CA" ? CANADIAN_PROVINCES : US_STATES;

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof ShippingForm, string>> = {};

    if (!form.first_name.trim()) newErrors.first_name = "First name is required";
    if (!form.last_name.trim()) newErrors.last_name = "Last name is required";
    if (!form.email.trim()) newErrors.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      newErrors.email = "Invalid email address";
    if (!form.address_line1.trim()) newErrors.address_line1 = "Address is required";
    if (!form.city.trim()) newErrors.city = "City is required";
    if (!form.province_state) newErrors.province_state = "Province/State is required";
    if (!form.postal_code.trim()) newErrors.postal_code = "Postal/ZIP code is required";
    if (!form.phone.trim()) newErrors.phone = "Phone number is required";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    if (!user) return;

    setLoading(true);
    try {
      const shippingAddress = {
        first_name: form.first_name,
        last_name: form.last_name,
        email: form.email,
        phone: form.phone,
        address_line1: form.address_line1,
        address_line2: form.address_line2,
        city: form.city,
        province_state: form.province_state,
        postal_code: form.postal_code,
      };

      const items = cartItems.map((item) => ({
        productId: item.id,
        quantity: item.quantity,
      }));

      // Get the user's session token for auth header
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token || undefined;

      const res = await fetch("/api/checkout/stripe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          userId: user.id,
          items,
          shippingAddress,
          country: form.country,
          currency,
        }),
      });

      const data = await res.json();

      if (data.success && data.url) {
        // Redirect to Stripe Checkout
        window.location.href = data.url;
      } else {
        alert(data.error || "Failed to start checkout. Please try again.");
        setLoading(false);
      }
    } catch {
      alert("An error occurred. Please try again.");
      setLoading(false);
    }
  };

  const updateForm = (field: keyof ShippingForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  if (authLoading) return (<div className="min-h-[60vh] flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>);
  if (!user) return null;
  if (cartItems.length === 0) return (<div className="max-w-4xl mx-auto px-4 py-16 text-center"><ShoppingBag className="w-16 h-16 text-foreground/20 mx-auto mb-4" /><h1 className="text-2xl font-bold text-foreground mb-2">Your Cart is Empty</h1><p className="text-foreground/60 mb-6">Add some products before checking out.</p><Link href="/shop" className="btn-primary">Start Shopping</Link></div>);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
      <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-foreground mb-6 sm:mb-8">Checkout</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Shipping form */}
        <div className="lg:col-span-2">
          <form onSubmit={handleSubmit}>
            <div className="card mb-6">
              <h2 className="text-lg font-semibold text-foreground mb-6">
                Shipping Information
              </h2>

              <div className="space-y-4">
                {/* Country */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Country *
                  </label>
                  <select
                    value={form.country}
                    onChange={(e) =>
                      updateForm("country", e.target.value)
                    }
                    className="input"
                  >
                    <option value="CA">Canada</option>
                    <option value="US">United States</option>
                  </select>
                </div>

                {/* Name */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      First Name *
                    </label>
                    <input
                      type="text"
                      value={form.first_name}
                      onChange={(e) => updateForm("first_name", e.target.value)}
                      className={`input ${errors.first_name ? "input-error" : ""}`}
                      placeholder="John"
                    />
                    {errors.first_name && (
                      <p className="text-xs text-red-600 mt-1">{errors.first_name}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Last Name *
                    </label>
                    <input
                      type="text"
                      value={form.last_name}
                      onChange={(e) => updateForm("last_name", e.target.value)}
                      className={`input ${errors.last_name ? "input-error" : ""}`}
                      placeholder="Doe"
                    />
                    {errors.last_name && (
                      <p className="text-xs text-red-600 mt-1">{errors.last_name}</p>
                    )}
                  </div>
                </div>

                {/* Email + Phone */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Email *
                    </label>
                    <input                       type="email"
                       suppressHydrationWarning
                      value={form.email}
                      onChange={(e) => updateForm("email", e.target.value)}
                      className={`input ${errors.email ? "input-error" : ""}`}
                      placeholder="john@example.com"
                    />
                    {errors.email && (
                      <p className="text-xs text-red-600 mt-1">{errors.email}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Phone *
                    </label>
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={(e) => updateForm("phone", e.target.value)}
                      className={`input ${errors.phone ? "border-red-500" : ""}`}
                      placeholder="+1 (555) 123-4567"
                    />
                    {errors.phone && <p className="text-xs text-red-600 mt-1">{errors.phone}</p>}
                  </div>
                </div>

                {/* Address */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Street Address *
                  </label>
                  <input
                    type="text"
                    value={form.address_line1}
                    onChange={(e) => updateForm("address_line1", e.target.value)}
                    className={`input ${errors.address_line1 ? "input-error" : ""}`}
                    placeholder="123 Main Street"
                  />
                  {errors.address_line1 && (
                    <p className="text-xs text-red-600 mt-1">{errors.address_line1}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Apartment, Suite, Unit (Optional)
                  </label>
                  <input
                    type="text"
                    value={form.address_line2}
                    onChange={(e) => updateForm("address_line2", e.target.value)}
                    className="input"
                    placeholder="Apt 4B"
                  />
                </div>

                {/* City, Province, Postal */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      City *
                    </label>
                    <input
                      type="text"
                      value={form.city}
                      onChange={(e) => updateForm("city", e.target.value)}
                      className={`input ${errors.city ? "input-error" : ""}`}
                      placeholder="Toronto"
                    />
                    {errors.city && (
                      <p className="text-xs text-red-600 mt-1">{errors.city}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Province/State *
                    </label>
                    <select
                      value={form.province_state}
                      onChange={(e) => updateForm("province_state", e.target.value)}
                      className={`input ${errors.province_state ? "input-error" : ""}`}
                    >
                      <option value="">Select...</option>
                      {provinces.map((p) => (
                        <option key={p.code} value={p.code}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                    {errors.province_state && (
                      <p className="text-xs text-red-600 mt-1">{errors.province_state}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      {form.country === "CA" ? "Postal Code *" : "ZIP Code *"}
                    </label>
                    <input
                      type="text"
                      value={form.postal_code}
                      onChange={(e) => updateForm("postal_code", e.target.value)}
                      className={`input ${errors.postal_code ? "input-error" : ""}`}
                      placeholder={form.country === "CA" ? "A1A 1A1" : "12345"}
                    />
                    {errors.postal_code && (
                      <p className="text-xs text-red-600 mt-1">{errors.postal_code}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Place order button - mobile */}
            <button
              type="submit"
              disabled={loading}
              className="lg:hidden btn-primary w-full flex items-center justify-center gap-2 mb-6"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Lock className="w-5 h-5" />
                  Place Order - {formatPrice(total, currency)}
                </>
              )}
            </button>
          </form>
        </div>

        {/* Order summary */}
        <div className="lg:col-span-1">
          <div className="card sticky top-24">
            <h2 className="text-lg font-semibold text-foreground mb-4">
              Order Summary
            </h2>

            {/* Items */}
            <div className="space-y-3 mb-4">
              {cartItems.map((item) => (
                <div key={item.id} className="flex justify-between text-sm">
                  <div className="flex-1">
                    <p className="text-foreground">{item.name}</p>
                    <p className="text-foreground/50">Qty: {item.quantity}</p>
                  </div>
                  <span className="font-medium">
                    {formatPrice(item[priceKey] * item.quantity, currency)}
                  </span>
                </div>
              ))}
            </div>

            <div className="border-t border-border pt-4 space-y-2 mb-4">
              <div className="flex justify-between text-sm">
                <span className="text-foreground/60">Subtotal</span>
                <span>{formatPrice(subtotal, currency)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-foreground/60">Delivery</span>
                <span
                  className={
                    deliveryFee === 0
                      ? "text-green-600 font-medium"
                      : ""
                  }
                >
                  {deliveryFee === 0
                    ? "FREE"
                    : formatPrice(deliveryFee, currency)}
                </span>
              </div>
              {deliveryFee > 0 && (
                <p className="text-xs text-foreground/50">
                  Free delivery on orders over{" "}
                  {formatPrice(storeSettings.free_delivery_threshold, currency)}
                </p>
              )}
            </div>

            <div className="border-t border-border pt-4 mb-6">
              <div className="flex justify-between">
                <span className="font-semibold text-foreground">Total</span>
                <span className="text-xl font-bold text-primary">
                  {formatPrice(total, currency)}
                </span>
              </div>
            </div>

            {/* Place order button - desktop */}
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="hidden lg:flex btn-primary w-full items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Lock className="w-5 h-5" />
                  Place Order
                </>
              )}
            </button>

            {/* Trust badges */}
            <div className="mt-6 pt-4 border-t border-border space-y-2">
              <div className="flex items-center gap-2 text-xs text-foreground/50">
                <Lock className="w-4 h-4" />
                <span>SSL Encrypted Checkout</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-foreground/50">
                <CreditCard className="w-4 h-4" />
                <span>Secure Payment via Stripe</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
