"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Upload, Loader2, X } from "lucide-react";
import { PRODUCT_CATEGORIES, SKIN_TYPES } from "@/lib/constants";

export default function NewProductPage() {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    slug: "",
    description: "",
    price_cad: 0,
    price_usd: 0,
    category_id: "",
    stock_quantity: 0,
    ingredients: "",
    benefits: "",
    how_to_use: "",
    skin_types: [] as string[],
    size: "",
    is_active: true,
    is_featured: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .replace(/[\s_-]+/g, "-")
      .replace(/^-+|-+$/g, "");
  };

  const handleNameChange = (name: string) => {
    setForm((prev) => ({
      ...prev,
      name,
      slug: generateSlug(name),
    }));
  };

  const toggleSkinType = (type: string) => {
    setForm((prev) => ({
      ...prev,
      skin_types: prev.skin_types.includes(type)
        ? prev.skin_types.filter((t) => t !== type)
        : [...prev.skin_types, type],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Basic validation
    const newErrors: Record<string, string> = {};
    if (!form.name.trim()) newErrors.name = "Name is required";
    if (!form.description.trim()) newErrors.description = "Description is required";
    if (form.price_cad <= 0) newErrors.price_cad = "CAD price must be greater than 0";
    if (form.price_usd <= 0) newErrors.price_usd = "USD price must be greater than 0";
    if (!form.category_id) newErrors.category_id = "Category is required";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    // TODO: Connect to API route
    await new Promise((resolve) => setTimeout(resolve, 2000));
    alert("Product created successfully! (Connect to Supabase to save)");
    setLoading(false);
  };

  return (
    <div>
      <div className="flex items-center gap-4 mb-8">
        <Link
          href="/admin/products"
          className="p-2 hover:bg-muted rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Add New Product</h1>
          <p className="text-foreground/60">
            Fill in the details to add a new product
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="max-w-3xl space-y-6">
        {/* Basic Info */}
        <div className="card">
          <h2 className="text-lg font-semibold text-foreground mb-4">
            Basic Information
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Product Name *
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => handleNameChange(e.target.value)}
                className={`input ${errors.name ? "input-error" : ""}`}
                placeholder="e.g. Gentle Foaming Cleanser"
              />
              {errors.name && (
                <p className="text-xs text-red-600 mt-1">{errors.name}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Slug
              </label>
              <input
                type="text"
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
                className="input"
                placeholder="gentle-foaming-cleanser"
              />
              <p className="text-xs text-foreground/50 mt-1">
                Auto-generated from name. You can edit it.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Description *
              </label>
              <textarea
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                rows={4}
                className={`input resize-none ${
                  errors.description ? "input-error" : ""
                }`}
                placeholder="Describe the product..."
              />
              {errors.description && (
                <p className="text-xs text-red-600 mt-1">
                  {errors.description}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Pricing & Stock */}
        <div className="card">
          <h2 className="text-lg font-semibold text-foreground mb-4">
            Pricing & Stock
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Price (CAD) *
              </label>
              <input
                type="number"
                value={form.price_cad || ""}
                onChange={(e) =>
                  setForm({ ...form, price_cad: Number(e.target.value) })
                }
                className={`input ${errors.price_cad ? "input-error" : ""}`}
                min="0"
                step="0.01"
                placeholder="0.00"
              />
              {errors.price_cad && (
                <p className="text-xs text-red-600 mt-1">{errors.price_cad}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Price (USD) *
              </label>
              <input
                type="number"
                value={form.price_usd || ""}
                onChange={(e) =>
                  setForm({ ...form, price_usd: Number(e.target.value) })
                }
                className={`input ${errors.price_usd ? "input-error" : ""}`}
                min="0"
                step="0.01"
                placeholder="0.00"
              />
              {errors.price_usd && (
                <p className="text-xs text-red-600 mt-1">{errors.price_usd}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Stock Quantity
              </label>
              <input
                type="number"
                value={form.stock_quantity || ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    stock_quantity: Number(e.target.value),
                  })
                }
                className="input"
                min="0"
                placeholder="0"
              />
            </div>
          </div>
        </div>

        {/* Category & Size */}
        <div className="card">
          <h2 className="text-lg font-semibold text-foreground mb-4">
            Category & Details
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Category *
              </label>
              <select
                value={form.category_id}
                onChange={(e) =>
                  setForm({ ...form, category_id: e.target.value })
                }
                className={`input ${errors.category_id ? "input-error" : ""}`}
              >
                <option value="">Select category...</option>
                {PRODUCT_CATEGORIES.map((cat) => (
                  <option key={cat.slug} value={cat.slug}>
                    {cat.name}
                  </option>
                ))}
              </select>
              {errors.category_id && (
                <p className="text-xs text-red-600 mt-1">
                  {errors.category_id}
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Size
              </label>
              <input
                type="text"
                value={form.size}
                onChange={(e) => setForm({ ...form, size: e.target.value })}
                className="input"
                placeholder="e.g. 150ml / 5 fl oz"
              />
            </div>
          </div>
        </div>

        {/* Images */}
        <div className="card">
          <h2 className="text-lg font-semibold text-foreground mb-4">
            Product Images
          </h2>
          <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
            <Upload className="w-10 h-10 text-foreground/30 mx-auto mb-3" />
            <p className="text-foreground/60 mb-2">
              Drag and drop images here, or click to browse
            </p>
            <p className="text-xs text-foreground/50">
              PNG, JPG up to 5MB. First image will be the main product image.
            </p>
            <button
              type="button"
              className="mt-4 btn-outline text-sm"
            >
              Choose Files
            </button>
          </div>
        </div>

        {/* Skin Types */}
        <div className="card">
          <h2 className="text-lg font-semibold text-foreground mb-4">
            Suitable Skin Types
          </h2>
          <div className="flex flex-wrap gap-3">
            {SKIN_TYPES.map((type) => (
              <label
                key={type}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer transition-colors ${
                  form.skin_types.includes(type)
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border hover:border-primary/50"
                }`}
              >
                <input
                  type="checkbox"
                  checked={form.skin_types.includes(type)}
                  onChange={() => toggleSkinType(type)}
                  className="sr-only"
                />
                {type}
              </label>
            ))}
          </div>
        </div>

        {/* Product Details */}
        <div className="card">
          <h2 className="text-lg font-semibold text-foreground mb-4">
            Product Details
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Ingredients
              </label>
              <textarea
                value={form.ingredients}
                onChange={(e) =>
                  setForm({ ...form, ingredients: e.target.value })
                }
                rows={3}
                className="input resize-none"
                placeholder="List the product ingredients..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Benefits
              </label>
              <textarea
                value={form.benefits}
                onChange={(e) =>
                  setForm({ ...form, benefits: e.target.value })
                }
                rows={3}
                className="input resize-none"
                placeholder="Describe the product benefits..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                How to Use
              </label>
              <textarea
                value={form.how_to_use}
                onChange={(e) =>
                  setForm({ ...form, how_to_use: e.target.value })
                }
                rows={3}
                className="input resize-none"
                placeholder="Instructions for using the product..."
              />
            </div>
          </div>
        </div>

        {/* Status */}
        <div className="card">
          <h2 className="text-lg font-semibold text-foreground mb-4">
            Status
          </h2>
          <div className="space-y-3">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) =>
                  setForm({ ...form, is_active: e.target.checked })
                }
                className="w-4 h-4 rounded border-border text-primary focus:ring-primary/20"
              />
              <span className="text-sm text-foreground">
                Product is active (visible in shop)
              </span>
            </label>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={form.is_featured}
                onChange={(e) =>
                  setForm({ ...form, is_featured: e.target.checked })
                }
                className="w-4 h-4 rounded border-border text-primary focus:ring-primary/20"
              />
              <span className="text-sm text-foreground">
                Featured product (shown on homepage)
              </span>
            </label>
          </div>
        </div>

        {/* Submit */}
        <div className="flex gap-4">
          <button
            type="submit"
            disabled={loading}
            className="btn-primary flex items-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Creating...
              </>
            ) : (
              "Create Product"
            )}
          </button>
          <Link href="/admin/products" className="btn-outline">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
