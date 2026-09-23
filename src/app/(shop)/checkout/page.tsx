"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Lock, Loader2, CreditCard, ShoppingBag } from "lucide-react";
import BackButton from "@/components/ui/BackButton";
import { useCart } from "@/components/providers/CartProvider";
import { useAuth } from "@/components/providers/AuthProvider";
import { createClient } from "@/lib/supabase/client";
import {
  formatPrice,
  isValidEmail,
  isValidNorthAmericanPhone,
  isValidShippingPostalCode,
  isValidShippingRegion,
} from "@/lib/utils";
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

interface SavedAddress {
  is_default?: boolean;
  first_name?: string;
  last_name?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  province_state?: string;
  postal_code?: string;
  country?: string;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    paypal?: any;
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

const PAYPAL_CLIENT_ID = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || "";

export default function CheckoutPage() {
  const [checkoutStep, setCheckoutStep] = useState<"shipping" | "payment">("shipping");
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
  const supabase = useRef(createClient()).current;
  const [loading, setLoading] = useState(false);
  const [paymentError, setPaymentError] = useState("");
  const [, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [, setLoadingAddresses] = useState(true);
  const [errors, setErrors] = useState<Partial<Record<keyof ShippingForm, string>>>({});
  const [paymentMethod, setPaymentMethod] = useState<"stripe" | "paypal">("stripe");
  const paypalButtonsRef = useRef<HTMLDivElement>(null);
  const paypalButtonsRendered = useRef(false);
  const [paypalScriptLoaded, setPaypalScriptLoaded] = useState(false);

  useEffect(() => { if (!authLoading && !user) router.push("/auth/login?redirect=/checkout"); }, [user, authLoading, router]);

  useEffect(() => {
    if (user) {
      setForm(prev => ({
        ...prev,
        email: prev.email || user.email || "",
        first_name: prev.first_name || profile?.first_name || "",
        last_name: prev.last_name || profile?.last_name || "",
      }));
      const loadAddresses = async () => {
        setLoadingAddresses(true);
        const res = await fetch("/api/addresses");
        const data = res.ok ? await res.json() : [];
        setSavedAddresses(data || []);
        setLoadingAddresses(false);
        const def = data?.find((a: SavedAddress) => a.is_default) || data?.[0];
        if (def) setForm(prev => ({
          ...prev,
          first_name: prev.first_name || def.first_name || "",
          last_name: prev.last_name || def.last_name || "",
          address_line1: prev.address_line1 || def.address_line1 || "",
          address_line2: prev.address_line2 || def.address_line2 || "",
          city: prev.city || def.city || "",
          province_state: prev.province_state || def.province_state || "",
          postal_code: prev.postal_code || def.postal_code || "",
          country: def.country === "US" ? "US" : def.country === "CA" ? "CA" : prev.country,
        }));
      };
      loadAddresses();
    }
  }, [user, profile, supabase]);

  const [storeSettings, setStoreSettings] = useState({
    free_delivery_threshold: 180,
    delivery_fee_cad: 20,
    delivery_fee_usd: 14.29,
  });

  useEffect(() => {
    fetch("/api/settings").then((r) => r.json()).then((data) => {
      setStoreSettings({
        free_delivery_threshold: Number(data.free_delivery_threshold) || 180,
        delivery_fee_cad: Number(data.delivery_fee_cad) || 20,
        delivery_fee_usd: Number(data.delivery_fee_usd) || 14.29,
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

  const validateForm = (): Partial<Record<keyof ShippingForm, string>> => {
    const newErrors: Partial<Record<keyof ShippingForm, string>> = {};

    if (!form.first_name.trim()) newErrors.first_name = "First name is required";
    if (!form.last_name.trim()) newErrors.last_name = "Last name is required";
    if (!form.email.trim()) newErrors.email = "Email is required";
    else if (!isValidEmail(form.email))
      newErrors.email = "Invalid email address";
    if (!form.address_line1.trim()) newErrors.address_line1 = "Address is required";
    if (!form.city.trim()) newErrors.city = "City is required";
    if (!form.province_state) newErrors.province_state = "Province/State is required";
    else if (!isValidShippingRegion(form.country, form.province_state))
      newErrors.province_state = "Select a valid province or state";
    if (!form.postal_code.trim()) newErrors.postal_code = "Postal/ZIP code is required";
    else if (!isValidShippingPostalCode(form.country, form.postal_code))
      newErrors.postal_code = form.country === "CA" ? "Enter a valid Canadian postal code" : "Enter a valid US ZIP code";
    if (!form.phone.trim()) newErrors.phone = "Phone number is required";
    else if (!isValidNorthAmericanPhone(form.phone)) {
      newErrors.phone = "Enter a valid Canada or United States phone number";
    }

    setErrors(newErrors);
    return newErrors;
  };

  const isFormValid = (errs: Partial<Record<keyof ShippingForm, string>>) =>
    Object.keys(errs).length === 0;

  const buildShippingAddress = useCallback(() => ({
    first_name: form.first_name,
    last_name: form.last_name,
    email: form.email,
    phone: form.phone,
    address_line1: form.address_line1,
    address_line2: form.address_line2,
    city: form.city,
    province_state: form.province_state,
    postal_code: form.postal_code,
  }), [form]);

  const buildItems = useCallback(() =>
    cartItems.map((item) => ({
      productId: item.id,
      quantity: item.quantity,
    })), [cartItems]);

  // ─── Step 1 -> Step 2: Validate shipping and continue to payment ──
  const handleContinueToPayment = () => {
    setPaymentError("");
    const errs = validateForm();
    if (isFormValid(errs)) {
      setCheckoutStep("payment");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      // Scroll to the first field with an error
      const errorFields: (keyof ShippingForm)[] = ["phone", "email", "first_name", "last_name", "address_line1", "city", "province_state", "postal_code"];
      for (const field of errorFields) {
        if (errs[field]) {
          const el = document.getElementById(`checkout-${field}`);
          if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "center" });
            el.focus();
          }
          break;
        }
      }
    }
  };

  // ─── Stripe checkout ─────────────────────────────────────────
  const handleStripeCheckout = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    setPaymentError("");
    try {
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
          items: buildItems(),
          shippingAddress: buildShippingAddress(),
          country: form.country,
          currency,
        }),
      });

      const data = await res.json();

      if (data.success && data.url) {
        window.location.href = data.url;
      } else {
        setPaymentError(data.details ? `${data.error}: ${data.details}` : data.error || "Failed to start checkout. Please try again.");
        setLoading(false);
      }
    } catch {
      setPaymentError("Unable to start checkout. Please check your connection and try again.");
      setLoading(false);
    }
  }, [user, form.country, currency, buildItems, buildShippingAddress, supabase]);

  // ─── PayPal checkout ─────────────────────────────────────────
  const handleCreatePayPalOrder = useCallback(async () => {
    if (!user) throw new Error("not_authenticated");

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token || undefined;

    const res = await fetch("/api/checkout/paypal", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        userId: user.id,
        items: buildItems(),
        shippingAddress: buildShippingAddress(),
        country: form.country,
        currency,
      }),
    });

    const data = await res.json();

    if (!data.success || !data.paypalOrderId) {
      throw new Error(data.details || data.error || "Failed to create PayPal order");
    }

    // Store order info for success page
    sessionStorage.setItem("paypal_order_id", data.paypalOrderId);
    sessionStorage.setItem("paypal_order_number", data.orderNumber);

    return data.paypalOrderId;
  }, [user, form.country, currency, buildItems, buildShippingAddress, supabase]);

  const handlePayPalApprove = useCallback(async (data: { orderID: string }) => {
    const res = await fetch("/api/checkout/paypal/capture", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paypalOrderId: data.orderID }),
    });

    const result = await res.json();

    if (result.success) {
      // Clear session storage items used for PayPal
      sessionStorage.removeItem("paypal_order_id");
      sessionStorage.removeItem("paypal_order_number");

      window.location.href = `/order/success?paypal_order_id=${data.orderID}`;
    } else {
      throw new Error(result.error || "Payment capture failed");
    }
  }, []);

  // Load PayPal SDK when PayPal is selected
  useEffect(() => {
    if (paymentMethod !== "paypal" || !PAYPAL_CLIENT_ID) return;

    if (window.paypal) {
      setPaypalScriptLoaded(true);
      return;
    }

    const script = document.createElement("script");
    script.src = `https://www.paypal.com/sdk/js?client-id=${PAYPAL_CLIENT_ID}&currency=${currency}&intent=capture`;
    script.async = true;
    script.onload = () => {
      setPaypalScriptLoaded(true);
    };
    script.onerror = () => {
      console.error("Failed to load PayPal SDK");
    };
    document.body.appendChild(script);

    return () => {
      // Don't remove the script on unmount — PayPal SDK is global
    };
  }, [paymentMethod, currency]);

  // Render PayPal buttons when SDK is loaded and PayPal is selected
  useEffect(() => {
    if (
      paymentMethod !== "paypal" ||
      !paypalScriptLoaded ||
      !window.paypal ||
      !paypalButtonsRef.current ||
      paypalButtonsRendered.current
    ) {
      return;
    }

    paypalButtonsRendered.current = true;

    window.paypal.Buttons({
      style: {
        layout: "vertical",
        color: "gold",
        shape: "rect",
        label: "pay",
        height: 48,
      },
      createOrder: async () => {
        try {
          setLoading(true);
          setPaymentError("");
          const orderId = await handleCreatePayPalOrder();
          setLoading(false);
          return orderId;
        } catch (err: unknown) {
          setLoading(false);
          console.error("PayPal createOrder error:", err);
          const msg = err instanceof Error ? err.message : "Unknown error";
          setPaymentError("Failed to start PayPal checkout: " + msg);
          throw err;
        }
      },
      onApprove: async (data: { orderID: string }) => {
        try {
          setLoading(true);
          await handlePayPalApprove(data);
        } catch (err) {
          setLoading(false);
          console.error("PayPal capture error:", err);
          setPaymentError(err instanceof Error ? err.message : "Payment failed. Please try again.");
        }
      },
      onError: (err: unknown) => {
        setLoading(false);
        console.error("PayPal SDK error:", err);
        setPaymentError("PayPal could not open. Check your connection and cookies, or choose card payment.");
      },
      onCancel: () => {
        setLoading(false);
      },
    }).render(paypalButtonsRef.current);
  }, [paymentMethod, paypalScriptLoaded, handleCreatePayPalOrder, handlePayPalApprove]);

  // Reset PayPal buttons when payment method changes
  useEffect(() => {
    if (paymentMethod !== "paypal") {
      paypalButtonsRendered.current = false;
      if (paypalButtonsRef.current) {
        paypalButtonsRef.current.innerHTML = "";
      }
    }
  }, [paymentMethod]);

  const updateForm = (field: keyof ShippingForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setPaymentError("");
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  if (authLoading) return (<div className="min-h-[60vh] flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>);
  if (!user) return null;
  if (cartItems.length === 0) return (<div className="max-w-4xl mx-auto px-4 py-16 text-center"><ShoppingBag className="w-16 h-16 text-foreground/20 mx-auto mb-4" /><h1 className="text-2xl font-bold text-foreground mb-2">Your Cart is Empty</h1><p className="text-foreground/60 mb-6">Add some products before checking out.</p><Link href="/shop" className="btn-primary">Start Shopping</Link></div>);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
      <BackButton />
      <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-foreground mb-6 sm:mb-8">Checkout</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Shipping form + Payment */}
        <div className="lg:col-span-2">
          {/* Step indicator */}
          <div className="flex items-center gap-3 mb-6">
            <div className={`flex items-center gap-2 ${checkoutStep === "shipping" ? "text-primary font-semibold" : "text-foreground/50"}`}>
              <span className={`w-7 h-7 rounded-full flex items-center justify-center text-sm ${checkoutStep === "shipping" ? "bg-primary text-white" : "bg-primary/10 text-primary"}`}>1</span>
              <span className="text-sm">Shipping</span>
            </div>
            <div className="flex-1 h-px bg-border" />
            <div className={`flex items-center gap-2 ${checkoutStep === "payment" ? "text-primary font-semibold" : "text-foreground/50"}`}>
              <span className={`w-7 h-7 rounded-full flex items-center justify-center text-sm ${checkoutStep === "payment" ? "bg-primary text-white" : "bg-border text-foreground/40"}`}>2</span>
              <span className="text-sm">Payment</span>
            </div>
          </div>

          {/* ═══ STEP 1: Shipping ═══ */}
          {checkoutStep === "shipping" && (
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
                    onChange={(e) => {
                      updateForm("country", e.target.value);
                      updateForm("province_state", "");
                    }}
                    className="input"
                    required
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
                      id="checkout-first_name"
                      autoComplete="given-name"
                      required
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
                      id="checkout-last_name"
                      autoComplete="family-name"
                      required
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
                    <input
                      type="email"
                      suppressHydrationWarning
                      value={form.email}
                      onChange={(e) => updateForm("email", e.target.value)}
                      className={`input ${errors.email ? "input-error" : ""}`}
                      placeholder="john@example.com"
                      id="checkout-email"
                      autoComplete="email"
                      required
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
                      id="checkout-phone"
                      autoComplete="tel"
                      inputMode="tel"
                      required
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
                      id="checkout-address_line1"
                      autoComplete="address-line1"
                      required
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
                    autoComplete="address-line2"
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
                      id="checkout-city"
                      autoComplete="address-level2"
                      required
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
                      id="checkout-province_state"
                      autoComplete="address-level1"
                      required
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
                      id="checkout-postal_code"
                      autoComplete="postal-code"
                      inputMode={form.country === "CA" ? "text" : "numeric"}
                      required
                    />
                    {errors.postal_code && (
                      <p className="text-xs text-red-600 mt-1">{errors.postal_code}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Continue to Payment button */}
              <button
                type="button"
                onClick={handleContinueToPayment}
                className="btn-primary w-full flex items-center justify-center gap-2 mt-6"
              >
                Continue to Payment
              </button>
            </div>
          )}

          {/* ═══ STEP 2: Payment ═══ */}
          {checkoutStep === "payment" && (
            <>
              {/* Edit Shipping (collapsed summary) */}
              <div className="card mb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-foreground">Shipping to</h3>
                    <p className="text-sm text-foreground/60">
                      {form.first_name} {form.last_name}, {form.address_line1}, {form.city}, {form.province_state} {form.postal_code}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentError("");
                      setCheckoutStep("shipping");
                    }}
                    className="text-sm text-primary hover:underline font-medium"
                  >
                    Edit
                  </button>
                </div>
              </div>

              {/* Payment Method Selection */}
              <div className="card mb-6">
              <h2 className="text-lg font-semibold text-foreground mb-6">
                Payment Method
              </h2>

              <div className="space-y-3">
              {paymentError && (
                <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {paymentError}
                </div>
              )}

                {/* Stripe option */}
                <label
                  className={`flex items-center gap-3 p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                    paymentMethod === "stripe"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-foreground/20"
                  }`}
                >
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="stripe"
                    checked={paymentMethod === "stripe"}
                    onChange={() => setPaymentMethod("stripe")}
                    disabled={loading}
                    className="w-4 h-4 text-primary"
                  />
                  <CreditCard className="w-5 h-5 text-foreground/60" />
                  <div>
                    <p className="font-medium text-foreground">Credit / Debit Card</p>
                    <p className="text-xs text-foreground/50">Pay securely with Stripe</p>
                  </div>
                </label>

                {/* PayPal option */}
                <label
                  className={`flex items-center gap-3 p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                    paymentMethod === "paypal"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-foreground/20"
                  }`}
                >
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="paypal"
                    checked={paymentMethod === "paypal"}
                    onChange={() => setPaymentMethod("paypal")}
                    disabled={loading}
                    className="w-4 h-4 text-primary"
                  />
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
                    <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944 2.471a.77.77 0 0 1 .757-.642h6.317c2.094 0 3.578.522 4.406 1.55.381.475.628.993.735 1.539.113.565.052 1.234-.18 1.995l-.012.04v.024c-.48 1.917-1.587 3.446-3.297 4.524-.86.544-1.86.845-2.973.891H8.78a.77.77 0 0 0-.759.644l-.008.052-.382 2.418-.096.61a.641.641 0 0 1-.464.422z" fill="#253B80"/>
                    <path d="M19.868 7.162c-.023.152-.05.305-.08.458l-1.617 10.237-.07.39c-.008.044-.03.082-.064.107a.14.14 0 0 1-.09.036H12.83a.77.77 0 0 0-.76.643l-.005.052-.644 4.084-.027.174a.641.641 0 0 0 .631.742h4.606a.77.77 0 0 0 .758-.644l2.58-16.358a.462.462 0 0 0-.047-.378.463.463 0 0 0-.378-.145z" fill="#179BD7"/>
                    <path d="M8.942 7.584a.77.77 0 0 0-.758-.644H3.595a.64.64 0 0 0-.631.526L.05 19.065a.14.14 0 0 0 .138.17h4.437l1.393-8.815.024-.153a.77.77 0 0 1 .759-.644h2.334c1.858 0 3.282-.377 4.124-1.262.45-.47.758-1.08.908-1.793.145-.692.108-1.345-.104-1.884a2.41 2.41 0 0 0-.713-.905 3.66 3.66 0 0 0-1.123-.569 6.65 6.65 0 0 0-1.335-.194H8.942z" fill="#253B80"/>
                  </svg>
                  <div>
                    <p className="font-medium text-foreground">PayPal</p>
                    <p className="text-xs text-foreground/50">Pay with your PayPal account</p>
                  </div>
                </label>
              </div>

              {/* Stripe: Place Order button (mobile) */}
              {checkoutStep === "payment" && paymentMethod === "stripe" && (
                <button
                  type="button"
                  onClick={handleStripeCheckout}
                  disabled={loading}
                  className="lg:hidden btn-primary w-full flex items-center justify-center gap-2 mt-6"
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
              )}

              {/* PayPal: render buttons */}
              {paymentMethod === "paypal" && (
                <div className="mt-6">
                  {!paypalScriptLoaded && (
                    <div className="flex items-center justify-center gap-2 py-4 text-foreground/50 text-sm">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Loading PayPal...
                    </div>
                  )}
                  <div className={loading ? "pointer-events-none opacity-60" : ""} ref={paypalButtonsRef} />
                </div>
              )}
            </div>
            </>
          )}
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

            {/* Stripe: Place order button (desktop) */}
            {checkoutStep === "payment" && paymentMethod === "stripe" && (
              <button
                onClick={handleStripeCheckout}
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
            )}

            {/* Trust badges */}
            <div className="mt-6 pt-4 border-t border-border space-y-2">
              <div className="flex items-center gap-2 text-xs text-foreground/50">
                <Lock className="w-4 h-4" />
                <span>SSL Encrypted Checkout</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-foreground/50">
                <CreditCard className="w-4 h-4" />
                <span>Secure Payment via Stripe &amp; PayPal</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
