"use client";

import { useState, FormEvent } from "react";
import { Loader2, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function NewsletterForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "duplicate" | "error">("idle");
  const [message, setMessage] = useState("");
  const supabase = createClient();

  const validateEmail = (value: string): boolean => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(value);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();

    if (!trimmed) {
      setStatus("error");
      setMessage("Please enter your email address.");
      return;
    }

    if (!validateEmail(trimmed)) {
      setStatus("error");
      setMessage("Please enter a valid email address.");
      return;
    }

    setStatus("loading");
    setMessage("");

    const { data: existing } = await supabase
      .from("newsletter_subscribers")
      .select("id")
      .eq("email", trimmed)
      .maybeSingle();

    if (existing) {
      setStatus("duplicate");
      setMessage("You're already subscribed! ✨");
      setEmail("");
      return;
    }

    const { error } = await supabase
      .from("newsletter_subscribers")
      .insert({ email: trimmed });

    if (error) {
      setStatus("error");
      setMessage("Something went wrong. Please try again later.");
      return;
    }

    setStatus("success");
    setMessage("You're subscribed! ✨");
    setEmail("");
  };

  return (
    <form onSubmit={handleSubmit} className="mt-8 max-w-md mx-auto">
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="email"
          value={email}
          onChange={(e) => { setEmail(e.target.value); if (status !== "idle") setStatus("idle"); }}
          placeholder="Enter your email"
          disabled={status === "loading"}
          className="flex-1 px-4 py-3 rounded-lg bg-white/20 border border-white/30 text-white placeholder-white/60 outline-none focus:ring-2 focus:ring-white/40 disabled:opacity-50"
          aria-label="Email address"
        />
        <button
          type="submit"
          disabled={status === "loading"}
          className="px-6 py-3 bg-white text-primary font-medium rounded-lg hover:bg-white/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {status === "loading" ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Subscribing...
            </>
          ) : status === "success" || status === "duplicate" ? (
            <>
              <Check className="w-4 h-4" />
              Subscribed
            </>
          ) : (
            "Subscribe"
          )}
        </button>
      </div>
      {message && (
        <p className={`text-center text-sm mt-3 ${status === "success" || status === "duplicate" ? "text-white" : "text-white/80"}`}>
          {message}
        </p>
      )}
    </form>
  );
}