"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Lock, Loader2, CreditCard, ShoppingBag, RefreshCw, ChevronDown } from "lucide-react";
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
  provincePostalMismatch,
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
  // Two steps only: 1 Shipping (delivery method + its detail form) → 2 Payment.
  const [checkoutStep, setCheckoutStep] = useState<"shipping" | "payment">("shipping");
  // Mobile: order summary lives in a collapsed drawer; the Total stays
  // visible in the step header above it at all times.
  const [summaryOpen, setSummaryOpen] = useState(false);
  // Delivery method: Canada Post shipping (default) or free in-store pickup.
  const [fulfillmentMethod, setFulfillmentMethod] = useState<"shipping" | "store_pickup">("shipping");
  // The detail form (shipping address or pickup contact) stays tucked away
  // until a delivery method is picked and the shopper asks to enter details.
  const [detailsOpen, setDetailsOpen] = useState(false);
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
  const { user, profile } = useAuth();
  const { items: cartItems } = useCart();
  const supabase = useRef(createClient()).current;
  const [loading, setLoading] = useState(false);
  const [paymentError, setPaymentError] = useState("");
  const [, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [, setLoadingAddresses] = useState(true);
  const [errors, setErrors] = useState<Partial<Record<keyof ShippingForm, string>>>({});
  const [paymentMethod, setPaymentMethod] = useState<"stripe" | "paypal">("stripe");
  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discount: number } | null>(null);
  const [couponMessage, setCouponMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [couponChecking, setCouponChecking] = useState(false);
  const [autoApplied, setAutoApplied] = useState(false);
  const paypalButtonsRef = useRef<HTMLDivElement>(null);
  const paypalButtonsRendered = useRef(false);
  const [paypalScriptLoaded, setPaypalScriptLoaded] = useState(false);
  const [paypalError, setPaypalError] = useState<string | null>(null);
  const [paypalRetry, setPaypalRetry] = useState(0);

  // Canada Post live rates (fetched when the shipping address is confirmed)
  interface ShippingRate {
    serviceCode: string;
    serviceName: string;
    price: number;
    transitDays: number | null;
  }
  const [shippingRates, setShippingRates] = useState<ShippingRate[]>([]);
  const [ratesLoading, setRatesLoading] = useState(false);
  const [ratesError, setRatesError] = useState("");
  const [selectedRate, setSelectedRate] = useState<ShippingRate | null>(null);

  // Guest checkout: no login wall. Signed-in users get their profile info
  // pre-filled below; guests simply fill in the form themselves.

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
    // Optional pickup-store configuration. Left blank until the client
    // supplies the real store details; the UI falls back to generic copy.
    pickup_location: "",
    pickup_address: "",
    pickup_preparation_minutes: "",
  });

  useEffect(() => {
    fetch("/api/settings").then((r) => r.json()).then((data) => {
      setStoreSettings({
        free_delivery_threshold: Number(data.free_delivery_threshold) || 180,
        delivery_fee_cad: Number(data.delivery_fee_cad) || 20,
        delivery_fee_usd: Number(data.delivery_fee_usd) || 14.29,
        pickup_location: typeof data.pickup_location === "string" ? data.pickup_location : "",
        pickup_address: typeof data.pickup_address === "string" ? data.pickup_address : "",
        pickup_preparation_minutes: data.pickup_preparation_minutes != null ? String(data.pickup_preparation_minutes) : "",
      });
    }).catch(() => {});
  }, []);

  const currency = form.country === "CA" ? "CAD" : "USD";
  const priceKey = currency === "CAD" ? "price_cad" : "price_usd";

  const subtotal = cartItems.reduce(
    (sum, item) => sum + item[priceKey] * item.quantity,
    0
  );
  // Pickup is always free; shipping uses the selected live Canada Post rate.
  const deliveryFee = fulfillmentMethod === "store_pickup" ? 0 : (selectedRate?.price ?? 0);
  const discount = appliedCoupon?.discount || 0;
  const payableSubtotal = Math.max(0, subtotal - discount);
  const total = payableSubtotal + deliveryFee;

  const applyCoupon = async () => {
    const code = couponInput.trim();
    if (!code) return;
    setCouponChecking(true);
    setCouponMessage(null);
    try {
      // Send the session token so first-order coupons can verify the
      // caller's account (history, welcome-coupon window) server-side.
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const res = await fetch("/api/coupons/validate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token
            ? { Authorization: `Bearer ${session.access_token}` }
            : {}),
        },
        body: JSON.stringify({ code, currency, subtotal }),
      });
      const data = await res.json();
      if (data.valid) {
        setAppliedCoupon({ code: data.code, discount: data.discount });
        setCouponMessage({ type: "success", text: `Coupon ${data.code} applied` });
        setCouponInput("");
      } else {
        setAppliedCoupon(null);
        setCouponMessage({ type: "error", text: data.error || "Invalid coupon code" });
      }
    } catch {
      setCouponMessage({ type: "error", text: "Could not validate coupon. Try again." });
    } finally {
      setCouponChecking(false);
    }
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCouponMessage(null);
    setAutoApplied(false);
  };

  // Auto-apply the welcome (first-order) coupon for eligible signed-in
  // customers. Runs once per session; never overrides a manual coupon.
  useEffect(() => {
    if (autoApplied || appliedCoupon || !user || cartItems.length === 0) return;
    let cancelled = false;
    (async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;
        if (!token) return;
        const res = await fetch(
          `/api/coupons/auto?currency=${currency}&subtotal=${encodeURIComponent(subtotal)}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const data = await res.json();
        if (!cancelled && data?.available) {
          setAppliedCoupon({ code: data.code, discount: data.discount });
          setAutoApplied(true);
          setCouponMessage({ type: "success", text: "🎉 First-order discount applied!" });
        }
      } catch {
        // Auto-apply is best-effort — never blocks checkout.
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, cartItems.length, appliedCoupon, autoApplied, currency, subtotal]);

  const provinces = form.country === "CA" ? CANADIAN_PROVINCES : US_STATES;

  const validateForm = (): Partial<Record<keyof ShippingForm, string>> => {
    const newErrors: Partial<Record<keyof ShippingForm, string>> = {};

    if (!form.first_name.trim()) newErrors.first_name = "First name is required";
    if (!form.last_name.trim()) newErrors.last_name = "Last name is required";
    if (!form.email.trim()) newErrors.email = "Email is required";
    else if (!isValidEmail(form.email))
      newErrors.email = "Invalid email address";

    // In-store pickup needs only a name and email - no delivery address,
    // province, postal code or phone (the store already knows where it is).
    if (fulfillmentMethod === "shipping") {
      if (!form.address_line1.trim()) newErrors.address_line1 = "Address is required";
      if (!form.city.trim()) newErrors.city = "City is required";
      if (!form.province_state) newErrors.province_state = "Province/State is required";
      else if (!isValidShippingRegion(form.country, form.province_state))
        newErrors.province_state = "Select a valid province or state";
      if (!form.postal_code.trim()) newErrors.postal_code = "Postal/ZIP code is required";
      else if (!isValidShippingPostalCode(form.country, form.postal_code))
        newErrors.postal_code = form.country === "CA" ? "Enter a valid Canadian postal code" : "Enter a valid US ZIP code";
      else if (form.province_state) {
        const mismatch = provincePostalMismatch(form.country, form.province_state, form.postal_code);
        if (mismatch) newErrors.postal_code = mismatch;
      }
      if (!form.phone.trim()) newErrors.phone = "Phone number is required";
      else if (!isValidNorthAmericanPhone(form.phone)) {
        newErrors.phone = "Enter a valid Canada or United States phone number";
      }
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

  // ─── Step 1 -> Step 2: Validate, then fetch live Canada Post rates ──
  const handleContinueToPayment = async () => {
    setPaymentError("");
    const errs = validateForm();
    if (!isFormValid(errs)) {
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
      return;
    }

    // In-store pickup: no Canada Post involvement at all - go straight to
    // payment. Pickup is free and fulfilled manually from the store.
    if (fulfillmentMethod === "store_pickup") {
      setRatesError("");
      setSelectedRate(null);
      setCheckoutStep("payment");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    // Fetch live Canada Post rates for this address. No flat-rate fallback:
    // if rates fail we stay on step 1 and show a retryable error.
    setRatesLoading(true);
    setRatesError("");
    try {
      const res = await fetch("/api/shipping/rates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          country: form.country,
          postalCode: form.postal_code,
          items: buildItems(),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setRatesError(data.error || "Could not load shipping options. Please try again.");
        return;
      }
      const rates: ShippingRate[] = data.rates || [];
      if (rates.length === 0) {
        setRatesError("No shipping options are available for this address. Please double-check your postal code.");
        return;
      }
      const prev = selectedRate ? rates.find((r) => r.serviceCode === selectedRate.serviceCode) : null;
      setShippingRates(rates);
      setSelectedRate(prev || rates.reduce((a, b) => (a.price <= b.price ? a : b)));
      setCheckoutStep("payment");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setRatesError("Could not load shipping options. Please check your connection and try again.");
    } finally {
      setRatesLoading(false);
    }
  };

  // ─── Stripe checkout ─────────────────────────────────────────
  const handleStripeCheckout = useCallback(async () => {
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
          userId: user?.id,
          items: buildItems(),
          shippingAddress: buildShippingAddress(),
          country: form.country,
          currency,
          couponCode: appliedCoupon?.code || null,
          fulfillmentMethod,
          // Pickup-store snapshot (server validates and stores it on the order).
          pickupStoreId: null,
          pickupStoreName: storeSettings.pickup_location || null,
          pickupAddressLine1: storeSettings.pickup_address ? storeSettings.pickup_address.split("\n")[0] : null,
          pickupAddressLine2: storeSettings.pickup_address ? storeSettings.pickup_address.split("\n")[1] || null : null,
          pickupCity: null,
          pickupStateProvince: null,
          pickupPostalCode: null,
          pickupCountry: "CA",
          pickupPhone: null,
          pickupPreparationTime: storeSettings.pickup_preparation_minutes
            ? `${storeSettings.pickup_preparation_minutes} minutes`
            : null,
          shippingMethod: selectedRate ? { code: selectedRate.serviceCode, name: selectedRate.serviceName } : null,
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
  }, [user, form.country, currency, appliedCoupon, fulfillmentMethod, storeSettings, buildItems, buildShippingAddress, selectedRate, supabase]);

  // ─── PayPal checkout ─────────────────────────────────────────
  const handleCreatePayPalOrder = useCallback(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token || undefined;

    const res = await fetch("/api/checkout/paypal", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        userId: user?.id,
        items: buildItems(),
        shippingAddress: buildShippingAddress(),
        country: form.country,
        currency,
        couponCode: appliedCoupon?.code || null,
        fulfillmentMethod,
        // Pickup-store snapshot (server validates and stores it on the order).
        pickupStoreId: null,
        pickupStoreName: storeSettings.pickup_location || null,
        pickupAddressLine1: storeSettings.pickup_address ? storeSettings.pickup_address.split("\n")[0] : null,
        pickupAddressLine2: storeSettings.pickup_address ? storeSettings.pickup_address.split("\n")[1] || null : null,
        pickupCity: null,
        pickupStateProvince: null,
        pickupPostalCode: null,
        pickupCountry: "CA",
        pickupPhone: null,
        pickupPreparationTime: storeSettings.pickup_preparation_minutes
          ? `${storeSettings.pickup_preparation_minutes} minutes`
          : null,
        shippingMethod: selectedRate ? { code: selectedRate.serviceCode, name: selectedRate.serviceName } : null,
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
  }, [user, form.country, currency, appliedCoupon, fulfillmentMethod, storeSettings, buildItems, buildShippingAddress, selectedRate, supabase]);

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

  // Load PayPal SDK when PayPal is selected.
  // Failures (missing client id, blocked script, network filter) surface as a
  // visible error with a retry button instead of an endless spinner.
  useEffect(() => {
    if (paymentMethod !== "paypal") return;

    if (!PAYPAL_CLIENT_ID) {
      setPaypalError(
        "PayPal is not configured for this store (NEXT_PUBLIC_PAYPAL_CLIENT_ID is missing). " +
          "Add it and restart the dev server, or pay by card."
      );
      return;
    }

    if (window.paypal) {
      setPaypalScriptLoaded(true);
      setPaypalError(null);
      return;
    }

    setPaypalError(null);
    setPaypalScriptLoaded(false);

    // Reuse an in-flight/cached tag (React strict mode mounts effects twice);
    // on an explicit retry, drop the failed tag and start a fresh request.
    const SCRIPT_ID = "paypal-sdk-script";
    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (existing && paypalRetry > 0) existing.remove();
    const reusable = existing && paypalRetry === 0 ? existing : null;

    const script = reusable ?? document.createElement("script");
    let settled = false;

    const succeed = () => {
      if (settled) return;
      if (window.paypal) {
        settled = true;
        setPaypalError(null);
        setPaypalScriptLoaded(true);
      } else {
        // Script responded but the SDK global never appeared.
        settled = true;
        setPaypalError("PayPal loaded but did not initialise. Refresh the page and try again.");
      }
    };

    const fail = () => {
      if (settled) return;
      settled = true;
      console.error("Failed to load PayPal SDK:", script.src || "(reused tag)");
      setPaypalError(
        "Could not reach PayPal. An ad/script blocker or network filter may be blocking paypal.com — " +
          "allow it for this site and retry, or pay by card."
      );
    };

    script.addEventListener("load", succeed);
    script.addEventListener("error", fail);

    if (!reusable) {
      script.id = SCRIPT_ID;
      script.src =
        `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(PAYPAL_CLIENT_ID)}` +
        `&currency=${currency}&intent=capture&components=buttons`;
      script.async = true;
      document.body.appendChild(script);
    }

    // Safety net: never leave the buyer staring at a spinner.
    const timeout = window.setTimeout(() => {
      if (window.paypal) succeed();
      else fail();
    }, 12_000);

    return () => {
      settled = true;
      window.clearTimeout(timeout);
    };
  }, [paymentMethod, currency, paypalRetry]);

  // Render PayPal buttons when SDK is loaded and PayPal is selected.
  // Rebuild the button instance whenever the coupon or total changes so the
  // latest discount is included in the PayPal order that gets created.
  useEffect(() => {
    if (paymentMethod !== "paypal") {
      paypalButtonsRendered.current = false;
      if (paypalButtonsRef.current) {
        paypalButtonsRef.current.innerHTML = "";
      }
      return;
    }

    if (!paypalScriptLoaded || !window.paypal || !paypalButtonsRef.current) {
      return;
    }

    if (paypalError) {
      // SDK reported a failure — don't attempt to render buttons.
      return;
    }

    if (paypalButtonsRendered.current) {
      paypalButtonsRef.current.innerHTML = "";
      paypalButtonsRendered.current = false;
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
  }, [paymentMethod, paypalScriptLoaded, handleCreatePayPalOrder, handlePayPalApprove, appliedCoupon?.code, total, paypalError]);

  const updateForm = (field: keyof ShippingForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setPaymentError("");
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  // Guests and signed-in users both proceed — no auth gate.
  if (cartItems.length === 0) return (<div className="max-w-4xl mx-auto px-4 py-16 text-center"><ShoppingBag className="w-16 h-16 text-foreground/20 mx-auto mb-4" /><h1 className="text-2xl font-bold text-foreground mb-2">Your Cart is Empty</h1><p className="text-foreground/60 mb-6">Add some products before checking out.</p><Link href="/shop" className="btn-primary">Start Shopping</Link></div>);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
      <BackButton href="/cart" label="Back to cart" />
      <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-foreground mb-6 sm:mb-8">Checkout</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Shipping form + Payment */}
        <div className="lg:col-span-2">
          {/* Step indicator — the running Total stays pinned in this header at all times */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mb-6">
            <div className={`flex items-center gap-2 ${checkoutStep === "shipping" ? "text-primary font-semibold" : "text-foreground/50"}`}>
              <span className={`w-7 h-7 rounded-full flex items-center justify-center text-sm ${checkoutStep === "shipping" ? "bg-primary text-white" : "bg-primary/10 text-primary"}`}>1</span>
              <span className="text-xs sm:text-sm">Shipping</span>
            </div>
            <div className="flex-1 min-w-4 h-px bg-border" />
            <div className={`flex items-center gap-2 ${checkoutStep === "payment" ? "text-primary font-semibold" : "text-foreground/50"}`}>
              <span className={`w-7 h-7 rounded-full flex items-center justify-center text-sm ${checkoutStep === "payment" ? "bg-primary text-white" : "bg-border text-foreground/40"}`}>2</span>
              <span className="text-xs sm:text-sm">Payment</span>
            </div>
            <div className="ml-auto flex items-baseline gap-1.5 border-l border-border pl-3">
              <span className="text-xs text-foreground/50">Total</span>
              <span className="text-sm sm:text-base font-bold text-primary">{formatPrice(total, currency)}</span>
            </div>
          </div>

          {/* ═══ STEP 1: Shipping — Card 1 chooses the delivery method ═══
              Once the shopper enters their details, the method picker collapses
              away (the form's "← Change delivery method" link brings it back). */}
          {checkoutStep === "shipping" && !detailsOpen && (
            <>
            {/* Card 1 — Delivery Method */}
            <div className="card mb-4">
              <h2 className="text-lg font-semibold text-foreground mb-4">
                Delivery Method
              </h2>
              <div className="space-y-3">
                <label
                  className={`flex items-start gap-3 p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                    fulfillmentMethod === "shipping"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-foreground/20"
                  }`}
                >
                  <input
                    type="radio"
                    name="fulfillmentMethod"
                    value="shipping"
                    checked={fulfillmentMethod === "shipping"}
                    onChange={() => {
                      setFulfillmentMethod("shipping");
                      setPaymentError("");
                    }}
                    className="w-4 h-4 mt-0.5 accent-[var(--primary)]"
                  />
                  <span className="flex-1">
                    <span className="block font-medium text-foreground">Ship to my address</span>
                    <span className="block text-xs text-foreground/50 mt-0.5">
                      Delivered by Canada Post — live rates calculated for your address at checkout.
                    </span>
                  </span>
                </label>
                <label
                  className={`flex items-start gap-3 p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                    fulfillmentMethod === "store_pickup"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-foreground/20"
                  }`}
                >
                  <input
                    type="radio"
                    name="fulfillmentMethod"
                    value="store_pickup"
                    checked={fulfillmentMethod === "store_pickup"}
                    onChange={() => {
                      setFulfillmentMethod("store_pickup");
                      setPaymentError("");
                    }}
                    className="w-4 h-4 mt-0.5 accent-[var(--primary)]"
                  />
                  <span className="flex-1">
                    <span className="block font-medium text-foreground">
                      Pick up in store{" "}
                      <span className="ml-1 inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700 align-middle">FREE</span>
                    </span>
                    <span className="block text-xs text-foreground/50 mt-0.5">
                      Pay online, then collect your order at the store when it's ready — no shipping fee.
                    </span>
                  </span>
                </label>
              </div>

              {fulfillmentMethod === "store_pickup" && (
                <div className="mt-4 rounded-lg bg-muted/60 border border-border px-4 py-3 text-sm">
                  <p className="font-medium text-foreground">
                    {storeSettings.pickup_location || "Arade store pickup"}
                  </p>
                  {storeSettings.pickup_address && (
                    <p className="text-foreground/60 whitespace-pre-line mt-1">{storeSettings.pickup_address}</p>
                  )}
                  <p className="text-foreground/60 mt-1">
                    {storeSettings.pickup_preparation_minutes
                      ? `Ready in approximately ${storeSettings.pickup_preparation_minutes} minutes after payment.`
                      : "We'll email you when your order is ready for pickup."}
                  </p>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                setPaymentError("");
                setDetailsOpen(true);
                requestAnimationFrame(() => {
                  document
                    .getElementById("checkout-details")
                    ?.scrollIntoView({ behavior: "smooth", block: "start" });
                });
              }}
              className="btn-primary w-full"
            >
              Enter {fulfillmentMethod === "store_pickup" ? "pickup details" : "shipping details"}
            </button>
            </>
          )}

          {/* ═══ STEP 1 (cont.): Shipping / Contact Information form ═══ */}
          {checkoutStep === "shipping" && detailsOpen && (
            <>
            <button
              type="button"
              onClick={() => setDetailsOpen(false)}
              className="text-sm text-primary hover:underline font-medium mb-3"
            >
              ← Change delivery method
            </button>

            <div id="checkout-details" className="card mb-6 scroll-mt-24">
              <h2 className="text-lg font-semibold text-foreground mb-6">
                {fulfillmentMethod === "store_pickup" ? "Contact Information" : "Shipping Information"}
              </h2>

              <div className="space-y-4">
                {/* Country */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Country
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
                      First Name
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
                      Last Name
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
                      Email
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
                  {fulfillmentMethod === "shipping" && (
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Phone
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
                  )}
                </div>

                {/* Address fields (shipping only - pickup orders need no delivery address) */}
                {fulfillmentMethod === "shipping" && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Street Address
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
                          City
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
                          Province/State
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
                          {form.country === "CA" ? "Postal Code" : "ZIP Code"}
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
                  </>
                )}
              </div>

              {/* Continue to Payment button */}
              {ratesError && (
                <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 mt-4">
                  {ratesError}
                </div>
              )}
              <button
                type="button"
                onClick={handleContinueToPayment}
                disabled={ratesLoading}
                className="btn-primary w-full flex items-center justify-center gap-2 mt-6"
              >
                {ratesLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Finding shipping options...
                  </>
                ) : (
                  "Continue to Payment"
                )}
              </button>
            </div>
            </>
          )}

          {/* ═══ STEP 2: Payment ═══ */}
          {checkoutStep === "payment" && (
            <>
              {/* Edit Shipping (collapsed summary) */}
              <div className="card mb-4">
                <div className="flex items-center justify-between">
                  <div>
                    {fulfillmentMethod === "store_pickup" ? (
                      <>
                        <h3 className="font-medium text-foreground">Pick up in store</h3>
                        <p className="text-sm text-foreground/60">
                          {form.first_name} {form.last_name}
                          {storeSettings.pickup_location ? ` — ${storeSettings.pickup_location}` : ""}
                        </p>
                      </>
                    ) : (
                      <>
                        <h3 className="font-medium text-foreground">Shipping to</h3>
                        <p className="text-sm text-foreground/60">
                          {form.first_name} {form.last_name}, {form.address_line1}, {form.city}, {form.province_state} {form.postal_code}
                        </p>
                      </>
                    )}
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

              {/* Shipping method selection (shipping orders only — pickup is free) */}
              {fulfillmentMethod === "store_pickup" ? (
                <div className="card mb-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium text-foreground">Pickup</h3>
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentError("");
                      setCheckoutStep("shipping");
                    }}
                    className="text-sm text-primary hover:underline font-medium"
                  >
                    Change
                  </button>
                </div>
                  <div className="flex items-center justify-between rounded-lg border border-primary bg-primary/5 px-4 py-3">
                    <span>
                      <span className="block text-sm font-medium text-foreground">Pick up in store</span>
                      <span className="block text-xs text-foreground/50 mt-0.5">
                        {storeSettings.pickup_location || "Arade store pickup"}
                        {storeSettings.pickup_preparation_minutes
                          ? ` — ready in ~${storeSettings.pickup_preparation_minutes} minutes`
                          : ""}
                      </span>
                    </span>
                    <span className="text-sm font-semibold text-green-600">FREE</span>
                  </div>
                </div>
              ) : (
              <div className="card mb-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium text-foreground">Shipping Method</h3>
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentError("");
                      setCheckoutStep("shipping");
                    }}
                    className="text-sm text-primary hover:underline font-medium"
                  >
                    Change
                  </button>
                </div>
                {ratesError && (
                  <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 mb-3">
                    {ratesError}
                  </div>
                )}
                <div className="space-y-2">
                  {shippingRates.map((rate) => (
                    <label
                      key={rate.serviceCode}
                      className={`flex items-center justify-between rounded-lg border px-4 py-3 cursor-pointer transition-colors ${
                        selectedRate?.serviceCode === rate.serviceCode
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/40"
                      }`}
                    >
                      <span className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="shipping-method"
                          checked={selectedRate?.serviceCode === rate.serviceCode}
                          onChange={() => setSelectedRate(rate)}
                          className="accent-[var(--primary)]"
                        />
                        <span>
                          <span className="block text-sm font-medium text-foreground">{rate.serviceName}</span>
                          {rate.transitDays != null && (
                            <span className="block text-xs text-foreground/50">
                              Estimated {rate.transitDays} business day{rate.transitDays === 1 ? "" : "s"}
                            </span>
                          )}
                        </span>
                      </span>
                      <span className="text-sm font-semibold text-foreground">
                        {formatPrice(rate.price, currency)}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
              )}

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
                  {paypalError ? (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                      <p>{paypalError}</p>
                      <button
                        type="button"
                        onClick={() => {
                          setPaypalError(null);
                          setPaypalScriptLoaded(false);
                          setPaypalRetry((count) => count + 1);
                        }}
                        className="btn-secondary mt-3 inline-flex items-center gap-2 px-3 py-1.5 text-xs"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        Retry PayPal
                      </button>
                    </div>
                  ) : (
                    !paypalScriptLoaded && (
                      <div className="flex items-center justify-center gap-2 py-4 text-foreground/50 text-sm">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Loading PayPal...
                      </div>
                    )
                  )}
                  <div className={loading ? "pointer-events-none opacity-60" : ""} ref={paypalButtonsRef} />
                </div>
              )}
            </div>
            </>
          )}
        </div>

        {/* Order summary — collapsed drawer on mobile (Total always visible in its header), sticky column on desktop */}
        <div className="order-first lg:order-none lg:col-span-1">
          <div className="card sticky top-24 p-4 sm:p-6">
            {/* Mobile: tap-to-expand drawer header carrying the running Total */}
            <button
              type="button"
              onClick={() => setSummaryOpen((v) => !v)}
              aria-expanded={summaryOpen}
              className="lg:hidden w-full flex items-center justify-between gap-3"
            >
              <span className="flex items-center gap-2 font-semibold text-foreground">
                <ShoppingBag className="w-4 h-4 text-primary" />
                Order Summary
              </span>
              <span className="flex items-center gap-1.5">
                <span className="text-xs text-foreground/50">Total</span>
                <span className="font-bold text-primary">{formatPrice(total, currency)}</span>
                <ChevronDown className={`w-4 h-4 text-foreground/50 transition-transform ${summaryOpen ? "rotate-180" : ""}`} />
              </span>
            </button>

            <div className={`${summaryOpen ? "block" : "hidden"} lg:block mt-4 lg:mt-0`}>
            <h2 className="text-lg font-semibold text-foreground mb-4 hidden lg:block">
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

            {/* Coupon code */}
            <div className="border-t border-border pt-4 mb-4">
              {appliedCoupon ? (
                <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                  <div className="text-sm">
                    <span className="font-medium text-green-700">{appliedCoupon.code}</span>
                    <span className="text-green-600"> — you save {formatPrice(appliedCoupon.discount, currency)}</span>
                  </div>
                  <button
                    type="button"
                    onClick={removeCoupon}
                    className="text-xs font-medium text-red-600 hover:text-red-700"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <div>
                  <div className="flex w-full gap-2 items-center">
                    <input
                      type="text"
                      value={couponInput}
                      onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); applyCoupon(); } }}
                      placeholder="Coupon code"
                      className="flex-1 min-w-0 w-full px-3 py-2 border border-border rounded-lg text-sm bg-white outline-none focus:border-primary"
                    />
                    <button
                      type="button"
                      onClick={applyCoupon}
                      disabled={couponChecking || !couponInput.trim()}
                      className="shrink-0 px-3.5 sm:px-4 py-2 rounded-lg text-sm font-medium border border-primary text-primary hover:bg-primary/5 disabled:opacity-50 whitespace-nowrap"
                    >
                      {couponChecking ? "Checking..." : "Apply"}
                    </button>
                  </div>
                </div>
              )}
              {couponMessage && (
                <p className={`mt-2 text-xs ${couponMessage.type === "success" ? "text-green-600" : "text-red-600"}`}>
                  {couponMessage.text}
                </p>
              )}
            </div>

            <div className="border-t border-border pt-4 space-y-2 mb-4">
              <div className="flex justify-between text-sm">
                <span className="text-foreground/60">Subtotal</span>
                <span>{formatPrice(subtotal, currency)}</span>
              </div>
              {appliedCoupon && (
                <div className="flex justify-between text-sm">
                  <span className="text-foreground/60">Discount ({appliedCoupon.code})</span>
                  <span className="text-green-600 font-medium">
                    -{formatPrice(appliedCoupon.discount, currency)}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-foreground/60">
                  {fulfillmentMethod === "store_pickup"
                    ? "Pickup (in store)"
                    : `Delivery (${selectedRate?.serviceName || "—"})`}
                </span>
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
              {fulfillmentMethod === "shipping" && !selectedRate && (
                <p className="text-xs text-foreground/50">
                  Delivery is calculated from live Canada Post rates for your address.
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
    </div>
  );
}
