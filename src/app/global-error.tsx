"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Application error");
  }, []);

  return (
    <html lang="en">
      <body className="min-h-screen flex items-center justify-center bg-background px-4">
        <main className="max-w-md text-center">
          <h1 className="text-3xl font-bold text-foreground">Something went wrong</h1>
          <p className="mt-3 text-foreground/60">
            We could not load this page. Please try again or return to the shop.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <button type="button" onClick={() => reset()} className="btn-primary">
              Try again
            </button>
            <Link href="/shop" className="btn-outline">
              Back to shop
            </Link>
          </div>
        </main>
      </body>
    </html>
  );
}
