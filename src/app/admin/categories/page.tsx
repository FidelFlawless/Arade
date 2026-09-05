"use client";

import { useState } from "react";
import { Plus, Edit2, Trash2, FolderTree } from "lucide-react";
import { PRODUCT_CATEGORIES } from "@/lib/constants";

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState(
    PRODUCT_CATEGORIES.map((c, i) => ({
      ...c,
      id: String(i + 1),
      description: "",
      product_count: Math.floor(Math.random() * 10) + 1,
    }))
  );
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", slug: "", description: "" });
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
      setCategories((prev) =>
        prev.map((c) =>
          c.id === editingId
            ? { ...c, name: form.name, slug: form.slug, description: form.description }
            : c
        )
      );
    } else {
      setCategories((prev) => [
        ...prev,
        { ...form, id: String(Date.now()), product_count: 0 },
      ]);
    }
    setForm({ name: "", slug: "", description: "" });
    setEditingId(null);
    setShowForm(false);
  };

  const startEdit = (id: string) => {
    const cat = categories.find((c) => c.id === id);
    if (cat) {
      setForm({ name: cat.name, slug: cat.slug, description: cat.description || "" });
      setEditingId(id);
      setShowForm(true);
    }
  };

  const deleteCategory = (id: string) => {
    if (confirm("Are you sure you want to delete this category?")) {
      setCategories((prev) => prev.filter((c) => c.id !== id));
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Categories</h1>
          <p className="text-foreground/60">Manage product categories</p>
        </div>
        <button
          onClick={() => {
            setShowForm(!showForm);
            setEditingId(null);
            setForm({ name: "", slug: "", description: "" });
          }}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Category
        </button>
      </div>

      {showForm && (
        <div className="card mb-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">
            {editingId ? "Edit Category" : "New Category"}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Name
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  className="input"
                  placeholder="Category Name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Slug
                </label>
                <input
                  type="text"
                  value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: e.target.value })}
                  required
                  className="input"
                  placeholder="category-slug"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Description (Optional)
              </label>
              <textarea
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                rows={2}
                className="input resize-none"
              />
            </div>
            <div className="flex gap-3">
              <button type="submit" className="btn-primary">
                {editingId ? "Update Category" : "Create Category"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditingId(null);
                }}
                className="btn-outline"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {categories.map((category) => (
          <div key={category.id} className="card">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                  <FolderTree className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-foreground">{category.name}</p>
                  <p className="text-xs text-foreground/50">/{category.slug}</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => startEdit(category.id)}
                  className="p-1.5 text-foreground/50 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => deleteCategory(category.id)}
                  className="p-1.5 text-foreground/50 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            {category.description && (
              <p className="text-sm text-foreground/60 mt-2">
                {category.description}
              </p>
            )}
            <p className="text-xs text-foreground/50 mt-2">
              {category.product_count} products
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
