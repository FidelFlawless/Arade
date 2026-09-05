"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Trash2, Plus, Minus, ShoppingBag, ArrowLeft, Loader2 } from "lucide-react";
import { useCart } from "@/components/providers/CartProvider";
import { useAuth } from "@/components/providers/AuthProvider";
import { formatPrice, calculateDeliveryFee } from "@/lib/utils";
import { FREE_DELIVERY_THRESHOLD } from "@/lib/constants";

export default function CartPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { items: cartItems, removeFromCart, updateQuantity } = useCart();
  const [country, setCountry] = useState<"CA" | "US">("CA");
  const [updating, setUpdating] = useState<string | null>(null);

  const currency = country === "CA" ? "CAD" : "USD";
  const priceKey = currency === "CAD" ? "price_cad" : "price_usd";

  const subtotal = cartItems.reduce(
    (sum, item) => sum + item[priceKey] * item.quantity,
    0
  );
  const deliveryFee = calculateDeliveryFee(subtotal, currency);
  const total = subtotal + deliveryFee;

  const handleUpdateQuantity = async (itemId: string, newQuantity: number) => {
    setUpdating(itemId);
    await new Promise((resolve) => setTimeout(resolve, 200));
    updateQuantity(itemId, newQuantity);
    setUpdating(null);
  };

  if (cartItems.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <ShoppingBag className="w-16 h-16 text-foreground/20 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-foreground mb-2">
          Your Cart is Empty
        </h1>
        <p className="text-foreground/60 mb-6">
          Looks like you haven&apos;t added any products yet.
        </p>
        <Link href="/shop" className="btn-primary">
          Start Shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 sm:mb-8">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-foreground">
            Shopping Cart
          </h1>
          <p className="text-sm text-foreground/60 mt-1">{cartItems.length} item{cartItems.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-foreground/60">Country:</label>
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value as "CA" | "US")}
            className="text-sm border border-border rounded-lg px-3 py-1.5"
          >
            <option value="CA">🇨🇦 Canada (CAD)</option>
            <option value="US">🇺🇸 United States (USD)</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Cart items */}
        <div className="lg:col-span-2 space-y-4">
          {cartItems.map((item) => (
            <div key={item.id} className="card flex flex-col sm:flex-row gap-4">
              {/* Product image */}
              <Link
                href={`/product/${item.slug}`}
                className="w-full sm:w-32 h-32 bg-muted rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden"
              >
                {item.image ? (
                  <img
                    src={item.image}
                    alt={item.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-4xl">🧴</span>
                )}
              </Link>

              {/* Product info */}
              <div className="flex-1">
                <div className="flex justify-between gap-4">
                  <div>
                    <Link
                      href={`/product/${item.slug}`}
                      className="font-medium text-foreground hover:text-primary transition-colors"
                    >
                      {item.name}
                    </Link>
                    <p className="text-sm text-foreground/50 mt-1">
                      {formatPrice(item[priceKey], currency)} each
                    </p>
                  </div>
                  <button
                    onClick={() => removeFromCart(item.id)}
                    className="text-foreground/30 hover:text-red-500 transition-colors flex-shrink-0"
                    aria-label="Remove item"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>

                <div className="flex items-center justify-between mt-4">
                  {/* Quantity controls */}
                  <div className="flex items-center border border-border rounded-lg">
                    <button
                      onClick={() => handleUpdateQuantity(item.id, item.quantity - 1)}
                      disabled={item.quantity <= 1 || updating === item.id}
                      className="px-3 py-2 text-foreground/60 hover:text-primary disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="px-3 py-2 font-medium min-w-[2.5rem] text-center text-sm">
                      {updating === item.id ? (
                        <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                      ) : (
                        item.quantity
                      )}
                    </span>
                    <button
                      onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)}
                      disabled={item.quantity >= item.stock || updating === item.id}
                      className="px-3 py-2 text-foreground/60 hover:text-primary disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Line total */}
                  <p className="font-semibold text-foreground">
                    {formatPrice(item[priceKey] * item.quantity, currency)}
                  </p>
                </div>
              </div>
            </div>
          ))}

          <Link
            href="/shop"
            className="inline-flex items-center gap-2 text-primary hover:text-primary-dark transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Continue Shopping
          </Link>
        </div>

        {/* Order summary */}
        <div className="lg:col-span-1">
          <div className="card sticky top-24">
            <h2 className="text-lg font-semibold text-foreground mb-4">
              Order Summary
            </h2>

            <div className="space-y-3 mb-4">
              <div className="flex justify-between text-sm">
                <span className="text-foreground/60">Subtotal</span>
                <span className="font-medium">
                  {formatPrice(subtotal, currency)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-foreground/60">Delivery</span>
                <span
                  className={
                    deliveryFee === 0
                      ? "text-green-600 font-medium"
                      : "font-medium"
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
                  {formatPrice(FREE_DELIVERY_THRESHOLD, currency)}
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

            <button
              onClick={() => {
                if (!user) {
                  router.push("/auth/login?redirect=/checkout");
                } else {
                  router.push("/checkout");
                }
              }}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              Proceed to Checkout
            </button>

            {/* Trust badges */}
            <div className="mt-6 pt-4 border-t border-border">
              <div className="flex items-center justify-center gap-4 text-xs text-foreground/50">
                <span>🔒 Secure Checkout</span>
                <span>🚚 Free Shipping $180+</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
