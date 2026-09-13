"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
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
  const trackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Track cart server-side for logged-in users (debounced)
  useEffect(() => {
    if (!hydrated || !user) return;

    if (trackTimeoutRef.current) clearTimeout(trackTimeoutRef.current);

    trackTimeoutRef.current = setTimeout(() => {
      const cartTotal = items.reduce(
        (sum, item) => sum + item.price_cad * item.quantity,
        0
      );
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
        // Track failures silently in prod, but surface in console for debugging
        if (process.env.NODE_ENV !== "production") {
          console.warn("[CartProvider] Failed to track cart:", err);
        }
      });
    }, 2000);

    return () => {
      if (trackTimeoutRef.current) clearTimeout(trackTimeoutRef.current);
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
