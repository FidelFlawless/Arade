"use client";

import { useState } from "react";
import { ShoppingCart, Check, Minus, Plus, Loader2 } from "lucide-react";
import { useCart } from "@/components/providers/CartProvider";

interface Product {
  id: string;
  name: string;
  slug: string;
  price_cad: number;
  price_usd: number;
  images: string[] | null;
  stock_quantity: number;
}

export default function AddToCartButton({ product }: { product: Product }) {
  const { addToCart } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const [buying, setBuying] = useState(false);

  const handleAddToCart = () => {
    addToCart({
      id: product.id,
      name: product.name,
      slug: product.slug,
      price_cad: product.price_cad,
      price_usd: product.price_usd,
      image: product.images?.[0] || null,
      stock: product.stock_quantity,
    }, quantity);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  const handleBuyNow = () => {
    setBuying(true);
    addToCart({
      id: product.id,
      name: product.name,
      slug: product.slug,
      price_cad: product.price_cad,
      price_usd: product.price_usd,
      image: product.images?.[0] || null,
      stock: product.stock_quantity,
    }, quantity);
    setTimeout(() => {
      window.location.href = "/checkout";
    }, 100);
  };

  return (
    <div className="mt-8 space-y-4">
      <div className="flex items-center gap-4">
        <span className="text-sm text-foreground/60">Quantity:</span>
        <div className="flex items-center border border-border rounded-lg">
          <button
            onClick={() => setQuantity(Math.max(1, quantity - 1))}
            disabled={quantity <= 1}
            className="px-3 py-2 text-foreground/60 hover:text-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Minus className="w-4 h-4" />
          </button>
          <span className="px-4 py-2 font-medium min-w-[2.5rem] text-center text-sm">
            {quantity}
          </span>
          <button
            onClick={() => setQuantity(Math.min(product.stock_quantity, quantity + 1))}
            disabled={quantity >= product.stock_quantity}
            className="px-3 py-2 text-foreground/60 hover:text-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div className="flex gap-4">
        <button
          onClick={handleAddToCart}
          disabled={product.stock_quantity === 0}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-medium transition-all duration-200 ${
            added
              ? "bg-green-500 text-white"
              : "bg-primary text-white hover:bg-primary/90"
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {added ? (
            <>
              <Check className="w-5 h-5" />
              Added to Cart
            </>
          ) : (
            <>
              <ShoppingCart className="w-5 h-5" />
              Add to Cart
            </>
          )}
        </button>
        <button
          onClick={handleBuyNow}
          disabled={product.stock_quantity === 0}
          className="btn-outline px-8 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {buying ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            "Buy Now"
          )}
        </button>
      </div>
    </div>
  );
}
