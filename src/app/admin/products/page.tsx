"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Plus, Search, Edit2, Trash2, Eye, EyeOff, Package, Loader2, Star,
} from "lucide-react";

interface Product {
  id: string;
  name: string;
  slug: string;
  price_cad: number;
  price_usd: number;
  stock_quantity: number;
  is_active: boolean;
  is_featured: boolean;
  images: string[];
  categories: { name: string; slug: string } | null;
}

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    loadProducts();
  }, []);

  async function loadProducts() {
    setLoading(true);
    const res = await fetch("/api/admin/products");
    if (res.ok) {
      const data = await res.json();
      setProducts(data);
    }
    setLoading(false);
  }

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.categories?.name?.toLowerCase().includes(search.toLowerCase())
  );

  async function toggleActive(id: string, current: boolean) {
    await fetch("/api/admin/products", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, is_active: !current }),
    });
    setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, is_active: !current } : p)));
  }

  async function toggleFeatured(id: string, current: boolean) {
    await fetch("/api/admin/products", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, is_featured: !current }),
    });
    setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, is_featured: !current } : p)));
  }

  async function deleteProduct(id: string) {
    if (!confirm("Are you sure you want to delete this product?")) return;
    setDeleting(id);
    await fetch(`/api/admin/products?id=${id}`, { method: "DELETE" });
    setProducts((prev) => prev.filter((p) => p.id !== id));
    setDeleting(null);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Products</h1>
          <p className="text-foreground/60">{products.length} products total</p>
        </div>
        <Link
          href="/admin/products/new"
          className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Add Product
        </Link>
      </div>

      <div className="card mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/40" />
          <input
            type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products by name or category..."
            className="w-full pl-10 pr-4 py-2.5 border border-border rounded-lg text-sm bg-white outline-none"
          />
        </div>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left text-sm font-medium text-foreground/60 p-4">Product</th>
                  <th className="text-left text-sm font-medium text-foreground/60 p-4">Category</th>
                  <th className="text-left text-sm font-medium text-foreground/60 p-4">Price (CAD)</th>
                  <th className="text-left text-sm font-medium text-foreground/60 p-4">Price (USD)</th>
                  <th className="text-left text-sm font-medium text-foreground/60 p-4">Stock</th>
                  <th className="text-left text-sm font-medium text-foreground/60 p-4">Status</th>
                  <th className="text-right text-sm font-medium text-foreground/60 p-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((product) => (
                  <tr key={product.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        {product.images?.[0] ? (
                          <img src={product.images[0]} alt={product.name} className="w-10 h-10 rounded-lg object-cover" />
                        ) : (
                          <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
                            <Package className="w-5 h-5 text-foreground/30" />
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-foreground">{product.name}</p>
                          <p className="text-xs text-foreground/50">/{product.slug}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-sm text-foreground/70">{product.categories?.name || "—"}</td>
                    <td className="p-4 text-sm font-medium">C${product.price_cad.toFixed(2)}</td>
                    <td className="p-4 text-sm font-medium">US${product.price_usd.toFixed(2)}</td>
                    <td className="p-4">
                      <span className={`text-sm font-medium ${product.stock_quantity < 10 ? "text-red-600" : product.stock_quantity < 20 ? "text-yellow-600" : "text-green-600"}`}>
                        {product.stock_quantity}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <button onClick={() => toggleActive(product.id, product.is_active)}
                          className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${product.is_active ? "text-green-600 bg-green-50" : "text-gray-600 bg-gray-50"}`}>
                          {product.is_active ? <><Eye className="w-3 h-3" /> Active</> : <><EyeOff className="w-3 h-3" /> Inactive</>}
                        </button>
                        {product.is_featured && (
                          <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full text-yellow-600 bg-yellow-50">
                            <Star className="w-3 h-3" /> Featured
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => toggleFeatured(product.id, product.is_featured)}
                          className="p-1.5 text-foreground/50 hover:text-yellow-600 hover:bg-yellow-50 rounded-lg transition-colors" title={product.is_featured ? "Unfeature" : "Feature"}>
                          <Star className="w-4 h-4" />
                        </button>
                        <Link href={`/admin/products/${product.id}/edit`}
                          className="p-1.5 text-foreground/50 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors" title="Edit">
                          <Edit2 className="w-4 h-4" />
                        </Link>
                        <button onClick={() => deleteProduct(product.id)} disabled={deleting === product.id}
                          className="p-1.5 text-foreground/50 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50" title="Delete">
                          {deleting === product.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!loading && filteredProducts.length === 0 && (
          <div className="text-center py-12">
            <Package className="w-12 h-12 text-foreground/20 mx-auto mb-4" />
            <p className="text-foreground/60">{search ? "No products match your search" : "No products yet"}</p>
          </div>
        )}
      </div>
    </div>
  );
}
