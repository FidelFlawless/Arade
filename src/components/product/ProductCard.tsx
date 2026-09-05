"use client";

import { useState } from "react";
import Link from "next/link";

import { useCart } from "@/components/providers/CartProvider";

interface ProductCardProps {
  id: string;
  name: string;
  slug: string;
  price_cad: number;
  price_usd: number;
  images: string[] | null;
  stock_quantity: number;
}

export default function ProductCard({ product }: { product: ProductCardProps }) {
  const { addToCart } = useCart();
  const [status, setStatus] = useState<"idle" | "loading" | "added">("idle");

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (status !== "idle" || product.stock_quantity <= 0) return;

    setStatus("loading");

    // Small delay to show loading state
    setTimeout(() => {
      addToCart({
        id: product.id,
        name: product.name,
        slug: product.slug,
        price_cad: product.price_cad,
        price_usd: product.price_usd,
        image: product.images?.[0] || null,
        stock: product.stock_quantity,
      });
      setStatus("added");
      setTimeout(() => setStatus("idle"), 2000);
    }, 300);
  };

  return (
    <div className="group card p-0 hover:shadow-lg">
      <Link href={`/product/${product.slug}`}>
        <div className="aspect-square bg-muted relative overflow-hidden rounded-t-lg">
          {product.images && product.images[0] ? (
            <img
              src={product.images[0]}
              alt={product.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-foreground/30">No Image</div>
          )}
        </div>
      </Link>
      <div className="p-2 sm:p-3">
        <Link href={`/product/${product.slug}`}>
          <h3 className="font-medium text-foreground text-sm line-clamp-2 hover:text-primary transition-colors">{product.name}</h3>
        </Link>
        <p className="mt-2 text-primary font-bold">C${product.price_cad}</p>
        <button
          onClick={handleAddToCart}
          disabled={product.stock_quantity <= 0 || status === "loading"}
          className={`mt-2 sm:mt-3 w-full py-2.5 sm:py-3 rounded-lg text-xs sm:text-sm font-medium transition-all duration-200 min-h-[40px] whitespace-nowrap ${
            product.stock_quantity <= 0
              ? "bg-gray-200 text-gray-400 cursor-not-allowed"
            : status === "added"
              ? "bg-green-500 text-white"
            : status === "loading"
              ? "bg-primary/70 text-white"
            : "bg-primary text-white hover:bg-primary/90 active:scale-[0.98]"
          }`}
        >
          {product.stock_quantity <= 0 ? (
            "Out of Stock"
          ) : status === "loading" ? (
            "Adding..."
          ) : status === "added" ? (
            "Added to Cart"
          ) : (
            "Add to Cart"
          )}
        </button>
      </div>
    </div>
  );
}