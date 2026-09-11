"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";
import { User, Package, MapPin, LogOut, Loader2, ArrowLeft, Lock, Trash2, Eye, EyeOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { isValidNorthAmericanPhone } from "@/lib/utils";

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
  const [phoneError, setPhoneError] = useState("");
  const [accountMessage, setAccountMessage] = useState("");
  const [accountError, setAccountError] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);
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
    if (phone.trim() && !isValidNorthAmericanPhone(phone)) {
      setPhoneError("Enter a valid Canada or United States phone number.");
      return;
    }

    setPhoneError("");
    setAccountMessage("");
    setAccountError("");
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: fullName.trim(), phone: phone.trim() || null, country })
      .eq("id", user.id);
    setSaving(false);
    if (error) {
      setAccountError("We could not save your profile. Please try again.");
      return;
    }
    setAccountMessage("Profile updated successfully.");
    setEditing(false);
  };

  const handlePasswordChange = async () => {
    setPasswordError("");
    setPasswordMessage("");
    if (!currentPassword) {
      setPasswordError("Enter your current password first.");
      return;
    }
    if (newPassword.length < 8 || !/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/\d/.test(newPassword)) {
      setPasswordError("Use at least 8 characters with an uppercase letter, lowercase letter, and number.");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setPasswordError("The passwords do not match.");
      return;
    }

    setPasswordSaving(true);
    const { error: reauthenticationError } = await supabase.auth.signInWithPassword({
      email: user.email || "",
      password: currentPassword,
    });
    if (reauthenticationError) {
      setPasswordSaving(false);
      setPasswordError("Your current password is incorrect.");
      return;
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setPasswordSaving(false);
    if (error) {
      setPasswordError("We could not change your password. Please try again.");
      return;
    }
    setNewPassword("");
    setConfirmNewPassword("");
    setCurrentPassword("");
    setChangingPassword(false);
    setPasswordMessage("Password changed successfully.");
  };

  const handleDeleteAccount = async () => {
    if (!window.confirm("Delete your account and all associated test data? This cannot be undone.")) return;

    setDeletingAccount(true);
    setAccountError("");
    const response = await fetch("/api/account/delete", { method: "DELETE" });
    if (!response.ok) {
      setDeletingAccount(false);
      setAccountError("We could not delete your account. Please contact support.");
      return;
    }
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
      <Link
        href="/shop"
        className="inline-flex items-center gap-2 text-sm text-foreground/60 hover:text-primary transition-colors mb-5"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Shop
      </Link>
      <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-foreground mb-6 sm:mb-8">My Account</h1>

      {(accountMessage || accountError) && (
        <div className={`mb-6 rounded-lg border px-4 py-3 text-sm ${accountError ? "border-red-200 bg-red-50 text-red-700" : "border-green-200 bg-green-50 text-green-700"}`} role="status">
          {accountError || accountMessage}
        </div>
      )}

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
                    onChange={(e) => {
                      setPhone(e.target.value);
                      setPhoneError("");
                    }}
                    className={`input ${phoneError ? "input-error" : ""}`}
                    placeholder="+1 (416) 555-0123"
                    inputMode="tel"
                  />
                  {phoneError && <p className="text-xs text-red-600 mt-1">{phoneError}</p>}
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

          <div className="card mt-6">
            <div className="flex items-center gap-3 mb-4">
              <Lock className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-semibold text-foreground">Security</h2>
            </div>
            <p className="text-sm text-foreground/60 mb-4">
              Email verification: {user.email_confirmed_at ? "Verified" : "Not verified"}
            </p>
            {passwordError && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{passwordError}</div>}
            {passwordMessage && <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700" role="status">{passwordMessage}</div>}
            {!changingPassword ? (
              <button type="button" onClick={() => { setChangingPassword(true); setPasswordError(""); setPasswordMessage(""); }} className="btn-primary flex items-center gap-2">
                <Lock className="w-4 h-4" />
                Change Password
              </button>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-foreground/60">Verify your current password before choosing a new one.</p>
                <div className="relative">
                  <input type={showCurrentPassword ? "text" : "password"} value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="Current password" autoComplete="current-password" className="input pr-12" />
                  <button type="button" onClick={() => setShowCurrentPassword(!showCurrentPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground/50 hover:text-foreground" aria-label={showCurrentPassword ? "Hide current password" : "Show current password"}>
                    {showCurrentPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                <div className="relative">
                  <input type={showNewPassword ? "text" : "password"} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="New password" minLength={8} autoComplete="new-password" className="input pr-12" />
                  <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground/50 hover:text-foreground" aria-label={showNewPassword ? "Hide new password" : "Show new password"}>
                    {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                <div className="relative">
                  <input type={showConfirmNewPassword ? "text" : "password"} value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)} placeholder="Confirm new password" minLength={8} autoComplete="new-password" className="input pr-12" />
                  <button type="button" onClick={() => setShowConfirmNewPassword(!showConfirmNewPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground/50 hover:text-foreground" aria-label={showConfirmNewPassword ? "Hide confirmed password" : "Show confirmed password"}>
                    {showConfirmNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                <p className="text-xs text-foreground/50">Password must contain 8+ characters, uppercase and lowercase letters, and a number.</p>
                <div className="flex flex-wrap gap-3">
                  <button type="button" onClick={handlePasswordChange} disabled={passwordSaving} className="btn-primary flex items-center gap-2 disabled:opacity-60">
                    {passwordSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                    {passwordSaving ? "Updating Password..." : "Confirm Password Change"}
                  </button>
                  <button type="button" onClick={() => { setChangingPassword(false); setCurrentPassword(""); setNewPassword(""); setConfirmNewPassword(""); setPasswordError(""); }} className="btn-outline" disabled={passwordSaving}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="card mt-6 border-red-200">
            <div className="flex items-center gap-3 mb-2">
              <Trash2 className="w-5 h-5 text-red-600" />
              <h2 className="text-xl font-semibold text-foreground">Delete Account</h2>
            </div>
            <p className="text-sm text-foreground/60 mb-4">Delete your account permanently. This action cannot be undone.</p>
            <button type="button" onClick={handleDeleteAccount} disabled={deletingAccount} className="inline-flex items-center gap-2 rounded-lg border border-red-300 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50">
              {deletingAccount && <Loader2 className="w-4 h-4 animate-spin" />}
              Delete My Account
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
