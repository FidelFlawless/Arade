"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { X } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";

const STORAGE_KEY = "arade_welcome_promo_dismissed_at";
/** Re-show the modal after this many days (2), unless they sign in. */
const RESHOW_DAYS = 2;

/**
 * First-order discount promo modal.
 *
 * Shows once per device to logged-out visitors, ~5s after landing, with
 * the headline discount pulled live from the active first-order coupon
 * (so the modal never advertises a percentage that doesn't exist).
 */
export default function WelcomePromoModal() {
  const { user, loading: authLoading } = useAuth();
  const [open, setOpen] = useState(false);
  const [headline, setHeadline] = useState("20% off");
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (user) return; // signed-in users never see it

    // Re-shows after 2 days per device; signed-in users never see it.
    let dismissedAt = 0;
    try {
      dismissedAt = Number(localStorage.getItem(STORAGE_KEY)) || 0;
    } catch {
      dismissedAt = 0;
    }
    const cooldownMs = RESHOW_DAYS * 24 * 60 * 60 * 1000;
    if (dismissedAt && Date.now() - dismissedAt < cooldownMs) return;

    let cancelled = false;
    // Check there is an active first-order coupon before showing anything.
    fetch("/api/promo/first-order")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled || !d?.active) return;
        if (d.discount_type === "percent") {
          setHeadline(`${Number(d.discount_value_cad)}% off`);
        } else if (d.discount_value_cad) {
          setHeadline(`C$${Number(d.discount_value_cad).toFixed(0)} off`);
        }
        setChecked(true);
        // Let the page settle before popping the modal.
        setTimeout(() => {
          if (!cancelled) setOpen(true);
        }, 5000);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [authLoading, user]);

  const dismiss = () => {
    setOpen(false);
    try {
      localStorage.setItem(STORAGE_KEY, String(Date.now()));
    } catch {
      /* private mode - fine, it will just show again */
    }
  };

  // Don't render anything until eligibility is confirmed.
  if (!checked || !open || authLoading || user) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={dismiss} />
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden animate-[fadeIn_0.2s_ease-out]">
        <button
          onClick={dismiss}
          aria-label="Close"
          className="absolute top-3 right-3 p-1.5 rounded-full text-foreground/40 hover:text-foreground hover:bg-muted transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="bg-primary/10 px-6 pt-8 pb-6 text-center">
          <div className="w-16 h-16 rounded-full overflow-hidden mx-auto mb-4 shadow-md">
            <Image src="/icon.png" alt="Arade" width={64} height={64} className="w-full h-full object-cover" />
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-2">
            Get {headline} your first order!
          </h2>
          <p className="text-foreground/60 text-sm">
            Create a free account and we&apos;ll email you a welcome code for{" "}
            <strong className="text-primary">{headline}</strong> your first order.
          </p>
        </div>

        <div className="px-6 py-5 space-y-3">
          <Link
            href="/auth/signup"
            onClick={dismiss}
            className="btn-primary w-full flex items-center justify-center"
          >
            Create Account
          </Link>
          <button
            onClick={dismiss}
            className="w-full text-sm text-foreground/50 hover:text-foreground transition-colors"
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
}
