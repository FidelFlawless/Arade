"use client";


import { useState, useEffect, useRef } from "react";
import { Plus, Edit2, Trash2, FolderTree, Loader2, X } from "lucide-react";

interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parent_category_id: string | null;
  is_active: boolean;
}

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", slug: "", description: "", parent_category_id: "" });
  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => { loadCategories(); }, []);

  async function loadCategories() {
    setLoading(true);
    const res = await fetch("/api/admin/categories");
    if (res.ok) {
      const data = await res.json();
      setCategories(data);
    }
    setLoading(false);
  }

  const mainCategories = categories.filter((c) => !c.parent_category_id);
  const subCategories = categories.filter((c) => c.parent_category_id);

  const generateSlug = (name: string) =>
    name.toLowerCase().replace(/[^\w\s-]/g, "").replace(/[\s_-]+/g, "-").replace(/^-+|-+$/g, "");

  function startEdit(id: string) {
    const cat = categories.find((c) => c.id === id);
    if (cat) {
      setForm({
        name: cat.name,
        slug: cat.slug,
        description: cat.description || "",
        parent_category_id: cat.parent_category_id || "",
      });
      setEditingId(id);
      setShowForm(true);
      setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 100);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const payload = {
      name: form.name.trim(),
      slug: form.slug || generateSlug(form.name),
      description: form.description.trim() || null,
      parent_category_id: form.parent_category_id || null,
      is_active: true,
    };

    if (editingId) {
      await fetch("/api/admin/categories", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingId, ...payload }),
      });
    } else {
      await fetch("/api/admin/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }

    setForm({ name: "", slug: "", description: "", parent_category_id: "" });
    setEditingId(null);
    setShowForm(false);
    setSaving(false);
    loadCategories();
  }

  async function deleteCategory(id: string) {
    if (!confirm("Delete this category? Products in it won't be deleted.")) return;
    await fetch(`/api/admin/categories?id=${id}`, { method: "DELETE" });
    loadCategories();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Categories</h1>
          <p className="text-foreground/60">{categories.length} categories total</p>
        </div>
        <button
          onClick={() => { setShowForm(!showForm); setEditingId(null); setForm({ name: "", slug: "", description: "", parent_category_id: "" }); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium"
        >
          <Plus className="w-4 h-4" /> Add Category
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div ref={formRef} className="card mb-6 scroll-mt-24 border-2 border-primary/30">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground">{editingId ? "Edit Category" : "New Category"}</h2>
            <button onClick={() => { setShowForm(false); setEditingId(null); }} className="p-1 hover:bg-muted rounded">
              <X className="w-5 h-5" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Name *</label>
                <input type="text" value={form.name} required
                  onChange={(e) => setForm({ ...form, name: e.target.value, slug: generateSlug(e.target.value) })}
                  className="w-full px-4 py-2.5 border border-border rounded-lg text-sm outline-none" placeholder="Category Name" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Slug</label>
                <input type="text" value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: e.target.value })}
                  className="w-full px-4 py-2.5 border border-border rounded-lg text-sm outline-none" placeholder="category-slug" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Parent Category (optional)</label>
                <select value={form.parent_category_id}
                  onChange={(e) => setForm({ ...form, parent_category_id: e.target.value })}
                  className="w-full px-4 py-2.5 border border-border rounded-lg text-sm outline-none bg-white">
                  <option value="">None (Main Category)</option>
                  {mainCategories.map((cat) => (<option key={cat.id} value={cat.id}>{cat.name}</option>))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Description</label>
                <input type="text" value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full px-4 py-2.5 border border-border rounded-lg text-sm outline-none" placeholder="Optional description" />
              </div>
            </div>
            <div className="flex gap-3">
              <button type="submit" disabled={saving}
                className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-lg hover:bg-primary/90 text-sm font-medium disabled:opacity-50">
                {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : editingId ? "Update Category" : "Create Category"}
              </button>
              <button type="button" onClick={() => { setShowForm(false); setEditingId(null); }}
                className="px-4 py-2.5 border border-border rounded-lg text-sm hover:bg-muted">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : (
        <>
          {/* Main Categories */}
          <h2 className="text-lg font-semibold text-foreground mb-4">Main Categories</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {mainCategories.map((cat) => (
              <div key={cat.id} className="card">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                      <FolderTree className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{cat.name}</p>
                      <p className="text-xs text-foreground/50">/{cat.slug}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => startEdit(cat.id)} className="p-1.5 text-foreground/50 hover:text-primary hover:bg-primary/10 rounded-lg cursor-pointer">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => deleteCategory(cat.id)} className="p-1.5 text-foreground/50 hover:text-red-600 hover:bg-red-50 rounded-lg cursor-pointer">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                {cat.description && <p className="text-sm text-foreground/60 mt-2">{cat.description}</p>}
              </div>
            ))}
          </div>

          {/* Subcategories */}
          <h2 className="text-lg font-semibold text-foreground mb-4">Subcategories</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {subCategories.map((cat) => {
              const parent = mainCategories.find((m) => m.id === cat.parent_category_id);
              return (
                <div key={cat.id} className="card">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-foreground">{cat.name}</p>
                      <p className="text-xs text-foreground/50">/{cat.slug}</p>
                      {parent && <p className="text-xs text-primary mt-1">under {parent.name}</p>}
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => startEdit(cat.id)} className="p-1.5 text-foreground/50 hover:text-primary hover:bg-primary/10 rounded-lg cursor-pointer">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => deleteCategory(cat.id)} className="p-1.5 text-foreground/50 hover:text-red-600 hover:bg-red-50 rounded-lg cursor-pointer">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
