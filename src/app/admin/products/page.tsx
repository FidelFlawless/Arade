"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  Eye,
  EyeOff,
  Package,
} from "lucide-react";

// Placeholder products
const placeholderProducts = [
  {
    id: "1",
    name: "Gentle Foaming Cleanser",
    slug: "gentle-foaming-cleanser",
    price_cad: 34.99,
    price_usd: 26.99,
    category: "Cleansers",
    stock: 45,
    is_active: true,
  },
  {
    id: "2",
    name: "Hydra-Glow Moisturizer",
    slug: "hydra-glow-moisturizer",
    price_cad: 48.99,
    price_usd: 37.99,
    category: "Moisturizers",
    stock: 32,
    is_active: true,
  },
  {
    id: "3",
    name: "Vitamin C Brightening Serum",
    slug: "vitamin-c-brightening-serum",
    price_cad: 62.99,
    price_usd: 48.99,
    category: "Serums",
    stock: 28,
    is_active: true,
  },
  {
    id: "4",
    name: "Daily Defense SPF 50",
    slug: "daily-defense-spf-50",
    price_cad: 38.99,
    price_usd: 29.99,
    category: "Sunscreen",
    stock: 50,
    is_active: true,
  },
  {
    id: "5",
    name: "Balancing Toner",
    slug: "balancing-toner",
    price_cad: 28.99,
    price_usd: 22.99,
    category: "Toners",
    stock: 40,
    is_active: true,
  },
  {
    id: "6",
    name: "Detox Clay Mask",
    slug: "detox-clay-mask",
    price_cad: 42.99,
    price_usd: 32.99,
    category: "Masks",
    stock: 25,
    is_active: true,
  },
  {
    id: "7",
    name: "Essentials Skincare Set",
    slug: "essentials-skincare-set",
    price_cad: 129.99,
    price_usd: 99.99,
    category: "Skincare Sets",
    stock: 5,
    is_active: true,
  },
  {
    id: "8",
    name: "Complete Glow Set",
    slug: "complete-glow-set",
    price_cad: 189.99,
    price_usd: 145.99,
    category: "Skincare Sets",
    stock: 3,
    is_active: false,
  },
];

export default function AdminProductsPage() {
  const [search, setSearch] = useState("");
  const [products] = useState(placeholderProducts);

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.category.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Products</h1>
          <p className="text-foreground/60">
            Manage your product catalog
          </p>
        </div>
        <Link
          href="/admin/products/new"
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Product
        </Link>
      </div>

      {/* Search and filters */}
      <div className="card mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/40" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products by name or category..."
            className="input input-icon"
          />
        </div>
      </div>

      {/* Products table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left text-sm font-medium text-foreground/60 p-4">
                  Product
                </th>
                <th className="text-left text-sm font-medium text-foreground/60 p-4">
                  Category
                </th>
                <th className="text-left text-sm font-medium text-foreground/60 p-4">
                  Price (CAD)
                </th>
                <th className="text-left text-sm font-medium text-foreground/60 p-4">
                  Price (USD)
                </th>
                <th className="text-left text-sm font-medium text-foreground/60 p-4">
                  Stock
                </th>
                <th className="text-left text-sm font-medium text-foreground/60 p-4">
                  Status
                </th>
                <th className="text-right text-sm font-medium text-foreground/60 p-4">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((product) => (
                <tr
                  key={product.id}
                  className="border-b border-border last:border-0 hover:bg-muted/30"
                >
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
                        <Package className="w-5 h-5 text-foreground/30" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">
                          {product.name}
                        </p>
                        <p className="text-xs text-foreground/50">
                          /{product.slug}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4 text-sm text-foreground/70">
                    {product.category}
                  </td>
                  <td className="p-4 text-sm font-medium">
                    C${product.price_cad.toFixed(2)}
                  </td>
                  <td className="p-4 text-sm font-medium">
                    US${product.price_usd.toFixed(2)}
                  </td>
                  <td className="p-4">
                    <span
                      className={`text-sm font-medium ${
                        product.stock < 10
                          ? "text-red-600"
                          : product.stock < 20
                          ? "text-yellow-600"
                          : "text-green-600"
                      }`}
                    >
                      {product.stock}
                      {product.stock < 10 && " ⚠️"}
                    </span>
                  </td>
                  <td className="p-4">
                    {product.is_active ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                        <Eye className="w-3 h-3" /> Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-600 bg-gray-50 px-2 py-0.5 rounded-full">
                        <EyeOff className="w-3 h-3" /> Archived
                      </span>
                    )}
                  </td>
                  <td className="p-4">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/admin/products/${product.id}/edit`}
                        className="p-1.5 text-foreground/50 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </Link>
                      <button
                        className="p-1.5 text-foreground/50 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredProducts.length === 0 && (
          <div className="text-center py-12">
            <Package className="w-12 h-12 text-foreground/20 mx-auto mb-4" />
            <p className="text-foreground/60">No products found</p>
          </div>
        )}
      </div>
    </div>
  );
}
