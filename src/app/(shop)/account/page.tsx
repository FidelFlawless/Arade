"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";
import { User, Package, MapPin, LogOut, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const accountLinks = [
  { href: "/account", label: "Profile", icon: User },
  { href: "/account/orders", label: "My Orders", icon: Package },
  { href: "/account/addresses", label: "Saved Addresses", icon: MapPin },
];

export default function AccountPage() {
  const { user, profile, loading, signOut } = useAuth();
  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState(profile?.full_name || "");
  const [phone, setPhone] = useState(profile?.phone || "");
  const [country, setCountry] = useState(profile?.country || "CA");
  const [saving, setSaving] = useState(false);
  const supabase = createClient();

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || !profile) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-bold text-foreground mb-2">
            Please sign in
          </h2>
          <Link href="/auth/login" className="btn-primary">
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: fullName.trim(), phone: phone.trim() || null, country })
      .eq("id", user.id);
    setSaving(false);
    if (error) {
      alert("Failed to save: " + error.message);
      return;
    }
    setEditing(false);
    window.location.reload();
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
      <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-foreground mb-6 sm:mb-8">My Account</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Sidebar */}
        <div className="md:col-span-1">
          <nav className="space-y-2">
            {accountLinks.map((link) => {
              const Icon = link.icon;
              const isActive = link.href === "/account";
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    isActive
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-foreground/60 hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {link.label}
                </Link>
              );
            })}
            <button
              onClick={signOut}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-red-600 hover:bg-red-50 transition-colors"
            >
              <LogOut className="w-5 h-5" />
              Sign Out
            </button>
          </nav>
        </div>

        {/* Main content */}
        <div className="md:col-span-2">
          <div className="card">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-foreground">
                Profile Information
              </h2>
              {!editing && (
                <button
                  onClick={() => setEditing(true)}
                  className="text-sm text-primary hover:text-primary-dark"
                >
                  Edit
                </button>
              )}
            </div>

            {editing ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="input"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    suppressHydrationWarning
                    value={user.email || ""}
                    disabled
                    className="input bg-muted"
                  />
                  <p className="text-xs text-foreground/50 mt-1">
                    Email cannot be changed
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="input"
                    placeholder="+1 (555) 123-4567"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Country
                  </label>
                  <select
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    className="input"
                  >
                    <option value="CA">Canada</option>
                    <option value="US">United States</option>
                  </select>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="btn-primary flex items-center gap-2"
                  >
                    {saving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : null}
                    Save Changes
                  </button>
                  <button
                    onClick={() => {
                      setEditing(false);
                      setFullName(profile.full_name);
                      setPhone(profile.phone || "");
                      setCountry(profile.country || "CA");
                    }}
                    className="btn-outline"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-foreground/50">Full Name</p>
                    <p className="font-medium text-foreground">
                      {profile.full_name}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-foreground/50">Email</p>
                    <p className="font-medium text-foreground">
                      {user.email}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-foreground/50">Phone</p>
                    <p className="font-medium text-foreground">
                      {profile.phone || "Not provided"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-foreground/50">Country</p>
                    <p className="font-medium text-foreground">
                      {profile.country === "CA"
                        ? "Canada"
                        : profile.country === "US"
                        ? "United States"
                        : "Not set"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-foreground/50">Member Since</p>
                    <p className="font-medium text-foreground">
                      {new Date(profile.created_at).toLocaleDateString(
                        "en-US",
                        {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        }
                      )}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
