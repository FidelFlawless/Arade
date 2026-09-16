"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from "react";
import { useAuth } from "@/components/providers/AuthProvider";

export interface CartItem {
  id: string;
  name: string;
  slug: string;
  price_cad: number;
  price_usd: number;
  image: string | null;
  quantity: number;
  stock: number;
}

interface CartContextType {
  items: CartItem[];
  cartCount: number;
  addToCart: (product: Omit<CartItem, "quantity">, quantity?: number) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
}

const CartContext = createContext<CartContextType>({
  items: [],
  cartCount: 0,
  addToCart: () => {},
  removeFromCart: () => {},
  updateQuantity: () => {},
  clearCart: () => {},
});

const CART_KEY = "arade-cart";

export function useCart() {
  return useContext(CartContext);
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const { user } = useAuth();

  // Hydrate from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(CART_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Clear old placeholder data (items with id "1" or "2" from old cart)
        const cleaned = parsed.filter(
          (item: CartItem) => item.id !== "1" && item.id !== "2" && item.name !== "Gentle Foaming Cleanser" && item.name !== "Hydra-Glow Moisturizer"
        );
        setItems(cleaned);
      }
    } catch {
      // ignore parse errors
    }
    setHydrated(true);
  }, []);

  // Persist to localStorage whenever items change
  useEffect(() => {
    if (hydrated) {
      localStorage.setItem(CART_KEY, JSON.stringify(items));
    }
  }, [items, hydrated]);

  // Track cart server-side for logged-in users
  // - Immediate track on mount (so revisit updates last_active right away)
  // - Debounced track on item changes
  // - Final track on page unload as a safety net
  useEffect(() => {
    if (!hydrated || !user) return;
    if (items.length === 0) return;

    const cartTotal = items.reduce(
      (sum, item) => sum + item.price_cad * item.quantity,
      0
    );

    let cancelled = false;

    const sendTrack = () => {
      if (cancelled) return;
      fetch("/api/cart/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          email: user.email,
          items,
          cartTotal,
          currency: "CAD",
        }),
      }).catch((err) => {
        if (process.env.NODE_ENV !== "production") {
          console.warn("[CartProvider] Failed to track cart:", err);
        }
      });
    };

    // 1. Immediate track on mount/revisit
    sendTrack();

    // 2. Debounced track on item changes
    const debounceTimer = setTimeout(sendTrack, 500);

    // 3. Final track on page unload (sendBeacon with explicit JSON content type)
    const handleBeforeUnload = () => {
      if (cancelled) return;
      const blob = new Blob(
        [
          JSON.stringify({
            userId: user.id,
            email: user.email,
            items,
            cartTotal,
            currency: "CAD",
          }),
        ],
        { type: "application/json" }
      );
      navigator.sendBeacon?.("/api/cart/track", blob);
    };
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      cancelled = true;
      clearTimeout(debounceTimer);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [items, hydrated, user]);

  const addToCart = useCallback(
    (product: Omit<CartItem, "quantity">, quantity = 1) => {
      setItems((prev) => {
        const existing = prev.find((item) => item.id === product.id);
        if (existing) {
          return prev.map((item) =>
            item.id === product.id
              ? {
                  ...item,
                  quantity: Math.min(
                    item.quantity + quantity,
                    item.stock
                  ),
                }
              : item
          );
        }
        return [...prev, { ...product, quantity }];
      });
    },
    []
  );

  const removeFromCart = useCallback((productId: string) => {
    setItems((prev) => prev.filter((item) => item.id !== productId));
  }, []);

  const updateQuantity = useCallback(
    (productId: string, quantity: number) => {
      if (quantity <= 0) {
        removeFromCart(productId);
        return;
      }
      setItems((prev) =>
        prev.map((item) =>
          item.id === productId
            ? { ...item, quantity: Math.min(quantity, item.stock) }
            : item
        )
      );
    },
    [removeFromCart]
  );

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  const cartCount = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        cartCount,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}
