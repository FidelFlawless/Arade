"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/providers/AuthProvider";
import { safeInternalRedirect } from "@/lib/utils";
import { Eye, EyeOff, Mail, Lock, Loader2 } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [showResend, setShowResend] = useState(false);
  const [resendEmail, setResendEmail] = useState("");
  const [resendLoading, setResendLoading] = useState(false);
  const [resendDone, setResendDone] = useState(false);
  const [resendError, setResendError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const supabase = createClient();

  // Get redirect URL from query params
  const getRedirect = () => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      return safeInternalRedirect(params.get("redirect"));
    }
    return "/account";
  };

  // Redirect if already logged in (e.g. page refresh)
  useEffect(() => {
    if (!authLoading && user) {
      router.replace(getRedirect());
    }
  }, [authLoading, user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }

      // Claim any guest orders placed with this email before the account
      // existed. Best-effort: never blocks the login flow.
      if (data?.session?.access_token) {
        fetch("/api/account/claim-guest-orders", {
          method: "POST",
          headers: { Authorization: `Bearer ${data.session.access_token}` },
        }).catch(() => {});
      }

      // Auth state will update → useEffect will redirect
    } catch {
      setError("An unexpected error occurred. Please try again.");
      setLoading(false);
    }
  };

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    setResendError("");
    setResendLoading(true);
    try {
      const res = await fetch("/api/auth/resend-confirmation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: resendEmail.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setResendError(data.error || "Could not send the email. Please try again.");
        return;
      }
      setResendDone(true);
    } catch {
      setResendError("Could not send the email. Please try again.");
    } finally {
      setResendLoading(false);
    }
  };

  // Show spinner while loading, auth resolving, or already logged in
  if (loading || authLoading || user) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Welcome Back</h1>
          <p className="mt-2 text-foreground/60">
            Sign in to your Arade account
          </p>
        </div>

        <div className="card">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-foreground mb-2"
              >
                Email Address
              </label>
              <div className="flex items-center w-full border border-border rounded-lg px-3 py-2.5 bg-white transition-colors duration-200">
                <Mail className="w-5 h-5 text-foreground/40 shrink-0 mr-2" />
                <input
                  id="email"
                  type="email"
                  suppressHydrationWarning
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="you@example.com"
                  className="flex-1 min-w-0 outline-none bg-transparent text-foreground text-base"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-foreground mb-2"
              >
                Password
              </label>
              <div className="relative">
                <div className="flex items-center w-full border border-border rounded-lg px-3 py-2.5 bg-white transition-colors duration-200">
                  <Lock className="w-5 h-5 text-foreground/40 shrink-0 mr-2" />
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="Enter your password"
                    className="flex-1 min-w-0 outline-none bg-transparent text-foreground text-base pr-10"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground/40 hover:text-foreground/60 p-1 z-10"
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded border-border text-primary focus:ring-primary/20"
                />
                <span className="text-sm text-foreground/60">Remember me</span>
              </label>
              <Link
                href="/auth/forgot-password"
                className="text-sm text-primary hover:text-primary-dark"
              >
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                "Sign In"
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-foreground/60">
            Don&apos;t have an account?{" "}
            <Link
              href="/auth/signup"
              className="text-primary font-medium hover:text-primary-dark"
            >
              Create one
            </Link>
          </p>

          <div className="mt-6 border-t border-border pt-5 text-center">
            {!showResend ? (
              <button
                type="button"
                onClick={() => {
                  setShowResend(true);
                  setResendEmail(email);
                }}
                className="text-sm text-foreground/60 hover:text-foreground underline underline-offset-2"
              >
                Didn&apos;t get your confirmation email? Resend it
              </button>
            ) : resendDone ? (
              <p className="text-sm text-green-700" role="status">
                If an account exists for that email, a new confirmation link is
                on its way. Check your inbox (and spam folder).
              </p>
            ) : (
              <form onSubmit={handleResend} className="space-y-3 text-left">
                <p className="text-sm text-foreground/60">
                  We&apos;ll send a fresh confirmation link to your email.
                </p>
                {resendError && (
                  <p className="text-xs text-red-600" role="alert">{resendError}</p>
                )}
                <div className="flex items-center w-full border border-border rounded-lg px-3 py-2.5 bg-white">
                  <Mail className="w-5 h-5 text-foreground/40 shrink-0 mr-2" />
                  <input
                    type="email"
                    required
                    suppressHydrationWarning
                    value={resendEmail}
                    onChange={(e) => setResendEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="flex-1 min-w-0 outline-none bg-transparent text-foreground text-base"
                  />
                </div>
                <button
                  type="submit"
                  disabled={resendLoading}
                  className="btn-outline w-full flex items-center justify-center gap-2"
                >
                  {resendLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    "Resend confirmation email"
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
