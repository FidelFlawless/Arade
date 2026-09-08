"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, X, ImageIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface Category {
  id: string;
  name: string;
  slug: string;
  parent_category_id: string | null;
}

export default function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [mainCategories, setMainCategories] = useState<Category[]>([]);
  const [selectedMainCategory, setSelectedMainCategory] = useState("");
  const [selectedSubCategory, setSelectedSubCategory] = useState("");
  const [newImageFiles, setNewImageFiles] = useState<File[]>([]);
  const [newImagePreviews, setNewImagePreviews] = useState<string[]>([]);
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [form, setForm] = useState({
    name: "", slug: "", description: "", price_cad: "", price_usd: "", stock_quantity: "",
    is_active: true, is_featured: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const supabase = createClient();

  useEffect(() => { loadProduct(); loadCategories(); }, [id]);

  async function loadProduct() {
    const res = await fetch("/api/admin/products");
    if (res.ok) {
      const products = await res.json();
      const data = products.find((p: any) => p.id === id);
      if (data) {
        setForm({
          name: data.name || "", slug: data.slug || "", description: data.description || "",
          price_cad: String(data.price_cad || ""), price_usd: String(data.price_usd || ""),
          stock_quantity: String(data.stock_quantity || ""),
          is_active: data.is_active ?? true, is_featured: data.is_featured ?? false,
        });
        setExistingImages(data.images || []);
        if (data.category_id) setSelectedSubCategory(data.category_id);
      }
    }
    setLoading(false);
  }

  async function loadCategories() {
    const { data } = await supabase.from("categories").select("*").order("name");
    if (data) {
      setMainCategories(data.filter((c) => !c.parent_category_id));
      setCategories(data);
    }
  }

  useEffect(() => {
    if (selectedSubCategory && categories.length > 0) {
      const sub = categories.find((c) => c.id === selectedSubCategory);
      if (sub?.parent_category_id) setSelectedMainCategory(sub.parent_category_id);
    }
  }, [selectedSubCategory, categories]);

  const subCategories = categories.filter((c) => c.parent_category_id === selectedMainCategory);

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    const valid = files.filter((f) => f.size <= 5 * 1024 * 1024);
    setNewImageFiles((prev) => [...prev, ...valid]);
    setNewImagePreviews((prev) => [...prev, ...valid.map((f) => URL.createObjectURL(f))]);
  }

  function removeNewImage(index: number) {
    setNewImageFiles((prev) => prev.filter((_, i) => i !== index));
    setNewImagePreviews((prev) => prev.filter((_, i) => i !== index));
  }

  function removeExistingImage(index: number) {
    setExistingImages((prev) => prev.filter((_, i) => i !== index));
  }

  async function uploadNewImages(): Promise<string[]> {
    const urls: string[] = [];
    for (const file of newImageFiles) {
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
      const { error } = await supabase.storage.from("product-images").upload(fileName, file);
      if (!error) {
        const { data } = supabase.storage.from("product-images").getPublicUrl(fileName);
        urls.push(data.publicUrl);
      }
    }
    return urls;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};
    if (!form.name.trim()) newErrors.name = "Name is required";
    if (!form.description.trim()) newErrors.description = "Description is required";
    if (!form.price_cad || Number(form.price_cad) <= 0) newErrors.price_cad = "CAD price required";
    if (!form.price_usd || Number(form.price_usd) <= 0) newErrors.price_usd = "USD price required";
    if (!selectedSubCategory) newErrors.category = "Category is required";
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }

    setSaving(true);
    const newUrls = await uploadNewImages();
    const allImages = [...existingImages, ...newUrls];

    const res = await fetch("/api/admin/products", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id, name: form.name.trim(), slug: form.slug, description: form.description.trim(),
        price_cad: Number(form.price_cad), price_usd: Number(form.price_usd),
        category_id: selectedSubCategory, stock_quantity: Number(form.stock_quantity) || 0,
        is_active: form.is_active, is_featured: form.is_featured, images: allImages,
      }),
    });

    setSaving(false);
    if (!res.ok) {
      const err = await res.json();
      alert("Error: " + err.error);
      return;
    }
    router.push("/admin/products");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-4 mb-8">
        <Link href="/admin/products" className="p-2 hover:bg-muted rounded-lg transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Edit Product</h1>
          <p className="text-foreground/60">Update product details</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="max-w-3xl space-y-6">
        {/* Basic Info */}
        <div className="card">
          <h2 className="text-lg font-semibold text-foreground mb-4">Basic Information</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Product Name *</label>
              <input type="text" value={form.name} onChange={(e) => { const name = e.target.value; setForm((prev) => ({ ...prev, name, slug: name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') })); }}
                className={`w-full px-4 py-2.5 border rounded-lg text-sm outline-none ${errors.name ? "border-red-500" : "border-border"}`} />
              {errors.name && <p className="text-xs text-red-600 mt-1">{errors.name}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Slug</label>
              <input type="text" value={form.slug} onChange={(e) => setForm((prev) => ({ ...prev, slug: e.target.value }))} placeholder="Auto-generated from name"
                className="w-full px-4 py-2.5 border border-border rounded-lg text-sm outline-none bg-gray-50" />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Description *</label>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={4} className={`w-full px-4 py-2.5 border rounded-lg text-sm outline-none resize-none ${errors.description ? "border-red-500" : "border-border"}`} />
              {errors.description && <p className="text-xs text-red-600 mt-1">{errors.description}</p>}
            </div>
          </div>
        </div>

        {/* Pricing & Stock */}
        <div className="card">
          <h2 className="text-lg font-semibold text-foreground mb-4">Pricing & Stock</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Price (CAD) *</label>
              <input type="number" value={form.price_cad} onChange={(e) => setForm({ ...form, price_cad: e.target.value })}
                className={`w-full px-4 py-2.5 border rounded-lg text-sm outline-none ${errors.price_cad ? "border-red-500" : "border-border"}`}
                min="0" step="0.01" />
              {errors.price_cad && <p className="text-xs text-red-600 mt-1">{errors.price_cad}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Price (USD) *</label>
              <input type="number" value={form.price_usd} onChange={(e) => setForm({ ...form, price_usd: e.target.value })}
                className={`w-full px-4 py-2.5 border rounded-lg text-sm outline-none ${errors.price_usd ? "border-red-500" : "border-border"}`}
                min="0" step="0.01" />
              {errors.price_usd && <p className="text-xs text-red-600 mt-1">{errors.price_usd}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Stock Quantity</label>
              <input type="number" value={form.stock_quantity} onChange={(e) => setForm({ ...form, stock_quantity: e.target.value })}
                className="w-full px-4 py-2.5 border border-border rounded-lg text-sm outline-none" min="0" />
            </div>
          </div>
        </div>

        {/* Category */}
        <div className="card">
          <h2 className="text-lg font-semibold text-foreground mb-4">Category *</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Main Category</label>
              <select value={selectedMainCategory} onChange={(e) => { setSelectedMainCategory(e.target.value); setSelectedSubCategory(""); }}
                className="w-full px-4 py-2.5 border border-border rounded-lg text-sm outline-none bg-white">
                <option value="">Select main category...</option>
                {mainCategories.map((cat) => (<option key={cat.id} value={cat.id}>{cat.name}</option>))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Subcategory</label>
              <select value={selectedSubCategory} onChange={(e) => setSelectedSubCategory(e.target.value)}
                className={`w-full px-4 py-2.5 border rounded-lg text-sm outline-none bg-white ${errors.category ? "border-red-500" : "border-border"}`}
                disabled={!selectedMainCategory}>
                <option value="">Select subcategory...</option>
                {subCategories.map((cat) => (<option key={cat.id} value={cat.id}>{cat.name}</option>))}
              </select>
              {errors.category && <p className="text-xs text-red-600 mt-1">{errors.category}</p>}
            </div>
          </div>
        </div>

        {/* Multiple Images */}
        <div className="card">
          <h2 className="text-lg font-semibold text-foreground mb-4">Product Images</h2>
          {existingImages.length > 0 && (
            <div className="flex flex-wrap gap-3 mb-3">
              {existingImages.map((img, i) => (
                <div key={`e-${i}`} className="relative">
                  <img src={img} alt={`Image ${i + 1}`} className="w-24 h-24 object-cover rounded-lg" />
                  <button type="button" onClick={() => removeExistingImage(i)}
                    className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center">
                    <X className="w-3 h-3" />
                  </button>
                  {i === 0 && <span className="absolute bottom-0 left-0 bg-primary text-white text-[10px] px-1.5 rounded-tr-lg rounded-bl-lg">Main</span>}
                </div>
              ))}
            </div>
          )}
          {newImagePreviews.length > 0 && (
            <div className="flex flex-wrap gap-3 mb-3">
              {newImagePreviews.map((preview, i) => (
                <div key={`n-${i}`} className="relative">
                  <img src={preview} alt={`New ${i + 1}`} className="w-24 h-24 object-cover rounded-lg border-2 border-green-400" />
                  <button type="button" onClick={() => removeNewImage(i)}
                    className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center">
                    <X className="w-3 h-3" />
                  </button>
                  <span className="absolute bottom-0 left-0 bg-green-500 text-white text-[10px] px-1.5 rounded-tr-lg rounded-bl-lg">New</span>
                </div>
              ))}
            </div>
          )}
          <label className="block border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors">
            <ImageIcon className="w-8 h-8 text-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-foreground/60">Click to add more images</p>
            <input type="file" accept="image/*" multiple onChange={handleImageChange} className="hidden" />
          </label>
        </div>

        {/* Status */}
        <div className="card">
          <h2 className="text-lg font-semibold text-foreground mb-4">Status</h2>
          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                className="w-4 h-4 rounded border-border text-primary" />
              <span className="text-sm text-foreground">Active (visible in shop)</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={form.is_featured} onChange={(e) => setForm({ ...form, is_featured: e.target.checked })}
                className="w-4 h-4 rounded border-border text-primary" />
              <span className="text-sm text-foreground">Featured (shown on homepage)</span>
            </label>
          </div>
        </div>

        <div className="flex gap-4">
          <button type="submit" disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium disabled:opacity-50">
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : "Save Changes"}
          </button>
          <Link href="/admin/products" className="px-6 py-2.5 border border-border rounded-lg text-sm font-medium hover:bg-muted transition-colors">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
