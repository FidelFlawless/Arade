"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { Profile } from "@/types/database";

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const resolveProfile = async (currentUser: User): Promise<Profile> => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", currentUser.id)
        .maybeSingle();

      if (data) {
        return data as Profile;
      }
    } catch {
      // Fallback below
    }

    const fallbackProfile: Profile = {
      id: currentUser.id,
      email: currentUser.email ?? null,
      full_name:
        (currentUser.user_metadata?.full_name as string) ||
        (currentUser.email ? currentUser.email.split("@")[0] : "Customer"),
      first_name: (currentUser.user_metadata?.first_name as string) || "",
      last_name: (currentUser.user_metadata?.last_name as string) || "",
      avatar_url: (currentUser.user_metadata?.avatar_url as string) || null,
      phone: (currentUser.user_metadata?.phone as string) || null,
      country: "CA",
      role: "customer",
      created_at: currentUser.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Auto-create or repair missing profile row in the background
    try {
      const { data: upserted } = await supabase
        .from("profiles")
        .upsert(fallbackProfile, { onConflict: "id" })
        .select("*")
        .maybeSingle();

      if (upserted) {
        return upserted as Profile;
      }
    } catch {
      // Ignore background upsert error (e.g. strict RLS)
    }

    return fallbackProfile;
  };

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const currentUser = session?.user ?? null;
      setUser(currentUser);

      if (currentUser) {
        const prof = await resolveProfile(currentUser);
        setProfile(prof);
      } else {
        setProfile(null);
      }

      setLoading(false);
    };

    getInitialSession();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);

      // If this is a password recovery event, redirect to the reset page
      if (event === "PASSWORD_RECOVERY" && typeof window !== "undefined") {
        window.location.href = "/auth/reset-password";
        return;
      }

      if (currentUser) {
        const prof = await resolveProfile(currentUser);
        setProfile(prof);
      } else {
        setProfile(null);
      }

      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  const refreshProfile = async () => {
    if (!user) return;
    const prof = await resolveProfile(user);
    setProfile(prof);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    window.location.href = "/";
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}
