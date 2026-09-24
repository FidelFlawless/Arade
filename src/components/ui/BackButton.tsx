"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";

interface BackButtonProps {
  href: string;
  label?: string;
  className?: string;
}

export default function BackButton({ href, label = "Go back", className = "" }: BackButtonProps) {
  return (
    <Link
      href={href}
      className={`flex items-center justify-center w-8 h-8 rounded-full bg-foreground/5 hover:bg-foreground/10 text-foreground/60 hover:text-foreground transition-colors mb-4 lg:hidden ${className}`}
      aria-label={label}
      title={label}
    >
      <ArrowLeft className="w-4 h-4" />
    </Link>
  );
}
