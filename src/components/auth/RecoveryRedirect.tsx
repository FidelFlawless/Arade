"use client";

import { useEffect } from "react";

export default function RecoveryRedirect() {
  useEffect(() => {
    if (window.location.pathname === "/auth/reset-password") return;

    const hash = window.location.hash;
    if (!hash) return;

    const params = new URLSearchParams(hash.slice(1));
    if (params.get("type") !== "recovery" || !params.get("access_token")) return;

    window.location.replace(`/auth/reset-password${hash}`);
  }, []);

  return null;
}
